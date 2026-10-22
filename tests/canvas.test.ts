import { describe, expect, it } from 'vitest';
import { COLUMN_WIDTH, isMetadata, parseCanvas, pinText, reconcile } from '../src/canvas';
import type { CanvasData, Pin, PinterestMetadata } from '../src/types';

const pin = (id: string, height = 600): Pin => ({
  id, title: `Pin ${id}`, imageUrl: `https://i.pinimg.com/${id}.jpg`,
  link: 'https://example.org/', width: 600, height,
});
const anchor = (): PinterestMetadata => ({
  version: 1, pinterestUrl: 'https://www.pinterest.com/user/board/', lastSynced: '', pins: {},
});
const texts = (pins: Pin[]) => new Map(pins.map(p => [p.id, pinText(p)]));
const empty = (): CanvasData => ({ nodes: [], edges: [] });

describe('Canvas masonry and reconciliation', () => {
  it('places variable-height cards in the shortest of four columns without overlap', () => {
    const pins = Array.from({ length: 17 }, (_, i) => pin(String(i + 1), 300 + i * 71));
    const canvas = reconcile(empty(), anchor(), pins, texts(pins), '2026-01-01T00:00:00Z');
    expect(canvas.nodes).toHaveLength(17);
    expect(new Set(canvas.nodes.map(n => n.x)).size).toBe(4);
    for (const a of canvas.nodes) for (const b of canvas.nodes) {
      if (a.id === b.id || a.x !== b.x) continue;
      expect(a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
      expect(a.width).toBe(COLUMN_WIDTH);
    }
    expect(canvas.pinterest?.lastSynced).toBe('2026-01-01T00:00:00Z');
  });

  it('keeps positions, sizes, manual nodes, custom fields and unaffected edges', () => {
    const original = [pin('1'), pin('2')];
    const canvas = reconcile(empty(), anchor(), original, texts(original));
    canvas.nodes[0]!.x = -900;
    canvas.nodes[0]!.y = 473;
    canvas.nodes[0]!.width = 800;
    canvas.nodes[0]!.color = '3';
    canvas.nodes.push({ id: 'manual', type: 'text', text: 'mine', x: 1, y: 1, width: 20, height: 20 });
    canvas.edges = [
      { id: 'keep', fromNode: 'manual', toNode: 'pinterest-1' },
      { id: 'remove', fromNode: 'manual', toNode: 'pinterest-2' },
    ];
    canvas.custom = { keep: true };
    const updatedPins = [pin('1'), pin('3')];
    const updated = reconcile(canvas, canvas.pinterest!, updatedPins, texts(updatedPins));
    expect(updated.nodes.find(n => n.id === 'pinterest-1')).toMatchObject({ x: -900, y: 473, width: 800, color: '3' });
    expect(updated.nodes.find(n => n.id === 'manual')?.text).toBe('mine');
    expect(updated.nodes.some(n => n.id === 'pinterest-2')).toBe(false);
    expect(updated.edges.map(e => e.id)).toEqual(['keep']);
    expect(updated.custom).toEqual({ keep: true });
    expect(updated.nodes.find(n => n.id === 'pinterest-3')!.y).toBeGreaterThan(473);
    expect(canvas.nodes).toHaveLength(3); // no input mutation
  });

  it('supports fallback metadata after custom Canvas fields are stripped', () => {
    const pins = [pin('1')];
    const canvas = reconcile(empty(), anchor(), pins, texts(pins));
    const registry = canvas.pinterest!;
    delete canvas.pinterest;
    const updated = reconcile(canvas, registry, pins, texts(pins));
    expect(updated.nodes).toHaveLength(1);
    expect(isMetadata(updated.pinterest)).toBe(true);
  });

  it('preserves manual text edits on unchanged pins and updates changed titles', () => {
    const pins = [pin('1')];
    const canvas = reconcile(empty(), anchor(), pins, texts(pins));
    canvas.nodes[0]!.text = 'My annotation';
    expect(reconcile(canvas, canvas.pinterest!, pins, texts(pins)).nodes[0]!.text).toBe('My annotation');
    const changed = [{ ...pin('1'), title: 'New title' }];
    expect(reconcile(canvas, canvas.pinterest!, changed, texts(changed)).nodes[0]!.text).toContain('New title');
  });

  it('does not collide with unrelated node IDs', () => {
    const canvas = empty();
    canvas.nodes.push({ id: 'pinterest-1', type: 'text', text: 'mine', x: 0, y: 0, width: 10, height: 10 });
    const pins = [pin('1')];
    const next = reconcile(canvas, anchor(), pins, texts(pins));
    expect(next.pinterest!.pins['1']!.nodeId).toBe('pinterest-1-1');
  });

  it('removes only owned nodes when a board is genuinely empty', () => {
    const pins = [pin('1')];
    const canvas = reconcile(empty(), anchor(), pins, texts(pins));
    expect(reconcile(canvas, canvas.pinterest!, [], new Map()).nodes).toEqual([]);
  });

  it('validates JSON structure and metadata before mutation', () => {
    expect(() => parseCanvas('{')).toThrow();
    expect(() => parseCanvas('{"nodes":[{"id":"a"}],"edges":[]}')).toThrow();
    expect(() => parseCanvas('{"nodes":[],"edges":[null]}')).toThrow();
    expect(isMetadata({ version: 1, pinterestUrl: 'x', lastSynced: '', pins: { bad: {} } })).toBe(false);
  });
});
