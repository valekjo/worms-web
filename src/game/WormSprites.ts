import Phaser from 'phaser';

export const FW = 32;          // frame width
export const FH = 36;          // frame height
export const IDLE_COUNT = 3;
export const WALK_COUNT = 4;
const TOTAL = IDLE_COUNT + WALK_COUNT;

// Body centre y within a frame (used to align sprite to worm.y)
export const BODY_ORIGIN_Y = 20 / FH;   // ≈ 0.556

// Walk cycle: [leftDX, leftDY, rightDX, rightDY, bodyBob]
const WALK_CYCLE = [
  [-5, -2,  3,  2,  0],
  [ 0,  0,  0,  0, -2],
  [ 3,  2, -5, -2,  0],
  [ 0,  0,  0,  0,  0],
] as const;

function rgb(hex: number): string {
  return `rgb(${(hex >> 16) & 0xff},${(hex >> 8) & 0xff},${hex & 0xff})`;
}
function dark(hex: number, f = 0.5): string {
  return `rgb(${Math.round(((hex >> 16) & 0xff) * f)},${Math.round(((hex >> 8) & 0xff) * f)},${Math.round((hex & 0xff) * f)})`;
}

function drawFrame(ctx: CanvasRenderingContext2D, fi: number, bodyHex: number): void {
  const ox = fi * FW;          // x offset of this frame in the canvas
  const cx = ox + FW / 2;      // frame horizontal centre
  const baseCY = 20;            // body-centre y within frame

  // Per-frame state
  let llx = 0, lly = 0, rlx = 0, rly = 0, bob = 0;
  let blinking = false;

  if (fi < IDLE_COUNT) {
    blinking = fi === 1;
    bob      = fi === 2 ? 1 : 0;
  } else {
    [llx, lly, rlx, rly, bob] = WALK_CYCLE[fi - IDLE_COUNT];
  }

  const cy = baseCY + bob;

  // ── Legs (behind body) ──────────────────────────────────────────────────
  ctx.fillStyle = dark(bodyHex, 0.55);
  ctx.beginPath();
  ctx.ellipse(cx - 5 + llx, cy + 11 + lly, 5.5, 3.5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 5 + rlx, cy + 11 + rly, 5.5, 3.5,  0.25, 0, Math.PI * 2);
  ctx.fill();

  // ── Body ────────────────────────────────────────────────────────────────
  ctx.fillStyle = rgb(bodyHex);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 11, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark(bodyHex, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Helmet ──────────────────────────────────────────────────────────────
  const helmCY = cy - 9;
  ctx.fillStyle = '#4a4a1c';
  ctx.beginPath();
  ctx.ellipse(cx, helmCY, 8.5, 5.5, 0, Math.PI, 0);   // dome
  ctx.fill();
  ctx.fillStyle = '#2e2e0e';
  ctx.beginPath();
  ctx.ellipse(cx, helmCY + 1, 7, 3.5, 0, 0, Math.PI * 2);  // crown indent
  ctx.fill();
  ctx.fillStyle = '#666630';
  ctx.beginPath();
  ctx.ellipse(cx, helmCY + 3, 11, 3, 0, 0, Math.PI * 2);   // brim
  ctx.fill();

  // ── Eyes ────────────────────────────────────────────────────────────────
  const eyeY  = cy - 2;
  const eyeRY = blinking ? 1.2 : 3.2;

  for (const [ex, pupilDX] of [[-4, 0.8], [4, 0.8]] as [number, number][]) {
    // White
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(cx + ex, eyeY, 3.2, eyeRY, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!blinking) {
      // Pupil
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx + ex + pupilDX, eyeY, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Specular
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(cx + ex + pupilDX + 0.6, eyeY - 0.8, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function registerWormTexture(scene: Phaser.Scene, key: string, bodyColor: number): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const canvas = document.createElement('canvas');
  canvas.width  = FW * TOTAL;
  canvas.height = FH;
  const ctx = canvas.getContext('2d')!;

  for (let f = 0; f < TOTAL; f++) drawFrame(ctx, f, bodyColor);

  const tex = scene.textures.addCanvas(key, canvas)!;
  for (let f = 0; f < TOTAL; f++) {
    tex.add(f, 0, f * FW, 0, FW, FH);
  }
}

export function createWormAnimations(scene: Phaser.Scene, key: string): void {
  if (scene.anims.exists(`${key}_idle`)) return;

  scene.anims.create({
    key: `${key}_idle`,
    frames: Array.from({ length: IDLE_COUNT }, (_, i) => ({ key, frame: i })),
    frameRate: 3,
    repeat: -1,
  });
  scene.anims.create({
    key: `${key}_walk`,
    frames: Array.from({ length: WALK_COUNT }, (_, i) => ({ key, frame: IDLE_COUNT + i })),
    frameRate: 10,
    repeat: -1,
  });
}
