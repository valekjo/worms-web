# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript check + Vite production build
npm test             # Vitest (headless, single run)
npm run test:watch   # Vitest watch mode

# Run a single test file
npx vitest run tests/terrain.test.ts
```

## Architecture

**Stack**: Phaser 3, TypeScript, Vite. No external assets — every visual is drawn programmatically (canvas 2D or Phaser Graphics/Sprites).

### Scene flow

`BootScene` → `MenuScene` → `GameScene`

`BootScene` is a pass-through (no assets to load). `MenuScene` collects game mode (`hotseat` | `vsai`) and worms-per-team, then starts `GameScene` with those as `init` data.

### World vs viewport

The world is **2560 × 720 px** (`CONFIG.WORLD_WIDTH × CONFIG.HEIGHT`); the camera viewport is **1280 × 720** (`CONFIG.WIDTH`). The camera smoothly follows the active worm via a manual lerp on `cameras.main.scrollX` each frame. All HUD/UI elements use `.setScrollFactor(0)` to stay screen-fixed; floating health bars are world-space (scrollFactor 1) and are repositioned to `worm.x/y` each frame.

### Pure-data models (no Phaser dependency)

`src/game/` contains plain-TS classes that hold state and logic:
- **`Terrain`** — `Uint8Array` bitmap (`1` = solid). `isSolid()` drives physics collision; `destroy()` carves explosion craters. `surfaceY(x)` scans from top for worm placement.
- **`Worm`** — position, velocity, health, `onGround`, `facingLeft`. Physics and rendering are handled by `GameScene`, not `Worm`.
- **`Team`** — array of worms, active worm index, `isAI` flag.
- **`TurnManager`** — owns the phase state machine: `AIMING → FIRED → RETREAT → TRANSITION → AIMING`. Call `tick(dt)` every frame; it returns `true` when the phase changes. `onFired()` and `onProjectilesSettled()` advance phases from outside.
- **`AI`** — called from `GameScene.handleAI()` when `activeTeam.isAI`.

### GameScene orchestration

`GameScene` is the single large orchestrator. Its `update()` loop order matters:
1. Tick `TurnManager`
2. Lerp camera
3. `updateWormPhysics()` for all alive worms (gravity + terrain collision + friction)
4. `handleWormMovement()` + `handleWeaponKeys()` for the active worm (only in AIMING/RETREAT, non-AI)
5. `updateClouds()`
6. `updateProjectiles()`
7. AI logic
8. `drawWorms()` (updates sprite positions/animations)
9. HUD update

### Rendering layers (Phaser depth)

| Depth | Object |
|-------|--------|
| −4 | Sky gradient (scrollFactor 0) |
| −3/−2/−1 | Cloud layers far/mid/near (scrollFactor 0, manual parallax) |
| 0 | Terrain `RenderTexture` (world-space, full `WORLD_WIDTH`) |
| 5 | Worm sprites |
| 6 | Active-worm ring + aim line |
| 8 | Projectile graphics |
| 10+ | HUD elements (scrollFactor 0) |

### Terrain rendering & contour

`drawTerrainToTexture()` builds the initial terrain image by scanning the bitmap. Each solid pixel gets a colour based on **depth from surface** (consecutive solid pixels above it): depth < 6 → `CONTOUR_COLOR` (bright grass), depth < 8 → `SHADOW_COLOR`, else `GROUND_COLOR`.

After each explosion, `redrawTerrainPatch()` re-scans a rectangle around the crater using the updated bitmap and draws a canvas patch back onto the `RenderTexture`, so newly exposed edges get correct contour colours.

### Weapons

All weapon stats live in `CONFIG.WEAPONS`. `getWeaponConfig()` in `Weapon.ts` merges in per-weapon constants (wind factor etc.). `Projectile` handles its own physics in `update(dt, terrain, wind)` — gravity, wind, terrain collision, grenade bounce (max 3, 60% velocity retention) and fuse. Rifle fires instantly at full power (no charge); Bazooka and Grenade use hold-Space-to-charge.

### Worm sprites

`WormSprites.ts` generates a canvas spritesheet per team colour at runtime (3 idle frames + 4 walk frames, each 32 × 36 px). Frames are registered as a named Phaser texture and two animations (`${key}_idle`, `${key}_walk`) are created via `createWormAnimations()`. The sprite origin is set to `(0.5, BODY_ORIGIN_Y)` so the body centre aligns with the worm's physics position.

### Cloud parallax

Three cloud layers are screen-space Graphics (`setScrollFactor(0)`). Each frame, clouds drift by `(speed × windDir + windStrength) × dt` in their own coordinate, then the render position is computed as `((c.x − camera.scrollX × parallaxFactor) % TILE + TILE) % TILE − 250` to create seamless tiling with depth (far = 0.12, mid = 0.30, near = 0.55).

### Key config constants (`src/config.ts`)

Tuning gameplay values lives here: `GRAVITY`, `MOVE_SPEED`, `TURN_TIME`, `RETREAT_TIME`, `TRANSITION_TIME`, `WIND_MAX`, weapon stats, and terrain colours. Change here before touching game logic.
