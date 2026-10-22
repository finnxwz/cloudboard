import {
  App, ButtonComponent, Modal, Notice, Plugin, PluginSettingTab,
  Setting, TFile, normalizePath,
} from 'obsidian';
import { isMetadata, parseCanvas, reconcile } from './canvas';
import { prepareTexts } from './images';
import { fetchBoard, normalizeBoardUrl } from './pinterest';
import { DEFAULT_SETTINGS, type PinterestMetadata, type Settings } from './types';
import { registerBoards } from './boards';
import { ImageBoardView } from './board-view';
import { BOARD_VIEW_TYPE } from './board-data';
import { LANGUAGE_NAMES, resolveLanguage, setLanguage, t } from './i18n';
import { addLocalizedCommand } from './i18n-ui';

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export default class CloudboardPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  /** Fallback when Obsidian's canvas serializer drops custom root properties. */
  private links: Record<string, PinterestMetadata> = {};
  private intervalId: number | undefined;
  private running = false;
  private stopped = false;
  private saveQueue: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    const saved = await this.loadData() as { settings?: Partial<Settings>; links?: Record<string, unknown> } | null;
    const minutes = saved?.settings?.syncIntervalMinutes;
    this.settings = {
      language: resolveLanguage(saved?.settings?.language),
      showCaptionBar: typeof saved?.settings?.showCaptionBar === 'boolean'
        ? saved.settings.showCaptionBar : DEFAULT_SETTINGS.showCaptionBar,
      syncIntervalMinutes: typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 && minutes <= 10080
        ? Math.floor(minutes) : DEFAULT_SETTINGS.syncIntervalMinutes,
      downloadImages: typeof saved?.settings?.downloadImages === 'boolean'
        ? saved.settings.downloadImages : DEFAULT_SETTINGS.downloadImages,
    };
    setLanguage(this.settings.language);
    for (const [path, value] of Object.entries(saved?.links ?? {})) {
      if (isMetadata(value)) this.links[path] = value;
    }
    registerBoards(this, () => this.settings);

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile) || !['md', 'canvas'].includes(file.extension)) return;
      menu.addItem(item => item.setTitle(t('legacyConvert')).setIcon('layout-dashboard')
        .onClick(() => new BoardModal(this.app, this, file).open()));
    }));
    addLocalizedCommand(this, 'legacyConvert', {
      id: 'convert-note-into-pinterest-canvas',
      callback: () => {
        const active = this.app.workspace.getActiveFile();
        new BoardModal(this.app, this, active && ['md', 'canvas'].includes(active.extension) ? active : null).open();
      },
    });
    addLocalizedCommand(this, 'syncCanvases', { id: 'sync-pinterest-canvases', callback: () => { void this.syncAll(true); } });
    this.addSettingTab(new CloudboardSettingsTab(this.app, this));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      // Folder renames also move every registered canvas underneath them.
      let changed = false;
      for (const path of Object.keys(this.links)) {
        if (path === oldPath || path.startsWith(`${oldPath}/`)) {
          this.links[file.path + path.slice(oldPath.length)] = this.links[path]!;
          delete this.links[path];
          changed = true;
        }
      }
      if (changed) void this.persist().catch(error => this.logError('Saving renamed canvas links', error));
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      let changed = false;
      for (const path of Object.keys(this.links)) {
        if (path === file.path || path.startsWith(`${file.path}/`)) { delete this.links[path]; changed = true; }
      }
      if (changed) void this.persist().catch(error => this.logError('Removing canvas links', error));
    }));
    this.app.workspace.onLayoutReady(() => { if (!this.stopped) this.restartTimer(); });
  }

  onunload(): void {
    this.stopped = true;
    if (this.intervalId !== undefined) window.clearInterval(this.intervalId);
  }

  persist(): Promise<void> {
    this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.saveData({ settings: this.settings, links: this.links }));
    return this.saveQueue;
  }

  refreshBoardViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(BOARD_VIEW_TYPE)) {
      if (leaf.view instanceof ImageBoardView) leaf.view.applySettings();
    }
  }

  restartTimer(): void {
    if (this.intervalId !== undefined) window.clearInterval(this.intervalId);
    this.intervalId = undefined;
    if (!this.stopped && this.settings.syncIntervalMinutes > 0) {
      this.intervalId = window.setInterval(() => { void this.syncAll(false); }, this.settings.syncIntervalMinutes * 60_000);
      this.registerInterval(this.intervalId);
    }
  }

  private logError(context: string, error: unknown): void {
    console.error(`[Cloudboard] ${context}: ${message(error)}`);
  }

  async importBoard(input: string, source: TFile | null): Promise<void> {
    if (this.running) throw new Error(t('importBusy'));
    this.running = true;
    try {
      const url = normalizeBoardUrl(input);
      const pins = await fetchBoard(url);
      if (this.stopped) return;
      const folder = source?.parent?.path ?? '';
      const base = source ? `${source.basename} Pinterest` : 'Pinterest';
      let path = normalizePath(`${folder}/${base}.canvas`);
      for (let suffix = 2; this.app.vault.getAbstractFileByPath(path); suffix++) {
        path = normalizePath(`${folder}/${base} ${suffix}.canvas`);
      }
      const texts = await prepareTexts(this.app, pins, path, url, this.settings.downloadImages);
      if (this.stopped) return;
      const metadata: PinterestMetadata = { version: 1, pinterestUrl: url, lastSynced: '', pins: {} };
      const canvas = reconcile({ nodes: [], edges: [] }, metadata, pins, texts);
      const file = await this.app.vault.create(path, JSON.stringify(canvas, null, 2));
      this.links[file.path] = canvas.pinterest!;
      await this.persist();
      await this.app.workspace.getLeaf(false).openFile(file);
      new Notice(t('canvasCreated', { count: pins.length }));
    } finally { this.running = false; }
  }

  async syncAll(manual: boolean): Promise<void> {
    if (this.running || this.stopped) {
      if (manual && !this.stopped) new Notice(t('importBusy'));
      return;
    }
    this.running = true;
    let synced = 0;
    let failed = 0;
    // Only cache successful board snapshots for this run, not across intervals.
    const boards = new Map<string, Awaited<ReturnType<typeof fetchBoard>>>();
    const failures: string[] = [];
    try {
      const files = this.app.vault.getFiles().filter(f => f.extension === 'canvas');
      for (const file of files) {
        if (this.stopped) break;
        try {
          const initial = parseCanvas(await this.app.vault.read(file));
          const metadata = isMetadata(initial.pinterest) ? initial.pinterest : this.links[file.path];
          if (!metadata) continue;
          const url = normalizeBoardUrl(metadata.pinterestUrl);
          let pins = boards.get(url);
          if (!pins) { pins = await fetchBoard(url); boards.set(url, pins); }
          const texts = await prepareTexts(this.app, pins, file.path, url, this.settings.downloadImages);
          if (this.stopped) break;
          const snapshot = pins;
          let updated: PinterestMetadata | undefined;
          // Vault.process reads the latest file and writes atomically, so movements
          // and other edits made while network requests were pending are preserved.
          await this.app.vault.process(file, raw => {
            const current = parseCanvas(raw);
            const anchor = isMetadata(current.pinterest) ? current.pinterest : this.links[file.path];
            if (!anchor || normalizeBoardUrl(anchor.pinterestUrl) !== url) {
              throw new Error(t('boardLinkChanged'));
            }
            const next = reconcile(current, anchor, snapshot, texts);
            updated = next.pinterest;
            return JSON.stringify(next, null, 2);
          });
          if (updated) { this.links[file.path] = updated; await this.persist(); }
          synced++;
        } catch (error) {
          // Unlinked invalid canvases are ignored; linked ones report a real failure.
          if (this.links[file.path] || !(error instanceof SyntaxError)) {
            failed++;
            failures.push(`${file.path}: ${message(error)}`);
            this.logError(file.path, error);
          }
        }
      }
      if (manual && !this.stopped) {
        new Notice(t('syncSummary', { synced, failed }) +
          (failures[0] ? `\n${failures[0]}` : ''), failed ? 12_000 : 5_000);
      }
    } catch (error) {
      this.logError('Sync', error);
      if (manual) new Notice(t('syncFailed', { error: message(error) }), 10_000);
    } finally { this.running = false; }
  }
}

class BoardModal extends Modal {
  constructor(app: App, private plugin: CloudboardPlugin, private source: TFile | null) { super(app); }

  onOpen(): void {
    this.setTitle(t('legacyConvert'));
    this.contentEl.createEl('p', {
      text: t('legacyImportIntro'),
    });
    const input = new Setting(this.contentEl).setName(t('boardUrl'))
      .setDesc('https://www.pinterest.com/username/boardname/');
    let url = '';
    let field: HTMLInputElement;
    input.addText(text => {
      text.setPlaceholder('https://de.pinterest.com/username/boardname/').onChange(value => { url = value; });
      field = text.inputEl;
      field.type = 'url';
      field.addClass('pinterest-board-url');
    });
    const status = this.contentEl.createEl('p', { cls: 'pinterest-status', attr: { role: 'status', 'aria-live': 'polite' } });
    let busy = false;
    let button: ButtonComponent;
    const submit = async (): Promise<void> => {
      if (busy) return;
      try { normalizeBoardUrl(url); }
      catch (error) { status.setText(message(error)); return; }
      busy = true;
      button.setDisabled(true).setButtonText(t('importing'));
      field.disabled = true;
      status.setText(t('preparingBoard'));
      try { await this.plugin.importBoard(url, this.source); this.close(); }
      catch (error) {
        status.setText(message(error));
        busy = false;
        field.disabled = false;
        button.setDisabled(false).setButtonText(t('createCanvas'));
      }
    };
    new Setting(this.contentEl).addButton(b => {
      button = b;
      b.setButtonText(t('createCanvas')).setCta().onClick(() => { void submit(); });
    });
    field!.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); void submit(); }
    });
    field!.focus();
  }

  onClose(): void { this.contentEl.empty(); }
}

class CloudboardSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: CloudboardPlugin) { super(app, plugin); }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl).setName(t('language')).setDesc(t('languageDescription'))
      .addDropdown(dropdown => dropdown.addOptions(LANGUAGE_NAMES).setValue(this.plugin.settings.language).onChange(async value => {
        this.plugin.settings.language = resolveLanguage(value);
        setLanguage(this.plugin.settings.language);
        this.plugin.refreshBoardViews();
        this.display();
        await this.saveSettings();
      }));
    new Setting(this.containerEl).setName(t('showCaptionBar'))
      .setDesc(t('showCaptionBarDescription'))
      .addToggle(toggle => toggle.setValue(this.plugin.settings.showCaptionBar).onChange(async value => {
        this.plugin.settings.showCaptionBar = value;
        this.plugin.refreshBoardViews();
        await this.saveSettings();
      }));
    this.containerEl.createEl('p', { text: t('boardSettingsHint') });
    new Setting(this.containerEl).setName(t('syncInterval')).setDesc(t('syncIntervalDescription'))
      .addDropdown(dropdown => {
        dropdown.addOptions({ '0': t('disabled'), '15': t('everyMinutes', { minutes: 15 }),
          '30': t('everyMinutes', { minutes: 30 }), '60': t('everyMinutes', { minutes: 60 }) });
        const current = String(this.plugin.settings.syncIntervalMinutes);
        if (!['0', '15', '30', '60'].includes(current)) dropdown.addOption(current, t('everyMinutes', { minutes: current }));
        dropdown.setValue(current).onChange(async value => {
          this.plugin.settings.syncIntervalMinutes = Number(value);
          this.plugin.restartTimer();
          await this.saveSettings();
        });
      });
    new Setting(this.containerEl).setName(t('localImages'))
      .setDesc(t('localImagesDescription'))
      .addToggle(toggle => toggle.setValue(this.plugin.settings.downloadImages).onChange(async value => {
        this.plugin.settings.downloadImages = value;
        await this.saveSettings();
      }));
    new Setting(this.containerEl).setName(t('synchronizeBoards')).setDesc(t('synchronizeDescription'))
      .addButton(button => button.setButtonText(t('syncNow')).onClick(async () => {
        button.setDisabled(true).setButtonText(t('syncing'));
        try { await this.plugin.syncAll(true); }
        finally { button.setDisabled(false).setButtonText(t('syncNow')); }
      }));
  }

  private async saveSettings(): Promise<void> {
    try { await this.plugin.persist(); }
    catch (error) { new Notice(t('settingsSaveFailed', { error: message(error) })); }
  }
}
