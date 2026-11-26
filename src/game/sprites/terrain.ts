// Procedural 32x32 terrain and ore deposit sprite drawers
// Pure CanvasRenderingContext2D pixel drawing using palette colors only

import type { TerrainType, MaterialId } from "../../sim/types";
import { getTerrainColor, getDepositColor } from "../palette";

// ============================================================================
// Texture Key Helpers (deterministic)
// ============================================================================

/** Generate deterministic texture key for terrain variations */
export function getTerrainTextureKey(terrain: TerrainType, seed: number = 0): string {
  return `terrain:${terrain}:seed:${seed}`;
}

/** Generate deterministic texture key for deposit variations */
export function getDepositTextureKey(deposit: MaterialId, seed: number = 0): string {
  return `deposit:${deposit}:seed:${seed}`;
}

// ============================================================================
// Pseudo-random helper for deterministic texture generation
// ============================================================================

function seededRandom(seed: number, x: number, y: number): number {
  const n = Math.sin(seed * 12.9898 + x * 57.234 + y * 31.456) * 43758.5453;
  return n - Math.floor(n);
}

/** Safely parse RGB values from css "rgb(r,g,b)" string */
function rgbFromCss(css: string): [number, number, number] {
  const match = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [128, 128, 128];
}

// ============================================================================
// Base Terrain Drawing Functions
// ============================================================================

/** Draw base terrain color with subtle noise variation */
function drawBaseTerrain(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainType,
  seed: number = 0
): void {
  const baseColor = getTerrainColor(terrain);
  const baseRgb = rgbFromCss(baseColor.css);
  
  // Draw full 32x32 rectangle with slight per-pixel variation
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const variation = (seededRandom(seed, x, y) - 0.5) * 0.15;
      const r = Math.min(255, Math.max(0, Math.round(baseRgb[0] * (1 + variation))));
      const g = Math.min(255, Math.max(0, Math.round(baseRgb[1] * (1 + variation))));
      const b = Math.min(255, Math.max(0, Math.round(baseRgb[2] * (1 + variation))));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Draw grass texture with blade-like patterns */
export function drawGrassTile(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawBaseTerrain(ctx, "grass", seed);
  
  // Add darker green blade accents
  const rgb = rgbFromCss(getTerrainColor("grass").css);
  const darkR = Math.round(rgb[0] * 0.7);
  const darkG = Math.round(rgb[1] * 0.7);
  const darkB = Math.round(rgb[2] * 0.7);
  
  ctx.fillStyle = `rgb(${darkR},${darkG},${darkB})`;
  
  // Draw random blade patterns
  for (let i = 0; i < 40; i++) {
    const bx = Math.floor(seededRandom(seed + i, 0, 0) * 30);
    const by = Math.floor(seededRandom(seed + i + 100, 0, 0) * 30);
    const height = 2 + Math.floor(seededRandom(seed + i + 200, 0, 0) * 3);
    ctx.fillRect(bx, by, 1, height);
  }
}

/** Draw rock texture with speckled pattern */
export function drawRockTile(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawBaseTerrain(ctx, "rock", seed);
  
  // Add darker and lighter rock speckles
  const baseRgb = rgbFromCss(getTerrainColor("rock").css);
  
  // Darker speckles
  ctx.fillStyle = `rgb(${Math.round(baseRgb[0] * 0.6)},${Math.round(baseRgb[1] * 0.6)},${Math.round(baseRgb[2] * 0.6)})`;
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(seededRandom(seed + i, 0, 0) * 32);
    const y = Math.floor(seededRandom(seed + i + 100, 0, 0) * 32);
    ctx.fillRect(x, y, 1, 1);
  }
  
  // Lighter speckles
  ctx.fillStyle = `rgb(${Math.round(baseRgb[0] * 1.3)},${Math.round(baseRgb[1] * 1.3)},${Math.round(baseRgb[2] * 1.3)})`;
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(seededRandom(seed + i + 200, 0, 0) * 32);
    const y = Math.floor(seededRandom(seed + i + 300, 0, 0) * 32);
    ctx.fillRect(x, y, 1, 1);
  }
}

/** Draw water texture with ripple effect */
export function drawWaterTile(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawBaseTerrain(ctx, "water", seed);
  
  // Add lighter ripple highlights
  const baseRgb = rgbFromCss(getTerrainColor("water").css);
  const lightR = Math.min(255, baseRgb[0] + 60);
  const lightG = Math.min(255, baseRgb[1] + 60);
  const lightB = Math.min(255, baseRgb[2] + 30);
  
  ctx.fillStyle = `rgba(${lightR},${lightG},${lightB},0.5)`;
  
  // Draw horizontal ripple lines
  for (let row = 0; row < 32; row += 4) {
    const offset = Math.floor(seededRandom(seed + row, 0, 0) * 3);
    for (let col = offset; col < 32; col += 6) {
      ctx.fillRect(col, row, 2, 1);
    }
  }
}

// ============================================================================
// Ore Deposit Drawing Functions
// ============================================================================

/** Draw ore deposit overlay on terrain */
export function drawOreDeposit(
  ctx: CanvasRenderingContext2D,
  material: MaterialId,
  seed: number = 0
): void {
  const depositColor = getDepositColor(material);
  const rgb = rgbFromCss(depositColor.css);
  
  // Draw ore clusters scattered across the tile
  const clusterCount = 15 + Math.floor(seededRandom(seed, 0, 0) * 10);
  
  for (let i = 0; i < clusterCount; i++) {
    const cx = Math.floor(seededRandom(seed + i, 0, 0) * 26) + 3;
    const cy = Math.floor(seededRandom(seed + i + 100, 0, 0) * 26) + 3;
    const size = 1 + Math.floor(seededRandom(seed + i + 200, 0, 0) * 3);
    
    // Draw ore cluster as irregular blob
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(cx, cy, size, size);
    
    // Add highlight pixels
    if (seededRandom(seed + i + 300, 0, 0) > 0.5) {
      const lightR = Math.min(255, rgb[0] + 50);
      const lightG = Math.min(255, rgb[1] + 50);
      const lightB = Math.min(255, rgb[2] + 50);
      ctx.fillStyle = `rgb(${lightR},${lightG},${lightB})`;
      ctx.fillRect(cx + 1, cy + 1, 1, 1);
    }
    
    // Add shadow pixels
    if (seededRandom(seed + i + 400, 0, 0) > 0.5) {
      const darkR = Math.round(rgb[0] * 0.6);
      const darkG = Math.round(rgb[1] * 0.6);
      const darkB = Math.round(rgb[2] * 0.6);
      ctx.fillStyle = `rgb(${darkR},${darkG},${darkB})`;
      ctx.fillRect(cx + size - 1, cy + size - 1, 1, 1);
    }
  }
}

/** Draw iron ore deposit (reddish-brown chunks) */
export function drawIronOreDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawOreDeposit(ctx, "iron_ore", seed);
}

/** Draw copper ore deposit (orange-brown chunks) */
export function drawCopperOreDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawOreDeposit(ctx, "copper_ore", seed);
}

/** Draw coal deposit (dark gray/black chunks) */
export function drawCoalDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawOreDeposit(ctx, "coal", seed);
}

/** Draw silica sand deposit (light yellow chunks) */
export function drawSilicaSandDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawOreDeposit(ctx, "silica_sand", seed);
}

// ============================================================================
// Combined Terrain + Deposit Drawing
// ============================================================================

/** Draw complete terrain tile with optional ore deposit overlay */
export function drawTerrainTile(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainType,
  deposit: MaterialId | null = null,
  seed: number = 0
): void {
  // Draw base terrain
  switch (terrain) {
    case "grass":
      drawGrassTile(ctx, seed);
      break;
    case "rock":
      drawRockTile(ctx, seed);
      break;
    case "water":
      drawWaterTile(ctx, seed);
      break;
  }
  
  // Draw ore deposit overlay if present
  if (deposit) {
    drawOreDeposit(ctx, deposit, seed + 1000);
  }
}
