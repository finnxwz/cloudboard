import { FileView, Modal, Notice, TFile, setIcon, type App, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import { BOARD_EXTENSION, BOARD_VIEW_TYPE, parseBoard, type BoardCard, type BoardData } from './board-data';
import { imageUrl } from './image-links';
import { t } from './i18n';

export interface BoardActions {
  add(file: TFile, column: number): void;
  remove(file: TFile, id: string): Promise<void>;
  caption(file: TFile, id: string, title: string): Promise<void>;
  move(file: TFile, id: string, column: number, beforeId: string | null): Promise<void>;
}

interface CardDrag {
  id: string;
  file: TFile;
  element: HTMLElement;
  touchId?: number;
}

export interface BoardViewOptions { showCaptionBar: boolean }

interface DropTarget { column: number; beforeId: string | null }

export class ImageBoardView extends FileView {
  private revision = 0;
  private board: BoardData | null = null;
  private drag: CardDrag | null = null;
  private dropTarget: DropTarget | null = null;
  private moving = false;
  private cancelTouchHold: (() => void) | null = null;
  private suppressPreviewUntil = 0;

  constructor(leaf: WorkspaceLeaf, private actions: BoardActions,
    private getOptions: () => BoardViewOptions = () => ({ showCaptionBar: true })) {
    super(leaf);
    this.contentEl.addClass('pinterest-board-view');
    this.contentEl.addEventListener('pointerdown', event => {
      for (const visible of Array.from(this.contentEl.querySelectorAll('.is-actions-visible'))) {
        if (!visible.contains(event.target as Node)) visible.classList.remove('is-actions-visible');
      }
    });
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file === this.file) void this.refresh(file as TFile);
      else if (this.file && this.board?.cards.some(card => card.kind === 'local' && card.file === file.path)) {
        void this.refresh(this.file);
      }
    }));
    // A synced board can arrive before its attachments on another device.
    const refreshAttachment = (file: TAbstractFile): void => {
      if (this.file && this.board?.cards.some(card => card.kind === 'local' && card.file === file.path)) {
        void this.refresh(this.file);
      }
    };
    this.registerEvent(this.app.vault.on('create', refreshAttachment));
    this.registerEvent(this.app.vault.on('delete', refreshAttachment));
  }

  getViewType(): string { return BOARD_VIEW_TYPE; }
  getIcon(): string { return 'images'; }
  getDisplayText(): string { return this.file?.basename ?? t('board'); }
  canAcceptExtension(extension: string): boolean { return extension === BOARD_EXTENSION; }
  applySettings(): void { this.render(); }

  async onLoadFile(file: TFile): Promise<void> { await this.refresh(file); }
  async onUnloadFile(): Promise<void> {
    this.clearDrag();
    this.revision++;
    this.board = null;
    this.contentEl.empty();
  }
  async onRename(): Promise<void> { if (this.file) await this.refresh(this.file); }

  async refresh(file: TFile): Promise<void> {
    const revision = ++this.revision;
    try {
      const board = parseBoard(await this.app.vault.read(file));
      if (revision !== this.revision || this.file !== file) return;
      this.board = board;
      this.render();
    } catch (error) {
      if (revision !== this.revision || this.file !== file) return;
      this.board = null;
      this.contentEl.empty();
      this.contentEl.createEl('p', { cls: 'pinterest-board-error', text:
        t('boardLoadFailed', { error: error instanceof Error ? error.message : String(error) }) });
      const retry = this.contentEl.createEl('button', { text: t('retry') });
      retry.addEventListener('click', () => { void this.refresh(file); });
    }
  }

  private render(): void {
    const board = this.board;
    const file = this.file;
    if (!board || !file) return;
    this.clearDrag();
    const scrollTop = this.contentEl.scrollTop;
    const scrollLeft = this.contentEl.querySelector('.pinterest-board-scroll')?.scrollLeft ?? 0;
    this.contentEl.empty();
    const header = this.contentEl.createDiv({ cls: 'pinterest-board-header' });
    header.createEl('h1', { text: file.basename });
    header.createEl('p', { text: t('boardSubtitle'), cls: 'pinterest-board-subtitle' });
    if (board.sourceNote) {
      const note = header.createEl('button', { text: t('openSourceNote'), cls: 'pinterest-board-note' });
      note.addEventListener('click', () => {
        const source = this.app.vault.getAbstractFileByPath(board.sourceNote!);
        if (source instanceof TFile) void this.app.workspace.getLeaf('tab').openFile(source);
        else new Notice(t('sourceNoteMissing'));
      });
    }
    const scroll = this.contentEl.createDiv({ cls: 'pinterest-board-scroll' });
    const grid = scroll.createDiv({ cls: 'pinterest-board-grid', attr: { 'aria-label': t('fourColumns') } });
    for (let column = 0; column < 4; column++) {
      const stack = grid.createDiv({ cls: 'pinterest-board-column', attr: { 'aria-label': t('column', { number: column + 1 }) } });
      stack.dataset.column = String(column);
      stack.addEventListener('dragover', event => {
        if (!this.drag || this.drag.file !== file) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        this.markDrop(stack, event.clientY);
      });
      stack.addEventListener('dragleave', event => {
        if (!event.relatedTarget || !stack.contains(event.relatedTarget as Node)) this.clearDrop();
      });
      stack.addEventListener('drop', event => {
        if (!this.drag || this.drag.file !== file) return;
        event.preventDefault();
        event.stopPropagation();
        this.markDrop(stack, event.clientY);
        void this.finishDrag();
      });
      for (const card of board.cards.filter(item => item.column === column)) this.renderCard(stack, card, file);
      const add = stack.createEl('button', {
        cls: 'pinterest-board-add',
        attr: { type: 'button', 'aria-label': t('addInColumn', { number: column + 1 }) },
      });
      const plus = add.createSpan({ cls: 'pinterest-board-add-icon', attr: { 'aria-hidden': 'true' } });
      setIcon(plus, 'plus');
      add.createSpan({ cls: 'pinterest-board-add-label', text: t('addImage') });
      add.addEventListener('click', () => this.actions.add(file, column));
    }
    scroll.scrollLeft = scrollLeft;
    this.contentEl.scrollTop = scrollTop;
  }

  private renderCard(parent: HTMLElement, card: BoardCard, boardFile: TFile): void {
    const article = parent.createEl('article', { cls: 'pinterest-board-card' });
    const showCaptionBar = this.getOptions().showCaptionBar;
    article.classList.toggle('is-image-only', !showCaptionBar);
    article.tabIndex = 0;
    article.setAttribute('aria-label', t('moveCardLabel', { title: card.title || t('image') }));
    article.dataset.cardId = card.id;
    article.draggable = true;
    article.addEventListener('dragstart', event => {
      if (this.moving || this.drag?.touchId !== undefined) { event.preventDefault(); return; }
      this.clearDrag();
      this.drag = { id: card.id, file: boardFile, element: article };
      article.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.id);
      }
    });
    article.addEventListener('dragend', () => this.clearDrag());
    article.addEventListener('keydown', event => {
      if (event.target !== article) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || this.moving) return;
      event.preventDefault();
      const current = this.board?.cards.find(item => item.id === card.id);
      if (!current) return;
      const siblings = this.board!.cards.filter(item => item.column === current.column);
      const index = siblings.findIndex(item => item.id === card.id);
      let column = current.column;
      let beforeId: string | null = null;
      if (event.key === 'ArrowLeft') column--;
      if (event.key === 'ArrowRight') column++;
      if (column < 0 || column > 3) return;
      if (event.key === 'ArrowUp') { if (index === 0) return; beforeId = siblings[index - 1]!.id; }
      if (event.key === 'ArrowDown') { if (index === siblings.length - 1) return; beforeId = siblings[index + 2]?.id ?? null; }
      void this.persistMove(boardFile, card.id, { column, beforeId }, true);
    });
    const media = article.createEl('button', {
      cls: 'pinterest-board-image-button',
      attr: { type: 'button', 'aria-label': t('enlargeImage', { title: card.title || t('image') }) },
    });
    this.setupTouchDrag(media, article, card, boardFile);
    let touchInput = false;
    media.addEventListener('pointerdown', event => { touchInput = event.pointerType === 'touch'; });
    media.addEventListener('touchstart', () => { touchInput = true; }, { passive: true });
    const image = media.createEl('img', { attr: {
      alt: card.title, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer',
    } });
    image.draggable = false;
    const error = media.createSpan({ cls: 'pinterest-board-image-error', text: t('imageUnavailable') });
    error.hidden = true;
    let src: string | undefined;
    if (card.kind === 'local') {
      const file = this.app.vault.getAbstractFileByPath(card.file!);
      if (file instanceof TFile) src = this.app.vault.getResourcePath(file);
      else error.setText(t('imageMissing'));
    } else src = imageUrl(card.url!);
    image.addEventListener('error', () => { image.hidden = true; error.hidden = false; });
    if (src) {
      image.src = src;
      media.addEventListener('click', () => {
        if (this.drag || this.moving || Date.now() < this.suppressPreviewUntil) return;
        if (!showCaptionBar && touchInput && !article.classList.contains('is-actions-visible')) {
          for (const visible of Array.from(this.contentEl.querySelectorAll('.is-actions-visible'))) visible.classList.remove('is-actions-visible');
          article.classList.add('is-actions-visible');
          return;
        }
        new BoardImagePreview(this.app, src!, card.title).open();
      });
    } else { image.hidden = true; error.hidden = false; }
    const footer = article.createDiv({ cls: showCaptionBar ? 'pinterest-board-card-footer' : 'pinterest-board-card-overlay' });
    if (showCaptionBar) footer.createSpan({ cls: 'pinterest-board-card-title', text: card.title });
    const edit = footer.createEl('button', { cls: 'pinterest-board-edit pinterest-board-action', attr: {
      type: 'button', 'aria-label': t('editCaption'), title: t('editCaption'),
    } });
    setIcon(edit, 'pencil');
    edit.addEventListener('click', () => new EditCaptionModal(this.app, card.title,
      title => this.actions.caption(boardFile, card.id, title)).open());
    const remove = footer.createEl('button', { cls: 'pinterest-board-remove pinterest-board-action', attr: {
      type: 'button', 'aria-label': t('removeCardLabel'), title: t('removeCard'),
    } });
    setIcon(remove, 'trash-2');
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try { await this.actions.remove(boardFile, card.id); }
      catch (error) { new Notice(t('removeFailed', { error: error instanceof Error ? error.message : String(error) })); remove.disabled = false; }
    });
  }

  private markDrop(stack: HTMLElement, y: number): void {
    if (!this.drag) return;
    this.clearDrop();
    const before = Array.from(stack.querySelectorAll<HTMLElement>('.pinterest-board-card'))
      .find(element => element.dataset.cardId !== this.drag!.id && y < element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2);
    this.dropTarget = { column: Number(stack.dataset.column), beforeId: before?.dataset.cardId ?? null };
    if (before) before.classList.add('pinterest-board-drop-before');
    else stack.classList.add('pinterest-board-drop-end');
  }

  private clearDrop(): void {
    for (const element of Array.from(this.contentEl.querySelectorAll('.pinterest-board-drop-before, .pinterest-board-drop-end'))) {
      element.classList.remove('pinterest-board-drop-before', 'pinterest-board-drop-end');
    }
    this.dropTarget = null;
  }

  private clearDrag(): void {
    this.cancelTouchHold?.();
    this.cancelTouchHold = null;
    const drag = this.drag;
    this.drag = null;
    this.clearDrop();
    drag?.element.classList.remove('is-dragging');
    if (drag?.touchId !== undefined) this.suppressPreviewUntil = Date.now() + 700;
  }

  private async finishDrag(): Promise<void> {
    const drag = this.drag;
    const target = this.dropTarget;
    this.clearDrag();
    if (drag && target) await this.persistMove(drag.file, drag.id, target);
  }

  private async persistMove(file: TFile, id: string, target: DropTarget, focus = false): Promise<void> {
    if (this.moving) return;
    this.moving = true;
    try {
      await this.actions.move(file, id, target.column, target.beforeId);
      if (this.file === file) {
        await this.refresh(file);
        if (focus) Array.from(this.contentEl.querySelectorAll<HTMLElement>('.pinterest-board-card'))
          .find(element => element.dataset.cardId === id)?.focus();
      }
    } catch (error) {
      new Notice(t('moveFailed', { error: error instanceof Error ? error.message : String(error) }));
    } finally { this.moving = false; }
  }

  private setupTouchDrag(media: HTMLButtonElement, article: HTMLElement, card: BoardCard, file: TFile): void {
    let pending: { id: number; x: number; y: number } | null = null;
    media.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { this.clearDrag(); return; }
      if (this.moving || this.drag) return;
      this.cancelTouchHold?.();
      const touch = event.touches[0]!;
      pending = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
      const timer = setTimeout(() => {
        const hold = pending;
        pending = null;
        this.cancelTouchHold = null;
        if (!hold || this.file !== file || !this.contentEl.contains(article)) return;
        this.drag = { id: card.id, file, element: article, touchId: hold.id };
        article.classList.add('is-dragging');
      }, 450);
      this.cancelTouchHold = () => { clearTimeout(timer); pending = null; };
    }, { passive: true });
    const targetAt = (event: Pick<Touch, 'clientX' | 'clientY'>): void => {
      const stack = this.contentEl.ownerDocument.elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('.pinterest-board-column');
      if (stack && this.contentEl.contains(stack)) this.markDrop(stack, event.clientY);
      else this.clearDrop();
    };
    media.addEventListener('touchmove', event => {
      if (pending) {
        const touch = Array.from(event.touches).find(touch => touch.identifier === pending!.id);
        if (!touch || Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y) > 10) {
          this.cancelTouchHold?.();
          this.cancelTouchHold = null;
        }
      }
      if (this.drag?.element !== article || this.drag.touchId === undefined) return;
      const touch = Array.from(event.touches).find(touch => touch.identifier === this.drag!.touchId);
      if (!touch || event.touches.length !== 1) { this.clearDrag(); return; }
      if (event.cancelable) event.preventDefault();
      const scroll = this.contentEl.querySelector<HTMLElement>('.pinterest-board-scroll');
      if (scroll) {
        const rect = scroll.getBoundingClientRect();
        if (touch.clientX < rect.left + 36) scroll.scrollLeft -= 18;
        if (touch.clientX > rect.right - 36) scroll.scrollLeft += 18;
      }
      const rect = this.contentEl.getBoundingClientRect();
      if (touch.clientY < rect.top + 48) this.contentEl.scrollTop -= 18;
      if (touch.clientY > rect.bottom - 48) this.contentEl.scrollTop += 18;
      targetAt(touch);
    }, { passive: false });
    media.addEventListener('touchend', event => {
      this.cancelTouchHold?.();
      this.cancelTouchHold = null;
      if (this.drag?.element !== article || this.drag.touchId === undefined) return;
      const touch = Array.from(event.changedTouches).find(touch => touch.identifier === this.drag!.touchId);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      targetAt(touch);
      void this.finishDrag();
    }, { passive: false });
    media.addEventListener('touchcancel', () => this.clearDrag());
    media.addEventListener('contextmenu', event => { if (pending || this.drag?.element === article) event.preventDefault(); });
  }
}

export class EditCaptionModal extends Modal {
  constructor(app: App, private title: string, private saveCaption: (title: string) => Promise<void>) { super(app); }
  onOpen(): void {
    this.setTitle(t('editCaption'));
    const form = this.contentEl.createEl('form', { cls: 'pinterest-caption-form' });
    const label = form.createEl('label', { text: t('captionOptional') });
    const input = label.createEl('textarea', { cls: 'pinterest-caption-input', attr: { rows: '3', 'aria-label': t('caption') } });
    input.value = this.title;
    const status = form.createEl('p', { cls: 'pinterest-status', attr: { role: 'status' } });
    const buttons = form.createDiv({ cls: 'pinterest-board-choices' });
    const cancel = buttons.createEl('button', { text: t('cancel'), attr: { type: 'button' } });
    cancel.addEventListener('click', () => this.close());
    const save = buttons.createEl('button', { text: t('save'), cls: 'mod-cta', attr: { type: 'submit' } });
    let busy = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      input.disabled = save.disabled = cancel.disabled = true;
      try { await this.saveCaption(input.value); this.close(); }
      catch (error) { status.setText(error instanceof Error ? error.message : String(error)); }
      finally { busy = false; input.disabled = save.disabled = cancel.disabled = false; }
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); }
    });
    input.focus();
    input.select();
  }
  onClose(): void { this.contentEl.empty(); }
}

class BoardImagePreview extends Modal {
  constructor(app: App, private src: string, private title: string) { super(app); }
  onOpen(): void {
    this.setTitle(this.title || t('image'));
    this.modalEl.addClass('pinterest-board-preview');
    this.contentEl.createEl('img', { attr: { src: this.src, alt: this.title, referrerpolicy: 'no-referrer' } });
  }
  onClose(): void { this.contentEl.empty(); }
}
