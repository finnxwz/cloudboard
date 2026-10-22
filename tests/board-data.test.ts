import { beforeEach, describe, expect, it } from 'vitest';
import { addBoardCards, createBoardData, moveBoardCard, newCardId, parseBoard, removeBoardCard, renameBoardPaths, updateBoardCaption, type BoardCard } from '../src/board-data';
import { validateUpload } from '../src/image-files';
import { setLanguage } from '../src/i18n';

beforeEach(() => { setLanguage('de'); });

const local = (id = 'a', column = 0): BoardCard => ({ id, column, kind: 'local', title: 'Foto', file: 'Photos/tattoo.jpg' });
const remote = (): BoardCard => ({ id: 'b', column: 3, kind: 'remote', title: 'Inspiration', url: 'https://i.pinimg.com/photo.jpg' });

describe('dedicated board storage (not Canvas)', () => {
  it('edits and clears captions without changing image references or source metadata', () => {
    const board = addBoardCards(createBoardData('Board'), [{ ...remote(), sourceUrl: 'https://www.pinterest.com/pin/123/' }]);
    const updated = updateBoardCaption(board, 'b', '  My caption  ');
    expect(updated.cards[0]).toEqual({ ...board.cards[0], title: 'My caption' });
    expect(board.cards[0]!.title).toBe('Inspiration');
    expect(updateBoardCaption(updated, 'b', '   ').cards[0]!.title).toBe('');
    expect(() => updateBoardCaption(board, 'removed', 'Caption')).toThrow('nicht mehr');
  });

  it('reorders cards upward and downward within one column', () => {
    const board = addBoardCards(createBoardData('Board'), ['a', 'b', 'c', 'd'].map(id => local(id)));
    expect(moveBoardCard(board, 'a', 0, 'c').cards.map(card => card.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveBoardCard(board, 'd', 0, 'a').cards.map(card => card.id)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveBoardCard(board, 'a', 0, null).cards.map(card => card.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveBoardCard(board, 'a', 0, 'a')).toBe(board);
    expect(board.cards.map(card => card.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('moves between columns, including empty columns, while preserving the other cards', () => {
    const board = addBoardCards(createBoardData('Board'), [local('a', 0), local('b', 1), local('c', 0), local('d', 1)]);
    const moved = moveBoardCard(board, 'c', 1, 'd');
    expect(moved.cards.filter(card => card.column === 1).map(card => card.id)).toEqual(['b', 'c', 'd']);
    expect(moved.cards.filter(card => card.column === 0).map(card => card.id)).toEqual(['a']);
    const empty = moveBoardCard(moved, 'a', 3, null);
    expect(empty.cards.find(card => card.id === 'a')).toEqual({ ...local('a'), column: 3 });
    expect(parseBoard(JSON.stringify(empty))).toEqual(empty);
  });

  it('refuses stale drop targets and never resurrects removed cards', () => {
    const board = addBoardCards(createBoardData('Board'), [local('a'), local('b', 1)]);
    expect(() => moveBoardCard(board, 'a', 1, 'gone')).toThrow('Zielkarte');
    expect(() => moveBoardCard(board, 'a', 0, 'b')).toThrow('Zielkarte');
    expect(() => moveBoardCard(board, 'gone', 0, null)).toThrow('nicht mehr');
    expect(() => moveBoardCard(board, 'a', 4, null)).toThrow('Zielspalte');
    expect(() => moveBoardCard(board, 'a', 1.5, null)).toThrow('Zielspalte');
  });
  it('creates a board with no Canvas nodes, edges, positions or sync metadata', () => {
    const board = createBoardData('Tattoo-Ideen', 'Tattoo-Ideen.md');
    expect(parseBoard(JSON.stringify(board))).toEqual(board);
    expect(board.cards).toEqual([]);
    expect(board.nodes).toBeUndefined();
    expect(board.edges).toBeUndefined();
    expect(board.pinterest).toBeUndefined();
  });

  it('adds images to selected fixed columns without mutating existing data', () => {
    const board = createBoardData('Board');
    board.custom = { keep: true };
    const next = addBoardCards(board, [local(), remote()]);
    expect(next.cards.map(card => card.column)).toEqual([0, 3]);
    expect(board.cards).toEqual([]);
    expect(next.custom).toEqual({ keep: true });
    expect(next.cards[1]!.file).toBeUndefined(); // remote URL is never a local attachment
  });

  it('removes only a board reference, leaving other images and paths intact', () => {
    const board = addBoardCards(createBoardData('Board'), [local(), remote()]);
    expect(removeBoardCard(board, 'b').cards).toEqual([local()]);
    expect(board.cards).toHaveLength(2);
  });

  it('updates vault image and source note links on folder renames, not remote URLs', () => {
    const board = addBoardCards(createBoardData('Board', 'Photos/Ideas.md'), [local(), remote()]);
    const renamed = renameBoardPaths(board, 'Photos', 'Attachments');
    expect(renamed.sourceNote).toBe('Attachments/Ideas.md');
    expect(renamed.cards[0]!.file).toBe('Attachments/tattoo.jpg');
    expect(renamed.cards[1]).toEqual(remote());
    expect(renameBoardPaths(board, 'Photo', 'Other')).toEqual(board);
  });

  it('refuses malformed, duplicate, out-of-column and unsafe cards', () => {
    expect(() => parseBoard('{')).toThrow();
    expect(() => parseBoard('{"nodes":[],"edges":[]}')).toThrow();
    const board = createBoardData('Board');
    for (const card of [local('a', 4), local('a', -1), local('a', 1.5),
      { ...local(), file: '../secret.jpg' }, { ...local(), file: 'C:\\secret.jpg' },
      { ...remote(), url: 'javascript:alert(1)' }, { ...remote(), sourceUrl: 'file:///tmp/a' }]) {
      expect(() => addBoardCards(board, [card])).toThrow();
    }
    expect(() => addBoardCards(board, [local(), local()])).toThrow();
  });

  it('generates unique IDs and validates local photo formats and size', () => {
    expect(new Set(Array.from({ length: 100 }, () => newCardId())).size).toBe(100);
    expect(() => validateUpload({ name: 'Photo.JPG', size: 1024 })).not.toThrow();
    expect(() => validateUpload({ name: 'Photo.HEIC', size: 1024 })).toThrow('kein HEIC/SVG');
    expect(() => validateUpload({ name: 'image.svg', size: 1024 })).toThrow();
    expect(() => validateUpload({ name: 'image.png', size: 0 })).toThrow();
    expect(() => validateUpload({ name: 'image.png', size: 26 * 1024 * 1024 })).toThrow('25 MB');
  });
});
