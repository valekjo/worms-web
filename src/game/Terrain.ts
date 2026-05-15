export class Terrain {
  readonly width: number;
  readonly height: number;
  private bitmap: Uint8Array; // 1 = solid, 0 = air

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.bitmap = new Uint8Array(width * height);
  }

  /**
   * Generate terrain using summed sine waves + minor random variation.
   * seed is used to deterministically vary phases.
   */
  generate(seed = 42): void {
    const { width, height } = this;
    const baseY = Math.floor(height * 0.55);

    // Simple seeded pseudo-random for phases
    const rand = (n: number): number => {
      const x = Math.sin(seed + n) * 43758.5453;
      return x - Math.floor(x);
    };

    // Three sine components: [amplitude, frequency, phase]
    const components: Array<[number, number, number]> = [
      [60,  0.008, rand(0) * Math.PI * 2],
      [30,  0.020, rand(1) * Math.PI * 2],
      [15,  0.050, rand(2) * Math.PI * 2],
    ];

    for (let x = 0; x < width; x++) {
      let groundY = baseY;
      for (const [amp, freq, phase] of components) {
        groundY += amp * Math.sin(x * freq + phase);
      }
      // Small per-column random noise
      groundY += (rand(x * 0.1 + 100) - 0.5) * 8;
      // Clamp: at least 15% from top, at most height-30 from top
      const minY = Math.max(30, Math.floor(height * 0.15));
      const maxY = height - 30;
      groundY = Math.max(minY, Math.min(maxY, Math.round(groundY)));

      for (let y = groundY; y < height; y++) {
        this.bitmap[y * width + x] = 1;
      }
    }
  }

  isSolid(x: number, y: number): boolean {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || xi >= this.width || yi < 0 || yi >= this.height) return false;
    return this.bitmap[yi * this.width + xi] === 1;
  }

  /**
   * Carve a filled circle out of the terrain (for explosions).
   */
  destroy(cx: number, cy: number, radius: number): void {
    const r = Math.ceil(radius);
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + r));
    const r2 = radius * radius;

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          this.bitmap[py * this.width + px] = 0;
        }
      }
    }
  }

  /**
   * Find the surface y at a given x (first solid pixel scanning from top).
   * Returns height if no solid pixel found.
   */
  surfaceY(x: number): number {
    const xi = Math.round(x);
    if (xi < 0 || xi >= this.width) return this.height;
    for (let y = 0; y < this.height; y++) {
      if (this.bitmap[y * this.width + xi] === 1) return y;
    }
    return this.height;
  }

  /**
   * Returns a copy of the bitmap for rendering.
   */
  getBitmap(): Uint8Array {
    return new Uint8Array(this.bitmap);
  }
}
