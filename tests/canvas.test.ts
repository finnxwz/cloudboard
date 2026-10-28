import { describe, expect, it } from 'vitest';
import { parseCanvas } from '../src/canvas';

describe('Canvas image-source validation', () => {
  it('accepts a valid Canvas while preserving unknown fields', () => {
    const canvas = parseCanvas(JSON.stringify({
      nodes: [{ id: 'image', type: 'file', file: 'Photos/a.jpg', x: 0, y: 0, width: 320, height: 240 }],
      edges: [], custom: { keep: true },
    }));
    expect(canvas.nodes).toHaveLength(1);
    expect(canvas.custom).toEqual({ keep: true });
  });

  it('rejects malformed JSON and invalid Canvas structures', () => {
    expect(() => parseCanvas('{')).toThrow();
    expect(() => parseCanvas('null')).toThrow('Invalid Canvas JSON');
    expect(() => parseCanvas('{"nodes":[{"id":"a"}],"edges":[]}')).toThrow('Invalid Canvas structure');
    expect(() => parseCanvas('{"nodes":[],"edges":[null]}')).toThrow('Invalid Canvas structure');
  });
});
