import { imageUrl } from './image-links';
import { t } from './i18n';

export const BOARD_EXTENSION = 'cloud';
export const LEGACY_BOARD_EXTENSION = 'pboard';
export const BOARD_EXTENSIONS = [BOARD_EXTENSION, LEGACY_BOARD_EXTENSION] as const;
export const BOARD_VIEW_TYPE = 'cloudboard-view';
export type ColumnCount = 2 | 3 | 4 | 5;
export const DEFAULT_COLUMN_COUNT: ColumnCount = 4;

export function isBoardExtension(extension: string): boolean {
  return (BOARD_EXTENSIONS as readonly string[]).includes(extension.toLowerCase());
}

export interface BoardCard {
  id: string;
  column: number;
  title: string;
  kind: 'local' | 'remote';
  file?: string;
  url?: string;
  sourceUrl?: string;
}

export interface BoardData {
  type: 'pinterest-image-board';
  version: 1;
  title: string;
  createdAt: string;
  columns: ColumnCount;
  sourceNote?: string;
  cards: BoardCard[];
  [key: string]: unknown;
}

export function createBoardData(title: string, sourceNote?: string, columns: ColumnCount = DEFAULT_COLUMN_COUNT): BoardData {
  return { type: 'pinterest-image-board', version: 1, title,
    createdAt: new Date().toISOString(), columns, ...(sourceNote ? { sourceNote } : {}), cards: [] };
}

export function isColumnCount(value: unknown): value is ColumnCount {
  return Number.isInteger(value) && typeof value === 'number' && value >= 2 && value <= 5;
}

function vaultPath(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !/^[\\/]/.test(value) &&
    !/[\\:\u0000-\u001f]/.test(value) && !value.split('/').some(p => !p || p === '.' || p === '..');
}

export function parseBoard(raw: string): BoardData {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error(t('invalidBoard'));
  const board = value as BoardData;
  const columns = (board as { columns?: unknown }).columns ?? DEFAULT_COLUMN_COUNT;
  if (board.type !== 'pinterest-image-board' || board.version !== 1 ||
    typeof board.title !== 'string' || typeof board.createdAt !== 'string' ||
    !isColumnCount(columns) || (board.sourceNote !== undefined && !vaultPath(board.sourceNote)) || !Array.isArray(board.cards)) {
    throw new Error(t('unsupportedBoard'));
  }
  const ids = new Set<string>();
  for (const card of board.cards) {
    if (!card || typeof card.id !== 'string' || !card.id || ids.has(card.id) || typeof card.title !== 'string' ||
      !Number.isInteger(card.column) || card.column < 0 || card.column >= columns ||
      !['local', 'remote'].includes(card.kind) || (card.kind === 'local' && !vaultPath(card.file))) {
      throw new Error(t('invalidCard'));
    }
    if (card.kind === 'remote') {
      if (typeof card.url !== 'string') throw new Error(t('missingImageUrl'));
      imageUrl(card.url);
    }
    if (card.sourceUrl !== undefined) imageUrl(card.sourceUrl);
    ids.add(card.id);
  }
  return { ...board, columns };
}

export function newCardId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function addBoardCards(board: BoardData, cards: BoardCard[]): BoardData {
  const next = { ...board, cards: [...board.cards, ...cards] };
  return parseBoard(JSON.stringify(next));
}

export function removeBoardCard(board: BoardData, id: string): BoardData {
  return { ...board, cards: board.cards.filter(card => card.id !== id) };
}

export function updateBoardCaption(board: BoardData, id: string, title: string): BoardData {
  if (!board.cards.some(card => card.id === id)) throw new Error(t('cardMissing'));
  return { ...board, cards: board.cards.map(card => card.id === id ? { ...card, title: title.trim() } : card) };
}

/** beforeId is a stable anchor in the destination column, not a stale array index. */
export function moveBoardCard(board: BoardData, id: string, column: number, beforeId: string | null): BoardData {
  if (!Number.isInteger(column) || column < 0 || column >= board.columns) throw new Error(t('invalidColumn'));
  const card = board.cards.find(card => card.id === id);
  if (!card) throw new Error(t('cardMissing'));
  if (beforeId === id && column === card.column) return board;
  const cards = board.cards.filter(card => card.id !== id);
  let index: number;
  if (beforeId !== null) {
    index = cards.findIndex(card => card.id === beforeId && card.column === column);
    if (index < 0) throw new Error(t('targetCardChanged'));
  } else {
    index = cards.reduce((last, card, i) => card.column === column ? i + 1 : last, cards.length);
  }
  cards.splice(index, 0, { ...card, column });
  return { ...board, cards };
}

export function updateBoardColumns(board: BoardData, columns: number): BoardData {
  if (!isColumnCount(columns)) throw new Error(t('invalidColumnCount'));
  return parseBoard(JSON.stringify({
    ...board,
    columns,
    cards: board.cards.map(card => card.column < columns ? card : { ...card, column: columns - 1 }),
  }));
}

export function renameBoardPaths(board: BoardData, oldPath: string, newPath: string): BoardData {
  const rename = (path: string): string => path === oldPath || path.startsWith(`${oldPath}/`)
    ? newPath + path.slice(oldPath.length) : path;
  return {
    ...board,
    ...(board.sourceNote ? { sourceNote: rename(board.sourceNote) } : {}),
    cards: board.cards.map(card => card.kind === 'local' && card.file ? { ...card, file: rename(card.file) } : card),
  };
}
