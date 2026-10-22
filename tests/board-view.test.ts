// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile, type App, type WorkspaceLeaf } from 'obsidian';
import { EditCaptionModal, ImageBoardView, type BoardViewOptions } from '../src/board-view';
import { addBoardCards, createBoardData, type BoardData } from '../src/board-data';
import { setLanguage, type Language } from '../src/i18n';

// Obsidian's DOM helpers are supplied by the host app, not by browsers.
beforeEach(() => {
  setLanguage('de');
  const proto = HTMLElement.prototype;
  Object.defineProperty(proto, 'empty', { configurable: true, value: function(this: HTMLElement) { this.replaceChildren(); } });
  Object.defineProperty(proto, 'addClass', { configurable: true, value: function(this: HTMLElement, cls: string) { this.classList.add(cls); } });
  Object.defineProperty(proto, 'setText', { configurable: true, value: function(this: HTMLElement, text: string) { this.textContent = text; } });
  const create = function(this: HTMLElement, tag: string, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}) {
    const element = document.createElement(tag);
    if (options.cls) element.className = options.cls;
    if (options.text) element.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr ?? {})) element.setAttribute(key, value);
    this.append(element);
    return element;
  };
  Object.defineProperty(proto, 'createEl', { configurable: true, value: create });
  Object.defineProperty(proto, 'createDiv', { configurable: true, value: function(this: HTMLElement, options: object) { return create.call(this, 'div', options); } });
  Object.defineProperty(proto, 'createSpan', { configurable: true, value: function(this: HTMLElement, options: object) { return create.call(this, 'span', options); } });
});

async function openBoard(board: BoardData, options: BoardViewOptions = { showCaptionBar: true }) {
  const file = new TFile();
  file.path = 'Tattoo-Ideen.pboard';
  file.basename = 'Tattoo-Ideen';
  const local = new TFile();
  local.path = 'Photos/a.jpg';
  const app = { vault: {
    on: vi.fn(), read: vi.fn().mockResolvedValue(JSON.stringify(board)),
    getAbstractFileByPath: vi.fn((path: string) => path === local.path ? local : null),
    getResourcePath: vi.fn(() => 'app://local/Photos/a.jpg'),
  } };
  const actions = { add: vi.fn(), remove: vi.fn().mockResolvedValue(undefined),
    caption: vi.fn().mockResolvedValue(undefined), move: vi.fn().mockResolvedValue(undefined) };
  const view = new ImageBoardView({ app } as unknown as WorkspaceLeaf, actions, () => options);
  view.file = file;
  await view.onLoadFile(file);
  return { view, file, app, actions };
}

describe('actual board view rendering', () => {
  it.each([
    ['en', 'Add image', 'Edit caption'],
    ['de', 'Bild hinzufügen', 'Bildunterschrift bearbeiten'],
    ['es', 'Añadir imagen', 'Editar descripción'],
    ['fr', 'Ajouter une image', 'Modifier la légende'],
  ])('switches the open board to %s without translating captions or changing files', async (language, addLabel, editLabel) => {
    const board = addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'local', file: 'Photos/a.jpg', title: 'My own caption' },
    ]);
    const { view, app } = await openBoard(board);
    setLanguage(language as Language);
    view.applySettings();
    expect(view.contentEl.querySelector('.pinterest-board-add-label')!.textContent).toBe(addLabel);
    expect(view.contentEl.querySelector('.pinterest-board-edit')!.getAttribute('aria-label')).toBe(editLabel);
    expect(view.contentEl.querySelector('.pinterest-board-card-title')!.textContent).toBe('My own caption');
    expect(app.vault.read).toHaveBeenCalledTimes(1);
    expect(board.cards[0]!.file).toBe('Photos/a.jpg');
  });
  it('removes the move button and switches the footer to image-only overlays immediately', async () => {
    const options = { showCaptionBar: true };
    const board = addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'remote', url: 'https://i.pinimg.com/a.jpg', title: 'Caption retained' },
    ]);
    const { view, app } = await openBoard(board, options);
    expect(view.contentEl.querySelector('.pinterest-board-grip')).toBeNull();
    expect(view.contentEl.querySelector('[data-icon="grip-vertical"]')).toBeNull();
    expect(view.contentEl.querySelector('.pinterest-board-card-footer')).not.toBeNull();
    options.showCaptionBar = false;
    view.applySettings();
    expect(view.contentEl.querySelector('.pinterest-board-card-footer')).toBeNull();
    expect(view.contentEl.querySelector('.pinterest-board-card-title')).toBeNull();
    expect(view.contentEl.querySelector('.pinterest-board-card.is-image-only')).not.toBeNull();
    expect(view.contentEl.querySelectorAll('.pinterest-board-card-overlay .pinterest-board-action')).toHaveLength(2);
    expect(view.contentEl.querySelector('img')!.alt).toBe('Caption retained');
    options.showCaptionBar = true;
    view.applySettings();
    expect(view.contentEl.querySelector('.pinterest-board-card-title')!.textContent).toBe('Caption retained');
    expect(view.contentEl.querySelector('.pinterest-board-card-overlay')).toBeNull();
    expect(app.vault.read).toHaveBeenCalledTimes(1); // presentation-only, no disk rewrite/reload
    expect(board.cards[0]!.title).toBe('Caption retained');
  });

  it('keeps overlay actions usable on touch and reveals them without opening the preview', async () => {
    const { view } = await openBoard(addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'local', file: 'Photos/a.jpg', title: 'Photo' },
    ]), { showCaptionBar: false });
    const media = view.contentEl.querySelector<HTMLButtonElement>('.pinterest-board-image-button')!;
    media.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    media.click();
    expect(view.contentEl.querySelector('.pinterest-board-card.is-actions-visible')).not.toBeNull();
    view.contentEl.querySelector('.pinterest-board-header')!
      .dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    expect(view.contentEl.querySelector('.is-actions-visible')).toBeNull();
  });
  it('shows edit and remove icons next to the caption, but no source link', async () => {
    const board = addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'remote', url: 'https://i.pinimg.com/a.jpg', title: 'Pin title', sourceUrl: 'https://www.pinterest.com/pin/123/' },
    ]);
    const { view, actions, file } = await openBoard(board);
    const footer = view.contentEl.querySelector('.pinterest-board-card-footer')!;
    expect(footer.querySelector('a')).toBeNull();
    expect(footer.querySelectorAll('.pinterest-board-action')).toHaveLength(2);
    const spy = vi.spyOn(EditCaptionModal.prototype, 'open');
    footer.querySelector<HTMLButtonElement>('.pinterest-board-edit')!.click();
    const modal = spy.mock.instances[0] as EditCaptionModal;
    const input = modal.contentEl.querySelector('textarea')!;
    expect(input.value).toBe('Pin title');
    input.value = 'Edited title';
    modal.contentEl.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(actions.caption).toHaveBeenCalledWith(file, 'a', 'Edited title');
    spy.mockRestore();
  });

  it('allows empty captions and keeps an edit failure visible for retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Disk full')).mockResolvedValueOnce(undefined);
    const modal = new EditCaptionModal({} as App, 'Existing', save);
    modal.open();
    const input = modal.contentEl.querySelector('textarea')!;
    const form = modal.contentEl.querySelector('form')!;
    input.value = '';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(modal.contentEl.textContent).toContain('Disk full'));
    expect(input.disabled).toBe(false);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(modal.contentEl.children).toHaveLength(0));
    expect(save).toHaveBeenNthCalledWith(2, '');
  });

  const dragEvent = (type: string, y = 0): Event => Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    clientY: y, dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn() },
  });

  it('drags a card to another, empty column and clears the drop indicators', async () => {
    const { view, actions, file } = await openBoard(addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'local', file: 'Photos/a.jpg', title: 'Photo' },
    ]));
    const article = view.contentEl.querySelector<HTMLElement>('article')!;
    expect(article.draggable).toBe(true);
    expect(article.querySelector('img')!.draggable).toBe(false);
    article.dispatchEvent(dragEvent('dragstart'));
    const column = view.contentEl.querySelectorAll<HTMLElement>('.pinterest-board-column')[2]!;
    const over = dragEvent('dragover', 100);
    column.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(column.classList.contains('pinterest-board-drop-end')).toBe(true);
    column.dispatchEvent(dragEvent('drop', 100));
    expect(actions.move).toHaveBeenCalledWith(file, 'a', 2, null);
    expect(view.contentEl.querySelector('.is-dragging')).toBeNull();
    expect(view.contentEl.querySelector('.pinterest-board-drop-end')).toBeNull();
  });

  it('uses the hovered card midpoint to insert within a column', async () => {
    const board = addBoardCards(createBoardData('Board'), ['a', 'b', 'c'].map(id =>
      ({ id, column: 0, kind: 'local' as const, file: 'Photos/a.jpg', title: id })));
    const { view, actions, file } = await openBoard(board);
    const articles = view.contentEl.querySelectorAll<HTMLElement>('article');
    articles.forEach((article, i) => { article.getBoundingClientRect = () => ({ top: i * 120, height: 100 }) as DOMRect; });
    articles[0]!.dispatchEvent(dragEvent('dragstart'));
    const column = view.contentEl.querySelector<HTMLElement>('.pinterest-board-column')!;
    column.dispatchEvent(dragEvent('dragover', 250));
    expect(articles[2]!.classList.contains('pinterest-board-drop-before')).toBe(true);
    column.dispatchEvent(dragEvent('drop', 250));
    expect(actions.move).toHaveBeenCalledWith(file, 'a', 0, 'c');
  });

  it('cancels dragging without writes and ignores unrelated external drops', async () => {
    const { view, actions } = await openBoard(addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'local', file: 'Photos/a.jpg', title: 'Photo' },
    ]));
    const article = view.contentEl.querySelector('article')!;
    article.dispatchEvent(dragEvent('dragstart'));
    article.dispatchEvent(dragEvent('dragend'));
    view.contentEl.querySelector('.pinterest-board-column')!.dispatchEvent(dragEvent('drop'));
    expect(actions.move).not.toHaveBeenCalled();
    expect(article.classList.contains('is-dragging')).toBe(false);
  });

  const touchEvent = (type: string, x = 20, y = 20): Event => Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    touches: type === 'touchend' ? [] : [{ identifier: 1, clientX: x, clientY: y }],
    changedTouches: [{ identifier: 1, clientX: x, clientY: y }],
  });

  it('supports touch dragging by holding the photo, and keyboard reordering without a grip', async () => {
    const { view, actions, file } = await openBoard(addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'local', file: 'Photos/a.jpg', title: 'Photo' },
    ]));
    const media = view.contentEl.querySelector<HTMLButtonElement>('.pinterest-board-image-button')!;
    const column = view.contentEl.querySelectorAll<HTMLElement>('.pinterest-board-column')[3]!;
    const spy = vi.spyOn(view.contentEl.ownerDocument, 'elementFromPoint').mockReturnValue(column);
    vi.useFakeTimers();
    media.dispatchEvent(touchEvent('touchstart'));
    vi.advanceTimersByTime(450);
    vi.useRealTimers();
    media.dispatchEvent(touchEvent('touchmove', 500, 200));
    media.dispatchEvent(touchEvent('touchend', 500, 200));
    expect(actions.move).toHaveBeenCalledWith(file, 'a', 3, null);
    await vi.waitFor(() => expect(view.contentEl.querySelector('.is-dragging')).toBeNull());
    // Let the pending save/reload settle before beginning a second move.
    await new Promise(resolve => setTimeout(resolve, 0));
    view.contentEl.querySelector('.pinterest-board-card')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(actions.move).toHaveBeenCalledWith(file, 'a', 1, null);
    spy.mockRestore();
  });

  it('does not start a photo drag during normal touch scrolling or after view unload', async () => {
    const { view, actions } = await openBoard(addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'local', file: 'Photos/a.jpg', title: 'Photo' },
    ]));
    const media = view.contentEl.querySelector<HTMLButtonElement>('.pinterest-board-image-button')!;
    vi.useFakeTimers();
    try {
      media.dispatchEvent(touchEvent('touchstart'));
      const scroll = touchEvent('touchmove', 20, 50);
      media.dispatchEvent(scroll);
      vi.advanceTimersByTime(500);
      expect(scroll.defaultPrevented).toBe(false);
      expect(view.contentEl.querySelector('.is-dragging')).toBeNull();
      media.dispatchEvent(touchEvent('touchstart'));
      await view.onUnloadFile();
      vi.advanceTimersByTime(500);
      expect(actions.move).not.toHaveBeenCalled();
      expect(view.contentEl.children).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
  it('shows exactly four columns and four central plus frames, without Canvas', async () => {
    const { view, actions, file } = await openBoard(createBoardData('Tattoo-Ideen'));
    expect(view.getViewType()).toBe('pinterest-image-board');
    expect(view.canAcceptExtension('pboard')).toBe(true);
    expect(view.canAcceptExtension('canvas')).toBe(false);
    expect(view.contentEl.querySelectorAll('.pinterest-board-column')).toHaveLength(4);
    const buttons = view.contentEl.querySelectorAll<HTMLButtonElement>('.pinterest-board-add');
    expect(buttons).toHaveLength(4);
    expect(view.contentEl.querySelectorAll('[data-icon="plus"]')).toHaveLength(4);
    buttons[2]!.click();
    expect(actions.add).toHaveBeenCalledWith(file, 2);
    expect(view.contentEl.querySelector('.canvas-wrapper')).toBeNull();
  });

  it('renders local and online images in their selected columns and keeps plus slots', async () => {
    const board = addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 1, kind: 'local', file: 'Photos/a.jpg', title: 'Local' },
      { id: 'b', column: 3, kind: 'remote', url: 'https://i.pinimg.com/a.jpg', title: '<script>unsafe</script>' },
    ]);
    const { view } = await openBoard(board);
    const columns = view.contentEl.querySelectorAll('.pinterest-board-column');
    expect(columns[0]!.querySelectorAll('article')).toHaveLength(0);
    expect(columns[1]!.querySelector('img')?.getAttribute('src')).toBe('app://local/Photos/a.jpg');
    expect(columns[3]!.querySelector('img')?.getAttribute('src')).toBe('https://i.pinimg.com/a.jpg');
    expect(view.contentEl.querySelectorAll('.pinterest-board-add')).toHaveLength(4);
    expect(view.contentEl.querySelector('script')).toBeNull();
    expect(view.contentEl.textContent).toContain('<script>unsafe</script>');
  });

  it('reports broken image links inside the card without losing the plus frame', async () => {
    const board = addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'remote', url: 'https://i.pinimg.com/gone.jpg', title: 'Photo' },
    ]);
    const { view } = await openBoard(board);
    const image = view.contentEl.querySelector('img')!;
    image.dispatchEvent(new Event('error'));
    expect(image.hidden).toBe(true);
    expect(view.contentEl.querySelector<HTMLElement>('.pinterest-board-image-error')!.hidden).toBe(false);
    expect(view.contentEl.querySelectorAll('.pinterest-board-add')).toHaveLength(4);
  });

  it('removes only the selected card through the persisted board action', async () => {
    const board = addBoardCards(createBoardData('Board'), [
      { id: 'a', column: 0, kind: 'local', file: 'Photos/a.jpg', title: 'Photo' },
    ]);
    const { view, actions, file } = await openBoard(board);
    view.contentEl.querySelector<HTMLButtonElement>('.pinterest-board-remove')!.click();
    expect(actions.remove).toHaveBeenCalledWith(file, 'a');
  });
});
