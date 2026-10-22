import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile, type App, type TFolder } from 'obsidian';
import { BoardController } from '../src/boards';
import { moveBoardCard, parseBoard, updateBoardCaption } from '../src/board-data';
import { pinText } from '../src/canvas';
import { setLanguage } from '../src/i18n';

beforeEach(() => { setLanguage('de'); });

function vaultFixture() {
  const files = new Map<string, TFile>();
  const content = new Map<TFile, string>();
  const makeFile = (path: string, raw: string): TFile => {
    const file = new TFile();
    file.path = path;
    file.name = path.split('/').pop()!;
    file.extension = file.name.split('.').pop()!;
    file.basename = file.name.slice(0, -(file.extension.length + 1));
    file.parent = { path: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '' } as TFolder;
    files.set(path, file);
    content.set(file, raw);
    return file;
  };
  const openFile = vi.fn().mockResolvedValue(undefined);
  const vault = {
    getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    getFiles: vi.fn(() => [...files.values()]),
    read: vi.fn(async (file: TFile) => content.get(file)!),
    create: vi.fn(async (path: string, raw: string) => makeFile(path, raw)),
    createBinary: vi.fn(async (path: string, _bytes: ArrayBuffer) => makeFile(path, '[image bytes]')),
    process: vi.fn(async (file: TFile, change: (raw: string) => string) => {
      const updated = change(content.get(file)!);
      content.set(file, updated);
      return updated;
    }),
  };
  const app = {
    vault,
    workspace: { getLeaf: vi.fn(() => ({ openFile })) },
    fileManager: { getAvailablePathForAttachment: vi.fn(async (name: string) => `Attachments/${name}`) },
    metadataCache: { getFirstLinkpathDest: vi.fn((path: string) => files.get(path) ?? null) },
  };
  const controller = new BoardController(app as unknown as App);
  return { controller, files, content, makeFile, vault, app, openFile };
}

describe('board creation and persistence', () => {
  it('persists caption edits and reordered columns across reloads without altering images', async () => {
    const { controller, files, content, vault } = vaultFixture();
    await controller.create(null);
    const file = files.get('Neues Bilderboard.pboard')!;
    await controller.saveImages(file, 0, ['https://example.org/a.jpg', 'https://example.org/b.jpg'], [], [], '', new Map(), () => {});
    const [a, b] = parseBoard(content.get(file)!).cards;
    await controller.update(file, board => updateBoardCaption(board, a!.id, 'My new caption'));
    await controller.update(file, board => moveBoardCard(board, a!.id, 3, null));
    const reloaded = parseBoard(content.get(file)!);
    expect(reloaded.cards.find(card => card.id === a!.id)).toMatchObject({ title: 'My new caption', column: 3, url: 'https://example.org/a.jpg' });
    expect(reloaded.cards.find(card => card.id === b!.id)!.column).toBe(0);
    expect(vault.createBinary).not.toHaveBeenCalled();
  });
  it('converts a note into a separate dedicated board and preserves the original note', async () => {
    const { controller, makeFile, files, content, openFile } = vaultFixture();
    const note = makeFile('Ideas/Tattoos.md', '# Tattoos\nMy notes stay intact.');
    await controller.create(note);
    const file = files.get('Ideas/Tattoos Board.pboard')!;
    expect(file).toBeDefined();
    const board = parseBoard(content.get(file)!);
    expect(board.sourceNote).toBe(note.path);
    expect(board.cards).toEqual([]);
    expect(content.get(note)).toBe('# Tattoos\nMy notes stay intact.');
    expect([...files.keys()].some(path => path.endsWith('.canvas'))).toBe(false);
    expect(openFile).toHaveBeenCalledWith(file);
  });

  it('adds online images without creating binary attachments, then reloads them from disk', async () => {
    const { controller, files, content, vault } = vaultFixture();
    await controller.create(null);
    const boardFile = files.get('Neues Bilderboard.pboard')!;
    await controller.saveImages(boardFile, 2, ['https://images.example.org/tattoo.jpg'], [], [],
      'My tattoo idea', new Map(), () => {});
    const saved = parseBoard(content.get(boardFile)!);
    expect(saved.cards[0]).toMatchObject({ column: 2, kind: 'remote', title: 'My tattoo idea',
      url: 'https://images.example.org/tattoo.jpg' });
    expect(vault.createBinary).not.toHaveBeenCalled();
    await controller.update(boardFile, board => ({ ...board, cards: [] }));
    expect(parseBoard(content.get(boardFile)!).cards).toEqual([]);
  });

  it('uses existing vault photos and copies device uploads only once', async () => {
    const { controller, makeFile, files, content, vault } = vaultFixture();
    await controller.create(null);
    const boardFile = files.get('Neues Bilderboard.pboard')!;
    const photo = makeFile('Photos/existing.jpg', '[existing image]');
    const upload = new File([new Uint8Array([1, 2, 3])], 'new.jpg', { type: 'image/jpeg' });
    const cache = new Map<File, TFile>();
    await controller.saveImages(boardFile, 1, [], [photo], [upload], '', cache, () => {});
    expect(vault.createBinary).toHaveBeenCalledTimes(1);
    expect(parseBoard(content.get(boardFile)!).cards.map(card => card.file))
      .toEqual(['Photos/existing.jpg', 'Attachments/new.jpg']);
    // An identical selection reused by a retry uses the copied file, not another download.
    await controller.saveImages(boardFile, 3, [], [], [upload], '', cache, () => {});
    expect(vault.createBinary).toHaveBeenCalledTimes(1);
  });

  it('migrates pictures from the earlier Canvas without modifying it', async () => {
    const { controller, makeFile, files, content } = vaultFixture();
    makeFile('Photos/a.jpg', '[image]');
    const raw = JSON.stringify({ nodes: [
      { id: 'local', type: 'file', file: 'Photos/a.jpg', x: 0, y: 0, width: 320, height: 300 },
      { id: 'remote', type: 'text', x: 344, y: 0, width: 320, height: 400,
        text: pinText({ id: '123', title: 'A [title]', imageUrl: 'https://i.pinimg.com/a.jpg', link: '', width: 600, height: 800 }) },
    ], edges: [] });
    const source = makeFile('Old.canvas', raw);
    await controller.fromCanvas(source);
    const board = parseBoard(content.get(files.get('Old Board.pboard')!)!);
    expect(board.cards).toHaveLength(2);
    expect(board.cards[0]!.file).toBe('Photos/a.jpg');
    expect(board.cards[1]!.url).toBe('https://i.pinimg.com/a.jpg');
    expect(content.get(source)).toBe(raw);
  });

  it('stops writes after plugin unload and does not overwrite existing boards', async () => {
    const { controller, files } = vaultFixture();
    await controller.create(null);
    await controller.create(null);
    expect(files.has('Neues Bilderboard.pboard')).toBe(true);
    expect(files.has('Neues Bilderboard 2.pboard')).toBe(true);
    controller.dispose();
    await expect(controller.create(null)).rejects.toThrow('nicht mehr aktiv');
  });
});
