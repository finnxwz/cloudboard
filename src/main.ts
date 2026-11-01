import { App, Notice, Plugin, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import { ASSET_FOLDER, registerBoards } from './boards';
import { ImageBoardView } from './board-view';
import { BOARD_VIEW_TYPE, isColumnCount } from './board-data';
import { LANGUAGE_NAMES, resolveLanguage, setLanguage, t } from './i18n';
import { DEFAULT_SETTINGS, type Settings } from './types';

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export default class CloudboardPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private saveQueue: Promise<void> = Promise.resolve();
  private assetFolderObserver: MutationObserver | null = null;

  async onload(): Promise<void> {
    const saved = await this.loadData() as { settings?: Partial<Settings> } | null;
    const currentSettings = saved?.settings?.settingsVersion === DEFAULT_SETTINGS.settingsVersion;
    this.settings = {
      settingsVersion: DEFAULT_SETTINGS.settingsVersion,
      language: resolveLanguage(saved?.settings?.language),
      showCaptionBar: typeof saved?.settings?.showCaptionBar === 'boolean'
        ? saved.settings.showCaptionBar : DEFAULT_SETTINGS.showCaptionBar,
      showAssetFolder: typeof saved?.settings?.showAssetFolder === 'boolean'
        ? saved.settings.showAssetFolder : DEFAULT_SETTINGS.showAssetFolder,
      // Earlier development builds used a per-board/default value. Do not turn
      // that stale test value into the new global preference.
      columnCount: currentSettings && isColumnCount(saved?.settings?.columnCount)
        ? saved.settings.columnCount : DEFAULT_SETTINGS.columnCount,
    };
    setLanguage(this.settings.language);
    this.applyAssetFolderVisibility();
    this.assetFolderObserver = new MutationObserver(() => this.applyAssetFolderVisibility());
    this.assetFolderObserver.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-path'],
    });
    registerBoards(this, () => this.settings);
    this.addSettingTab(new CloudboardSettingsTab(this.app, this));
  }

  onunload(): void {
    this.assetFolderObserver?.disconnect();
    this.assetFolderObserver = null;
    document.body.classList.remove('cloudboard-hide-assets');
    for (const element of Array.from(document.querySelectorAll('.cloudboard-assets-hidden'))) {
      element.classList.remove('cloudboard-assets-hidden');
    }
  }

  applyAssetFolderVisibility(): void {
    const hide = !this.settings.showAssetFolder;
    document.body.classList.toggle('cloudboard-hide-assets', hide);
    if (!hide) {
      for (const element of Array.from(document.querySelectorAll('.cloudboard-assets-hidden'))) {
        element.classList.remove('cloudboard-assets-hidden');
      }
      return;
    }
    for (const element of Array.from(document.querySelectorAll('[data-path]'))) {
      if (!(element instanceof HTMLElement)) continue;
      if (element.dataset.path !== ASSET_FOLDER) continue;
      const closestFolder = element.closest('.nav-folder');
      const folder = element.matches('.nav-folder') ? element
        : closestFolder instanceof HTMLElement ? closestFolder : element;
      folder.classList.add('cloudboard-assets-hidden');
    }
  }

  persist(): Promise<void> {
    this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.saveData({ settings: this.settings }));
    return this.saveQueue;
  }

  refreshBoardViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(BOARD_VIEW_TYPE)) {
      if (leaf.view instanceof ImageBoardView) leaf.view.applySettings();
    }
  }
}

class CloudboardSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: CloudboardPlugin) { super(app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      { name: t('language'), desc: t('languageDescription'),
        control: { type: 'dropdown', key: 'language', defaultValue: DEFAULT_SETTINGS.language, options: LANGUAGE_NAMES } },
      { name: t('showCaptionBar'), desc: t('showCaptionBarDescription'),
        control: { type: 'toggle', key: 'showCaptionBar', defaultValue: DEFAULT_SETTINGS.showCaptionBar } },
      { name: t('showAssetFolder'), desc: t('showAssetFolderDescription'),
        control: { type: 'toggle', key: 'showAssetFolder', defaultValue: DEFAULT_SETTINGS.showAssetFolder } },
      { name: t('columnCount'), desc: t('columnCountDescription'),
        control: { type: 'dropdown', key: 'columnCount', defaultValue: String(DEFAULT_SETTINGS.columnCount),
          options: { '2': '2', '3': '3', '4': '4', '5': '5' } } },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === 'columnCount') return String(this.plugin.settings.columnCount);
    if (key === 'language' || key === 'showCaptionBar' || key === 'showAssetFolder') {
      return this.plugin.settings[key];
    }
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'language') {
      this.plugin.settings.language = resolveLanguage(value);
      setLanguage(this.plugin.settings.language);
      this.plugin.refreshBoardViews();
      this.update();
    } else if (key === 'showCaptionBar' && typeof value === 'boolean') {
      this.plugin.settings.showCaptionBar = value;
      this.plugin.refreshBoardViews();
    } else if (key === 'showAssetFolder' && typeof value === 'boolean') {
      this.plugin.settings.showAssetFolder = value;
      this.plugin.applyAssetFolderVisibility();
    } else if (key === 'columnCount') {
      const columns = Number(value);
      if (!isColumnCount(columns)) return;
      this.plugin.settings.columnCount = columns;
      this.plugin.refreshBoardViews();
    } else return;
    try { await this.plugin.persist(); }
    catch (error) { new Notice(t('settingsSaveFailed', { error: message(error) })); }
  }
}
