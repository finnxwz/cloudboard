import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile, type App, type TFolder } from 'obsidian';
import { BoardController } from '../src/boards';
import { moveBoardCard, parseBoard, updateBoardCaption } from '../src/board-data';
import { setLanguage } from '../src/i18n';

beforeEach(() => { setLanguage('de'); });

function vaultFixture() {
  const files = new Map<string, TFile>();
  const folders = new Set<string>();
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
    getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? (folders.has(path) ? { path } : null)),
    getFiles: vi.fn(() => [...files.values()]),
    read: vi.fn(async (file: TFile) => content.get(file)!),
    create: vi.fn(async (path: string, raw: string) => makeFile(path, raw)),
    createFolder: vi.fn(async (path: string) => { folders.add(path); }),
    createBinary: vi.fn(async (path: string, _bytes: ArrayBuffer) => makeFile(path, '[image bytes]')),
    process: vi.fn(async (file: TFile, change: (raw: string) => string) => {
      const updated = change(content.get(file)!);
      content.set(file, updated);
      return updated;
    }),
  };
  const trashFile = vi.fn(async (file: TFile) => { files.delete(file.path); });
  const app = {
    vault,
    workspace: { getLeaf: vi.fn(() => ({ openFile })) },
    fileManager: { trashFile },
    metadataCache: { getFirstLinkpathDest: vi.fn((path: string) => files.get(path) ?? null) },
  };
  const controller = new BoardController(app as unknown as App);
  return { controller, files, content, makeFile, vault, app, openFile, trashFile };
}

describe('board creation and persistence', () => {
  it('persists caption edits and reordered columns across reloads without altering images', async () => {
    const { controller, files, content, vault } = vaultFixture();
    await controller.create();
    const file = files.get('Neues Bilderboard.cloud')!;
    expect(parseBoard(content.get(file)!).columns).toBe(4);
    await controller.saveImages(file, 0, ['https://example.org/a.jpg', 'https://example.org/b.jpg'], [], [], '', new Map(), () => {});
    const [a, b] = parseBoard(content.get(file)!).cards;
    await controller.update(file, board => updateBoardCaption(board, a!.id, 'My new caption'));
    await controller.update(file, board => moveBoardCard(board, a!.id, 3, null));
    const reloaded = parseBoard(content.get(file)!);
    expect(reloaded.cards.find(card => card.id === a!.id)).toMatchObject({ title: 'My new caption', column: 3, url: 'https://example.org/a.jpg' });
    expect(reloaded.cards.find(card => card.id === b!.id)!.column).toBe(0);
    expect(vault.createBinary).not.toHaveBeenCalled();
  });
  it('creates a standalone board in the current folder without linking or changing a note', async () => {
    const { controller, makeFile, files, content, openFile } = vaultFixture();
    const note = makeFile('Ideas/Tattoos.md', '# Tattoos\nMy notes stay intact.');
    await controller.create('Ideas');
    const file = files.get('Ideas/Neues Bilderboard.cloud')!;
    expect(file).toBeDefined();
    const board = parseBoard(content.get(file)!);
    expect(board.sourceNote).toBeUndefined();
    expect(board.cards).toEqual([]);
    expect(content.get(note)).toBe('# Tattoos\nMy notes stay intact.');
    expect([...files.keys()].some(path => path.endsWith('.canvas'))).toBe(false);
    expect(openFile).toHaveBeenCalledWith(file);
  });

  it('replaces a note with a same-named board only after the board opens successfully', async () => {
    const { controller, makeFile, files, content, openFile, trashFile } = vaultFixture();
    const note = makeFile('Ideas/Tattoos.md', '# Tattoos\nThis note becomes a board.');
    await controller.convert(note, 5);
    const file = files.get('Ideas/Tattoos.cloud')!;
    expect(file).toBeDefined();
    expect(parseBoard(content.get(file)!)).toMatchObject({ title: 'Tattoos', columns: 5, cards: [] });
    expect(files.has(note.path)).toBe(false);
    expect(trashFile).toHaveBeenCalledWith(note);
    expect(openFile.mock.invocationCallOrder[0]).toBeLessThan(trashFile.mock.invocationCallOrder[0]!);
  });

  it('keeps the source note when board creation fails', async () => {
    const { controller, makeFile, files, vault, trashFile } = vaultFixture();
    const note = makeFile('Ideas/Tattoos.md', '# Keep me');
    vault.create.mockRejectedValueOnce(new Error('Disk full'));
    await expect(controller.convert(note)).rejects.toThrow('Disk full');
    expect(files.get(note.path)).toBe(note);
    expect(trashFile).not.toHaveBeenCalled();
  });

  it('uses the configured default column count for newly created boards', async () => {
    const { controller, files, content } = vaultFixture();
    await controller.create('', 2);
    const board = parseBoard(content.get(files.get('Neues Bilderboard.cloud')!)!);
    expect(board.columns).toBe(2);
  });

  it('adds online images without creating binary attachments, then reloads them from disk', async () => {
    const { controller, files, content, vault } = vaultFixture();
    await controller.create();
    const boardFile = files.get('Neues Bilderboard.cloud')!;
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
    await controller.create();
    const boardFile = files.get('Neues Bilderboard.cloud')!;
    const photo = makeFile('Photos/existing.jpg', '[existing image]');
    const upload = new File([new Uint8Array([1, 2, 3])], 'new.jpg', { type: 'image/jpeg' });
    const cache = new Map<File, TFile>();
    await controller.saveImages(boardFile, 1, [], [photo], [upload], '', cache, () => {});
    expect(vault.createBinary).toHaveBeenCalledTimes(1);
    expect(parseBoard(content.get(boardFile)!).cards.map(card => card.file))
      .toEqual(['Photos/existing.jpg', 'Cloudboard assets/Neues Bilderboard/new.jpg']);
    expect(vault.createFolder).toHaveBeenCalledWith('Cloudboard assets');
    expect(vault.createFolder).toHaveBeenCalledWith('Cloudboard assets/Neues Bilderboard');
    // An identical selection reused by a retry uses the copied file, not another download.
    await controller.saveImages(boardFile, 3, [], [], [upload], '', cache, () => {});
    expect(vault.createBinary).toHaveBeenCalledTimes(1);
  });

  it('keeps same-named device photos separate inside the board asset folder', async () => {
    const { controller, files, content } = vaultFixture();
    await controller.create();
    const boardFile = files.get('Neues Bilderboard.cloud')!;
    const first = new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' });
    const second = new File([new Uint8Array([2])], 'photo.jpg', { type: 'image/jpeg' });
    await controller.saveImages(boardFile, 0, [], [], [first], '', new Map(), () => {});
    await controller.saveImages(boardFile, 0, [], [], [second], '', new Map(), () => {});
    expect(parseBoard(content.get(boardFile)!).cards.map(card => card.file)).toEqual([
      'Cloudboard assets/Neues Bilderboard/photo.jpg',
      'Cloudboard assets/Neues Bilderboard/photo 2.jpg',
    ]);
  });

  it('migrates pictures from the earlier Canvas without modifying it', async () => {
    const { controller, makeFile, files, content } = vaultFixture();
    makeFile('Photos/a.jpg', '[image]');
    const raw = JSON.stringify({ nodes: [
      { id: 'local', type: 'file', file: 'Photos/a.jpg', x: 0, y: 0, width: 320, height: 300 },
      { id: 'remote', type: 'text', x: 344, y: 0, width: 320, height: 400,
        text: '![A title](<https://i.pinimg.com/a.jpg>)' },
    ], edges: [] });
    const source = makeFile('Old.canvas', raw);
    await controller.fromCanvas(source);
    const board = parseBoard(content.get(files.get('Old Board.cloud')!)!);
    expect(board.cards).toHaveLength(2);
    expect(board.cards[0]!.file).toBe('Photos/a.jpg');
    expect(board.cards[1]!.url).toBe('https://i.pinimg.com/a.jpg');
    expect(content.get(source)).toBe(raw);
  });

  it('stops writes after plugin unload and does not overwrite existing boards', async () => {
    const { controller, files } = vaultFixture();
    await controller.create();
    await controller.create();
    expect(files.has('Neues Bilderboard.cloud')).toBe(true);
    expect(files.has('Neues Bilderboard 2.cloud')).toBe(true);
    controller.dispose();
    await expect(controller.create()).rejects.toThrow('nicht mehr aktiv');
  });
});
