import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/game/Terrain';

describe('Terrain', () => {
  it('generates solid ground', () => {
    const t = new Terrain(100, 200);
    t.generate(1);
    // There should be some solid pixels near the bottom
    let solidCount = 0;
    for (let x = 0; x < 100; x++) {
      if (t.isSolid(x, 190)) solidCount++;
    }
    expect(solidCount).toBeGreaterThan(0);
  });

  it('has air above terrain surface', () => {
    const t = new Terrain(200, 300);
    t.generate(42);
    // The very top row (y=0) should be all air
    for (let x = 0; x < 200; x++) {
      expect(t.isSolid(x, 0)).toBe(false);
    }
  });

  it('destroy() carves a hole', () => {
    const t = new Terrain(200, 300);
    t.generate(7);
    // Find a solid pixel
    const cx = 100;
    const cy = t.surfaceY(cx) + 10;

    // Ensure the center is solid before carving
    // (surfaceY + 10 should be inside terrain)
    expect(t.isSolid(cx, cy)).toBe(true);

    t.destroy(cx, cy, 20);

    // Center should now be air
    expect(t.isSolid(cx, cy)).toBe(false);

    // Pixel far from center should not be carved
    expect(t.isSolid(cx, Math.min(cy + 50, 295))).toBe(true);
  });

  it('surfaceY() returns correct height', () => {
    const t = new Terrain(100, 200);
    t.generate(99);
    for (let x = 10; x < 90; x += 10) {
      const sy = t.surfaceY(x);
      // surfaceY should be solid
      expect(t.isSolid(x, sy)).toBe(true);
      // one pixel above should be air (if not at y=0)
      if (sy > 0) {
        expect(t.isSolid(x, sy - 1)).toBe(false);
      }
    }
  });

  it('handles out-of-bounds gracefully', () => {
    const t = new Terrain(100, 200);
    t.generate();
    expect(t.isSolid(-1, 50)).toBe(false);
    expect(t.isSolid(200, 50)).toBe(false);
    expect(t.isSolid(50, -1)).toBe(false);
    expect(t.isSolid(50, 300)).toBe(false);
    // surfaceY out of bounds returns height
    expect(t.surfaceY(-1)).toBe(200);
    expect(t.surfaceY(200)).toBe(200);
  });

  it('getBitmap() returns a copy, not the internal array', () => {
    const t = new Terrain(50, 100);
    t.generate(3);
    const bm1 = t.getBitmap();
    const bm2 = t.getBitmap();
    expect(bm1).not.toBe(bm2);        // different references
    expect(bm1).toEqual(bm2);         // same content
    // Modifying the copy doesn't change the terrain
    bm1[0] = 255;
    expect(t.getBitmap()[0]).toBe(bm2[0]);
  });
});
