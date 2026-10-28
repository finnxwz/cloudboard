import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
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
    this.settings = {
      language: resolveLanguage(saved?.settings?.language),
      showCaptionBar: typeof saved?.settings?.showCaptionBar === 'boolean'
        ? saved.settings.showCaptionBar : DEFAULT_SETTINGS.showCaptionBar,
      showAssetFolder: typeof saved?.settings?.showAssetFolder === 'boolean'
        ? saved.settings.showAssetFolder : DEFAULT_SETTINGS.showAssetFolder,
      defaultColumnCount: isColumnCount(saved?.settings?.defaultColumnCount)
        ? saved.settings.defaultColumnCount : DEFAULT_SETTINGS.defaultColumnCount,
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
    for (const element of Array.from(document.querySelectorAll('[data-path]')) as HTMLElement[]) {
      if (element.dataset.path !== ASSET_FOLDER) continue;
      const folder = element.matches('.nav-folder') ? element : element.closest('.nav-folder') as HTMLElement | null;
      (folder ?? element).classList.add('cloudboard-assets-hidden');
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
    new Setting(this.containerEl).setName(t('showAssetFolder'))
      .setDesc(t('showAssetFolderDescription'))
      .addToggle(toggle => toggle.setValue(this.plugin.settings.showAssetFolder).onChange(async value => {
        this.plugin.settings.showAssetFolder = value;
        this.plugin.applyAssetFolderVisibility();
        await this.saveSettings();
      }));
    new Setting(this.containerEl).setName(t('defaultColumnCount'))
      .setDesc(t('defaultColumnCountDescription'))
      .addDropdown(dropdown => dropdown.addOptions({ '2': '2', '3': '3', '4': '4', '5': '5' })
        .setValue(String(this.plugin.settings.defaultColumnCount)).onChange(async value => {
          const columns = Number(value);
          if (!isColumnCount(columns)) return;
          this.plugin.settings.defaultColumnCount = columns;
          await this.saveSettings();
        }));
  }

  private async saveSettings(): Promise<void> {
    try { await this.plugin.persist(); }
    catch (error) { new Notice(t('settingsSaveFailed', { error: message(error) })); }
  }
}
