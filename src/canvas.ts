import type { CanvasData, CanvasNode, Pin, PinterestMetadata } from './types';

export const COLUMN_WIDTH = 320;
const GAP = 24;
const COLUMNS = 4;

export function parseCanvas(raw: string): CanvasData {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid Canvas JSON.');
  const canvas = value as CanvasData;
  if (!Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges) ||
    !canvas.nodes.every(n => n && typeof n.id === 'string' &&
      [n.x, n.y, n.width, n.height].every(Number.isFinite)) ||
    !canvas.edges.every(e => e && typeof e.id === 'string' &&
      typeof e.fromNode === 'string' && typeof e.toNode === 'string')) {
    throw new Error('Invalid Canvas structure; file was not changed.');
  }
  return canvas;
}

export function isMetadata(value: unknown): value is PinterestMetadata {
  if (!value || typeof value !== 'object') return false;
  const m = value as PinterestMetadata;
  return m.version === 1 && typeof m.pinterestUrl === 'string' &&
    typeof m.lastSynced === 'string' && !!m.pins && typeof m.pins === 'object' &&
    !Array.isArray(m.pins) && Object.entries(m.pins).every(([id, p]) =>
      /^\d+$/.test(id) && p && typeof p.nodeId === 'string' && typeof p.text === 'string');
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}\[\]<>!#|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

export function pinText(pin: Pin, imageMarkdown?: string): string {
  return `${imageMarkdown ?? `![${escapeMarkdown(pin.title)}](<${pin.imageUrl}>)`}\n\n` +
    `**${escapeMarkdown(pin.title || 'Pinterest Pin')}**\n\n` +
    `[Pinterest](https://www.pinterest.com/pin/${pin.id}/)` +
    (pin.link ? ` · [Open source](<${pin.link}>)` : '');
}

/** Pure reconciliation: unknown fields/nodes survive; only owned nodes are removed. */
export function reconcile(
  canvas: CanvasData,
  previous: PinterestMetadata,
  pins: Pin[],
  texts: Map<string, string>,
  now = new Date().toISOString(),
): CanvasData {
  const incoming = new Set(pins.map(p => p.id));
  const removed = new Set(Object.entries(previous.pins)
    .filter(([id]) => !incoming.has(id)).map(([, ref]) => ref.nodeId));
  const nodes = canvas.nodes.filter(n => !removed.has(n.id)).map(n => ({ ...n }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const references: PinterestMetadata['pins'] = {};
  const originX = nodes.length ? Math.min(0, ...nodes.map(n => n.x)) : 0;
  const bottom = nodes.length ? Math.max(...nodes.map(n => n.y + n.height)) + GAP : 0;
  const heights = Array<number>(COLUMNS).fill(bottom);
  const ids = new Set(nodes.map(n => n.id));
  for (const pin of pins) {
    const text = texts.get(pin.id);
    if (text === undefined) throw new Error(`Missing prepared content for pin ${pin.id}.`);
    const old = previous.pins[pin.id];
    let node = old ? byId.get(old.nodeId) : undefined;
    if (node) {
      // Keep manual text edits while the generated content remains unchanged.
      if (old?.text !== text && node.type === 'text') node.text = text;
    } else {
      const column = heights.indexOf(Math.min(...heights));
      let id = `pinterest-${pin.id}`;
      for (let suffix = 1; ids.has(id); suffix++) id = `pinterest-${pin.id}-${suffix}`;
      ids.add(id);
      const height = Math.round(Math.min(900, Math.max(160,
        (COLUMN_WIDTH - 32) * pin.height / pin.width)) + 130);
      node = {
        id, type: 'text', text,
        x: originX + column * (COLUMN_WIDTH + GAP), y: heights[column]!,
        width: COLUMN_WIDTH, height,
      };
      heights[column] = node.y + height + GAP;
      nodes.push(node);
    }
    references[pin.id] = { nodeId: node.id, text };
  }
  return {
    ...canvas, nodes,
    edges: canvas.edges.filter(e => !removed.has(e.fromNode) && !removed.has(e.toNode)),
    pinterest: { version: 1, pinterestUrl: previous.pinterestUrl, lastSynced: now, pins: references },
  };
}
