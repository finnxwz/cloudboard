import { App, Modal, Notice, Plugin, Setting, SuggestModal, TFile, normalizePath } from 'obsidian';
import {
  BOARD_EXTENSION, BOARD_VIEW_TYPE, addBoardCards, createBoardData, newCardId,
  parseBoard, removeBoardCard, renameBoardPaths, updateBoardCaption, moveBoardCard, type BoardCard, type BoardData,
} from './board-data';
import { ImageBoardView, type BoardViewOptions } from './board-view';
import { IMAGE_EXTENSIONS, validateUpload } from './image-files';
import { markdownImageUrl, resolveImageLink } from './image-links';
import { parseCanvas } from './canvas';
import { t } from './i18n';
import { addLocalizedCommand, addLocalizedRibbon } from './i18n-ui';

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function registerBoards(plugin: Plugin, getOptions: () => BoardViewOptions): void {
  const controller = new BoardController(plugin.app);
  plugin.registerView(BOARD_VIEW_TYPE, leaf => new ImageBoardView(leaf, {
    add: (file, column) => controller.add(file, column),
    remove: (file, id) => controller.update(file, board => removeBoardCard(board, id)),
    caption: (file, id, title) => controller.update(file, board => updateBoardCaption(board, id, title)),
    move: (file, id, column, beforeId) => controller.update(file, board => moveBoardCard(board, id, column, beforeId)),
  }, getOptions));
  plugin.registerExtensions([BOARD_EXTENSION], BOARD_VIEW_TYPE);
  plugin.register(() => controller.dispose());
  const create = (): void => {
    const file = plugin.app.workspace.getActiveFile();
    void controller.create(file?.extension === 'md' ? file : null).catch(error => new Notice(message(error)));
  };
  addLocalizedRibbon(plugin, 'newBoard', create);
  addLocalizedCommand(plugin, 'convertNote', { id: 'create-image-board', callback: create });
  addLocalizedCommand(plugin, 'addToBoard', {
    id: 'add-images-to-board',
    checkCallback: checking => {
      const file = plugin.app.workspace.getActiveFile();
      if (file?.extension !== BOARD_EXTENSION) return false;
      if (!checking) controller.add(file, 0);
      return true;
    },
  });
  addLocalizedCommand(plugin, 'migrateCanvas', {
    id: 'convert-canvas-to-image-board',
    checkCallback: checking => {
      const file = plugin.app.workspace.getActiveFile();
      if (file?.extension !== 'canvas') return false;
      if (!checking) void controller.fromCanvas(file).catch(error => new Notice(message(error)));
      return true;
    },
  });
  plugin.registerEvent(plugin.app.workspace.on('file-menu', (menu, file) => {
    if (!(file instanceof TFile)) return;
    if (file.extension === 'md') menu.addItem(item => item.setTitle(t('convertNote')).setIcon('images')
      .onClick(() => { void controller.create(file).catch(error => new Notice(message(error))); }));
    if (file.extension === BOARD_EXTENSION) menu.addItem(item => item.setTitle(t('addToBoard')).setIcon('image-plus')
      .onClick(() => controller.add(file, 0)));
    if (file.extension === 'canvas') menu.addItem(item => item.setTitle(t('migrateCanvasMenu')).setIcon('images')
      .onClick(() => { void controller.fromCanvas(file).catch(error => new Notice(message(error))); }));
  }));
  plugin.registerEvent(plugin.app.vault.on('rename', (file, oldPath) => {
    void controller.renamePaths(oldPath, file.path);
  }));
}

export class BoardController {
  private disposed = false;
  private modals = new Set<AddBoardImageModal>();
  constructor(private app: App) {}

  assertActive(): void {
    if (this.disposed) throw new Error(t('pluginInactive'));
  }
  dispose(): void {
    this.disposed = true;
    for (const modal of this.modals) modal.close();
    this.modals.clear();
  }
  closed(modal: AddBoardImageModal): void { this.modals.delete(modal); }
  add(file: TFile, column: number): void {
    if (this.disposed) return;
    const modal = new AddBoardImageModal(this.app, this, file, column);
    this.modals.add(modal);
    modal.open();
  }

  async create(source: TFile | null): Promise<void> {
    this.assertActive();
    const title = source ? `${source.basename} Board` : t('newBoard');
    const board = createBoardData(title, source?.path);
    await this.createFile(board, source?.parent?.path ?? '');
  }

  private async createFile(board: BoardData, folder: string): Promise<void> {
    this.assertActive();
    const base = normalizePath([folder, board.title].filter(Boolean).join('/'));
    let path = `${base}.${BOARD_EXTENSION}`;
    for (let suffix = 2; this.app.vault.getAbstractFileByPath(path); suffix++) path = `${base} ${suffix}.${BOARD_EXTENSION}`;
    const file = await this.app.vault.create(path, JSON.stringify(board, null, 2));
    if (!this.disposed) await this.app.workspace.getLeaf(false).openFile(file);
  }

  async update(file: TFile, change: (board: BoardData) => BoardData): Promise<void> {
    this.assertActive();
    await this.app.vault.process(file, raw => {
      this.assertActive();
      return JSON.stringify(change(parseBoard(raw)), null, 2);
    });
  }

  async saveImages(file: TFile, column: number, links: string[], vaultFiles: TFile[], uploads: File[],
    caption: string, cache: Map<File, TFile>, progress: (text: string) => void): Promise<void> {
    this.assertActive();
    parseBoard(await this.app.vault.read(file));
    const cards: BoardCard[] = [];
    for (const [index, link] of [...new Set(links)].entries()) {
      this.assertActive();
      progress(t('preparingLink', { number: index + 1 }));
      const image = await resolveImageLink(link);
      cards.push({ id: newCardId(), column, kind: 'remote', title: caption || image.title,
        url: image.imageUrl, sourceUrl: image.sourceUrl });
    }
    for (const local of vaultFiles) {
      if (this.app.vault.getAbstractFileByPath(local.path) !== local) throw new Error(t('missingVaultFile', { name: local.name }));
      cards.push({ id: newCardId(), column, kind: 'local', title: caption || local.basename, file: local.path });
    }
    for (const [index, upload] of uploads.entries()) {
      this.assertActive();
      validateUpload(upload);
      progress(t('copyingPhoto', { number: index + 1 }));
      let local = cache.get(upload);
      if (!local || this.app.vault.getAbstractFileByPath(local.path) !== local) {
        const filename = upload.name.replace(/[\\/:*?"<>|\[\]#^]/g, '-');
        const path = await this.app.fileManager.getAvailablePathForAttachment(filename, file.path);
        const bytes = await upload.arrayBuffer();
        this.assertActive();
        local = await this.app.vault.createBinary(path, bytes);
        cache.set(upload, local);
      }
      cards.push({ id: newCardId(), column, kind: 'local', title: caption || local.basename, file: local.path });
    }
    await this.update(file, board => addBoardCards(board, cards));
  }

  async renamePaths(oldPath: string, newPath: string): Promise<void> {
    for (const file of this.app.vault.getFiles().filter(file => file.extension === BOARD_EXTENSION)) {
      if (this.disposed) return;
      try {
        // Avoid unnecessary writes when unrelated files are renamed.
        const board = parseBoard(await this.app.vault.read(file));
        if (JSON.stringify(renameBoardPaths(board, oldPath, newPath)) === JSON.stringify(board)) continue;
        await this.update(file, current => renameBoardPaths(current, oldPath, newPath));
      } catch (error) { console.error('[Cloudboard] Board-Verknüpfung konnte nicht aktualisiert werden:', message(error)); }
    }
  }

  async fromCanvas(source: TFile): Promise<void> {
    this.assertActive();
    const canvas = parseCanvas(await this.app.vault.read(source));
    const board = createBoardData(`${source.basename} Board`);
    for (const node of canvas.nodes) {
      let local: TFile | null = null;
      if (node.type === 'file' && typeof node.file === 'string') {
        const file = this.app.vault.getAbstractFileByPath(node.file);
        if (file instanceof TFile && IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) local = file;
        else if (file instanceof TFile && file.extension === 'md') board.sourceNote = file.path;
      }
      if (!local && node.type === 'text' && node.text) {
        const wiki = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/.exec(node.text);
        if (wiki) {
          const file = this.app.metadataCache.getFirstLinkpathDest(wiki[1]!, source.path);
          if (file && IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) local = file;
        }
        const image = markdownImageUrl(node.text);
        if (!local && image) {
          board.cards.push({ id: newCardId(), column: board.cards.length % 4,
            kind: 'remote', title: t('onlineImage'), url: image });
        }
      }
      if (local) board.cards.push({ id: newCardId(), column: board.cards.length % 4,
        kind: 'local', title: local.basename, file: local.path });
    }
    if (!board.cards.length) throw new Error(t('noCanvasImages'));
    parseBoard(JSON.stringify(board));
    await this.createFile(board, source.parent?.path ?? '');
    new Notice(t('migratedCanvas'));
  }
}

class VaultImagePicker extends SuggestModal<TFile> {
  constructor(app: App, private choose: (file: TFile) => void) { super(app); this.setPlaceholder(t('searchVaultImage')); }
  getSuggestions(query: string): TFile[] {
    return this.app.vault.getFiles().filter(file => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()) &&
      file.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }
  renderSuggestion(file: TFile, element: HTMLElement): void { element.setText(file.path); }
  onChooseSuggestion(file: TFile): void { this.choose(file); }
}

class AddBoardImageModal extends Modal {
  private busy = false;
  private cache = new Map<File, TFile>();

  constructor(app: App, private controller: BoardController, private boardFile: TFile, private column: number) { super(app); }

  onOpen(): void {
    this.setTitle(t('addImageColumn', { number: this.column + 1 }));
    this.modalEl.addClass('pinterest-add-image-modal');
    this.contentEl.createEl('p', { text: t('chooseImageIntro') });
    let caption = '';
    const controls: Array<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement> = [];
    const status = this.contentEl.createEl('p', { cls: 'pinterest-status', attr: { role: 'status', 'aria-live': 'polite' } });
    const submit = async (links: string[], files: TFile[], uploads: File[]): Promise<void> => {
      if (this.busy) return;
      if (!links.length && !files.length && !uploads.length) { status.setText(t('chooseImageRequired')); return; }
      this.busy = true;
      for (const control of controls) control.disabled = true;
      try {
        await this.controller.saveImages(this.boardFile, this.column, links, files, uploads, caption,
          this.cache, text => status.setText(text));
        this.close();
      } catch (error) { status.setText(message(error)); }
      finally { this.busy = false; for (const control of controls) control.disabled = false; }
    };
    new Setting(this.contentEl).setName(t('caption')).setDesc(t('captionDescription'))
      .addText(text => { text.onChange(value => { caption = value.trim(); }); controls.push(text.inputEl); });
    const upload = this.contentEl.createEl('input', { cls: 'pinterest-board-file-input', attr: {
      type: 'file', accept: '.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp', multiple: '', 'aria-label': t('chooseDevicePhotos'),
    } });
    controls.push(upload);
    upload.addEventListener('change', () => {
      const files = Array.from(upload.files ?? []);
      if (files.length) void submit([], [], files);
      upload.value = '';
    });
    const choices = this.contentEl.createDiv({ cls: 'pinterest-board-choices' });
    const device = choices.createEl('button', { text: t('chooseDevice'), cls: 'mod-cta' });
    device.addEventListener('click', () => upload.click());
    controls.push(device);
    const vault = choices.createEl('button', { text: t('chooseVault') });
    vault.addEventListener('click', () => new VaultImagePicker(this.app, file => { void submit([], [file], []); }).open());
    controls.push(vault);
    let links = '';
    new Setting(this.contentEl).setName(t('internetLink'))
      .setDesc(t('internetLinkDescription'))
      .addTextArea(text => {
        text.setPlaceholder('https://i.pinimg.com/originals/…jpg').onChange(value => { links = value; });
        text.inputEl.rows = 3;
        text.inputEl.addClass('pinterest-image-links');
        text.inputEl.setAttribute('aria-label', t('onlineAddresses'));
        controls.push(text.inputEl);
      });
    new Setting(this.contentEl).addButton(button => {
      button.setButtonText(t('addOnlineImage')).setCta().onClick(() => {
        void submit(links.split(/\r?\n/).map(link => link.trim()).filter(Boolean), [], []);
      });
      controls.push(button.buttonEl);
    });
    this.contentEl.createEl('p', { cls: 'pinterest-status', text:
      t('onlineHint') });
  }
  onClose(): void { this.controller.closed(this); this.contentEl.empty(); }
}
