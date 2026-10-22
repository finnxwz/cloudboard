import { requestUrl } from 'obsidian';
import type { Pin } from './types';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
}

export function isPinterestHostname(host: string): boolean {
  return /^(?:[a-z]{2,3}\.)?pinterest\.(?:com|de|at|ch|fr|it|es|pt|nl|be|ca|jp|cl|dk|se|ie|co\.uk|com\.au|com\.mx|com\.br|co\.kr|nz)$/.test(host.toLowerCase());
}

export function normalizeBoardUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Please enter a valid Pinterest board URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
    !isPinterestHostname(host)) {
    throw new Error('Use an HTTPS Pinterest board URL (not a shortened pin.it link).');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts.some(p => !/^[\p{L}\p{N}_%.-]+$/u.test(p)) ||
    ['pin', 'search', 'ideas', 'settings', 'login', 'today', 'business'].includes(parts[0]!.toLowerCase())) {
    throw new Error('Use a board URL: https://www.pinterest.com/username/boardname/');
  }
  return `https://www.pinterest.com/${parts[0]}/${parts[1]}/`;
}

function safeUrl(value: unknown, image = false): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (image && (url.protocol !== 'https:' || !/(^|\.)pinimg\.com$/i.test(url.hostname))) return '';
    return url.href.replace(/[<>]/g, c => encodeURIComponent(c));
  } catch { return ''; }
}

export function parsePin(value: unknown): Pin | null {
  const pin = object(value);
  if (!/^\d+$/.test(String(pin.id ?? ''))) return null;
  // BoardFeed may include recommendation/promoted modules; never treat them as pins.
  if (pin.type && pin.type !== 'pin') return null;
  const images = object(pin.images);
  const candidates = Object.values(images).map(object)
    .filter(i => safeUrl(i.url, true))
    .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0));
  const image = candidates[0];
  if (!image) throw new Error(`Pin ${String(pin.id)} has no supported image. Board was not changed.`);
  const width = Number(image.width);
  const height = Number(image.height);
  return {
    id: String(pin.id),
    title: [pin.title, pin.grid_title, pin.description].find(v => typeof v === 'string' && v.trim()) as string || 'Pinterest Pin',
    imageUrl: safeUrl(image.url, true), link: safeUrl(pin.link),
    width: Number.isFinite(width) && width > 0 ? width : 600,
    height: Number.isFinite(height) && height > 0 ? height : 800,
  };
}

async function request(url: string, json: boolean): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      requestUrl({ url, throw: false, headers: {
        Accept: json ? 'application/json' : 'text/html',
        ...(json ? { 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-AppState': 'active' } : {}),
      } }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Pinterest request timed out. Please try again later.')), 45_000);
      }),
    ]);
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error(`Board unavailable (HTTP ${response.status}). It may be private, deleted, or require a login.`);
    }
    if (response.status === 429) throw new Error('Pinterest rate limit reached. Please try again later.');
    if (response.status < 200 || response.status >= 300) throw new Error(`Pinterest returned HTTP ${response.status}.`);
    if (!json) return response.text;
    try { return JSON.parse(response.text) as unknown; }
    catch { throw new Error('Pinterest returned no JSON (login or anti-bot protection).'); }
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

async function resource(name: string, boardUrl: string, options: ObjectValue): Promise<ObjectValue> {
  const data = encodeURIComponent(JSON.stringify({ options, context: {} }));
  const source = encodeURIComponent(new URL(boardUrl).pathname);
  const response = object(await request(`https://www.pinterest.com/resource/${name}/get/?source_url=${source}&data=${data}`, true));
  const result = object(response.resource_response);
  if (result.status !== 'success' || result.error) {
    throw new Error('Pinterest could not return the public board. It may be private or blocked.');
  }
  return response;
}

function findBoard(value: unknown, path: string, depth = 0): ObjectValue | undefined {
  if (depth > 25 || !value || typeof value !== 'object') return;
  const entry = object(value);
  if (/^\d+$/.test(String(entry.id ?? '')) && typeof entry.url === 'string') {
    try {
      if (new URL(entry.url, 'https://www.pinterest.com').pathname.replace(/\/$/, '') === path.replace(/\/$/, '') &&
        (entry.type === 'board' || 'pin_count' in entry)) return entry;
    } catch { /* Not a URL. */ }
  }
  for (const child of Object.values(value)) {
    const found = findBoard(child, path, depth + 1);
    if (found) return found;
  }
}

async function resolveBoard(url: string): Promise<ObjectValue> {
  const [, username, slug] = new URL(url).pathname.split('/');
  let resourceFailure = 'The response contained no board ID.';
  try {
    const response = await resource('BoardResource', url, { username, slug, field_set_key: 'detailed' });
    const board = object(object(response.resource_response).data);
    if (/^\d+$/.test(String(board.id ?? ''))) return board;
  } catch (error) {
    // Keep the original reason instead of disguising every failure as missing metadata.
    resourceFailure = error instanceof Error ? error.message : String(error);
  }
  const html = String(await request(url, false));
  let loginRequired = false;
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try {
      const data: unknown = JSON.parse(match[1]!);
      const board = findBoard(data, new URL(url).pathname);
      if (board) return board;
      // Current Pinterest pages can return HTTP 200 with a completely empty
      // board store. The explicit rollout flag distinguishes this login wall
      // from an unknown hydration format. A normal header login button does not.
      const root = object(data);
      const context = object(root.context);
      const active = object(object(root.experiments).active);
      const lockdown = active.lop_unauth_lockdown_board;
      if (context.is_authenticated === false && typeof lockdown === 'string' && lockdown.startsWith('enabled')) {
        loginRequired = true;
      }
    } catch { /* Only hydration scripts contain JSON. */ }
  }
  if (loginRequired) {
    throw new Error('Pinterest requires sign-in to expose this board to the plugin. ' +
      'The page contains a login wall instead of board data, even though the board may be public. ' +
      'Signing in in your normal browser does not sign this plugin in. ' +
      'This version does not support Pinterest sign-in. No canvas was changed.');
  }
  throw new Error('No public board metadata found. Board request: ' + resourceFailure +
    ' The page also contained no matching board data. The board may require sign-in, be unavailable, ' +
    'or use an unsupported Pinterest response format. No canvas was changed.');
}

/** Only returns a complete board. Partial responses must never trigger removals. */
export async function fetchBoard(input: string): Promise<Pin[]> {
  const url = normalizeBoardUrl(input);
  const board = await resolveBoard(url);
  if (board.privacy === 'secret' || board.privacy === 'private') throw new Error('Private boards are not supported.');
  const expected = typeof board.pin_count === 'number' ? board.pin_count : undefined;
  const pins = new Map<string, Pin>();
  const seen = new Set<string>();
  let bookmark: string | undefined;
  for (let page = 0; page < 500; page++) {
    const response = await resource('BoardFeedResource', url, {
      board_id: String(board.id), board_url: new URL(url).pathname,
      page_size: 100, field_set_key: 'react_grid_pin',
      // Prevent Pinterest's "more ideas" feed from being imported as board pins.
      prepend: false, ...(bookmark ? { bookmarks: [bookmark] } : {}),
    });
    const result = object(response.resource_response);
    if (!Array.isArray(result.data)) throw new Error('Unexpected Pinterest feed format; canvas was not changed.');
    for (const value of result.data) {
      const raw = object(value);
      if (raw.is_promoted || raw.promoted_is_removable) continue;
      const pin = parsePin(value);
      if (pin) pins.set(pin.id, pin);
    }
    const options = object(object(response.resource).options);
    const bookmarks = Array.isArray(options.bookmarks) ? options.bookmarks : [];
    const next = typeof result.bookmark === 'string' ? result.bookmark : bookmarks[0];
    if (next === '-end-' || (expected === 0 && result.data.length === 0)) {
      if (expected !== undefined && pins.size !== expected) {
        throw new Error(`Incomplete or changing board (${pins.size}/${expected} pins). Nothing was changed; retry later.`);
      }
      return [...pins.values()];
    }
    if (typeof next !== 'string' || !next || seen.has(next)) {
      throw new Error('Pinterest pagination was incomplete. Existing pins were preserved.');
    }
    seen.add(next);
    bookmark = next;
  }
  throw new Error('Board exceeds the safety limit of 500 pages; no changes were made.');
}
