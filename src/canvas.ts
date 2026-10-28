import type { CanvasData } from './types';

/** Parse a Canvas only to extract recognizable images into a new Cloudboard. */
export function parseCanvas(raw: string): CanvasData {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid Canvas JSON.');
  const canvas = value as CanvasData;
  if (!Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges) ||
    !canvas.nodes.every(node => node && typeof node.id === 'string' &&
      [node.x, node.y, node.width, node.height].every(Number.isFinite)) ||
    !canvas.edges.every(edge => edge && typeof edge.id === 'string' &&
      typeof edge.fromNode === 'string' && typeof edge.toNode === 'string')) {
    throw new Error('Invalid Canvas structure; file was not changed.');
  }
  return canvas;
}
