// Procedural 32x32 terrain and ore deposit sprite drawers
// Pure CanvasRenderingContext2D pixel drawing using palette colors only

import type { TerrainType, MaterialId } from "../../sim/types";
import { getTerrainColor, getDepositColor, SHADING_PALETTE } from "../palette";

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
  
  // Draw full 32x32 rectangle with soft per-pixel variation (reduced noise)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const variation = (seededRandom(seed, x, y) - 0.5) * 0.05;
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
  
  // Add softer darker green blade accents (reduced contrast for calmness)
  const rgb = rgbFromCss(getTerrainColor("grass").css);
  const darkR = Math.round(rgb[0] * 0.85);
  const darkG = Math.round(rgb[1] * 0.85);
  const darkB = Math.round(rgb[2] * 0.85);
  
  ctx.fillStyle = `rgb(${darkR},${darkG},${darkB})`;
  
  // Draw fewer, softer blade patterns (reduced from 40 to 25)
  for (let i = 0; i < 25; i++) {
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

/** Draw a single mineral chunk with outline using SHADING_PALETTE */
function drawMineralChunk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  baseRgb: [number, number, number],
  outlineRgb: [number, number, number]
): void {
  // Draw outline first using SHADING_PALETTE.outline for consistency
  ctx.fillStyle = SHADING_PALETTE.outline.css;
  for (let oy = -1; oy <= size; oy++) {
    for (let ox = -1; ox <= size; ox++) {
      if (ox === -1 || ox === size || oy === -1 || oy === size) {
        ctx.fillRect(x + ox, y + oy, 1, 1);
      }
    }
  }
  
  // Draw inner chunk
  ctx.fillStyle = `rgb(${baseRgb[0]},${baseRgb[1]},${baseRgb[2]})`;
  ctx.fillRect(x + 1, y + 1, Math.max(1, size - 1), Math.max(1, size - 1));
}

/** Draw iron ore deposit with cool steel-blue large angular chunks */
export function drawIronOreDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  const depositColor = getDepositColor("iron_ore");
  const rgb = rgbFromCss(depositColor.css);
  
  // Iron ore: fewer but larger angular chunks (3-4px)
  const clusterCount = 12;
  
  for (let i = 0; i < clusterCount; i++) {
    const cx = Math.floor(seededRandom(seed + i * 7, 0, 0) * 24) + 4;
    const cy = Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 24) + 4;
    const size = 2 + Math.floor(seededRandom(seed + i * 7 + 200, 0, 0) * 3);  // 2-4px
    
    drawMineralChunk(ctx, cx, cy, size, rgb, [0, 0, 0]);
    
    // Add subtle highlight using SHADING_PALETTE.highlight
    if (seededRandom(seed + i * 7 + 300, 0, 0) > 0.6) {
      ctx.fillStyle = SHADING_PALETTE.highlight.css;
      ctx.fillRect(cx + 1, cy + 1, 1, 1);
    }
  }
}

/** Draw copper ore deposit with warm bright copper-orange irregular chunks */
export function drawCopperOreDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  const depositColor = getDepositColor("copper_ore");
  const rgb = rgbFromCss(depositColor.css);
  
  // Copper ore: medium-sized irregular chunks (2-3px), slightly more numerous
  const clusterCount = 16;
  
  for (let i = 0; i < clusterCount; i++) {
    const cx = Math.floor(seededRandom(seed + i * 5, 0, 0) * 26) + 3;
    const cy = Math.floor(seededRandom(seed + i * 5 + 100, 0, 0) * 26) + 3;
    const size = 1 + Math.floor(seededRandom(seed + i * 5 + 200, 0, 0) * 3);  // 1-3px
    
    drawMineralChunk(ctx, cx, cy, size, rgb, [0, 0, 0]);
    
    // Add highlight using SHADING_PALETTE.highlight
    if (seededRandom(seed + i * 5 + 300, 0, 0) > 0.5) {
      ctx.fillStyle = SHADING_PALETTE.highlight.css;
      ctx.fillRect(cx + 1, cy, 1, 1);
    }
  }
}

/** Draw coal deposit with deep charcoal/black rounded chunks */
export function drawCoalDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  const depositColor = getDepositColor("coal");
  const rgb = rgbFromCss(depositColor.css);
  
  // Ensure all channels stay < 100 for coal (dark constraint)
  const darkRgb: [number, number, number] = [
    Math.min(rgb[0], 99),
    Math.min(rgb[1], 99),
    Math.min(rgb[2], 99)
  ];
  
  // Coal: small rounded chunks (1-2px), dense clustering
  const clusterCount = 20;
  
  for (let i = 0; i < clusterCount; i++) {
    const cx = Math.floor(seededRandom(seed + i * 4, 0, 0) * 28) + 2;
    const cy = Math.floor(seededRandom(seed + i * 4 + 100, 0, 0) * 28) + 2;
    const size = 1 + Math.floor(seededRandom(seed + i * 4 + 200, 0, 0) * 2);  // 1-2px
    
    drawMineralChunk(ctx, cx, cy, size, darkRgb, [0, 0, 0]);
    
    // Coal has minimal highlights (mostly dark) - use SHADING_PALETTE.shadow
    if (seededRandom(seed + i * 4 + 300, 0, 0) > 0.7) {
      ctx.fillStyle = SHADING_PALETTE.shadow.css;
      ctx.fillRect(cx + 1, cy + 1, 1, 1);
    }
  }
}

/** Draw silica sand deposit with pale warm sand beige granular chunks */
export function drawSilicaSandDeposit(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  const depositColor = getDepositColor("silica_sand");
  const rgb = rgbFromCss(depositColor.css);
  
  // Ensure all channels stay > 150 for silica sand (light constraint)
  const lightRgb: [number, number, number] = [
    Math.max(rgb[0], 151),
    Math.max(rgb[1], 151),
    Math.max(rgb[2], 151)
  ];
  
  // Silica sand: small granular chunks (1-2px), scattered pattern
  const clusterCount = 18;
  
  for (let i = 0; i < clusterCount; i++) {
    const cx = Math.floor(seededRandom(seed + i * 6, 0, 0) * 28) + 2;
    const cy = Math.floor(seededRandom(seed + i * 6 + 100, 0, 0) * 28) + 2;
    const size = 1 + Math.floor(seededRandom(seed + i * 6 + 200, 0, 0) * 2);  // 1-2px
    
    drawMineralChunk(ctx, cx, cy, size, lightRgb, [0, 0, 0]);
    
    // Add soft highlight using SHADING_PALETTE.highlight
    if (seededRandom(seed + i * 6 + 300, 0, 0) > 0.5) {
      ctx.fillStyle = SHADING_PALETTE.highlight.css;
      ctx.fillRect(cx, cy + 1, 1, 1);
    }
  }
}

/** Generic ore deposit drawing (kept for backward compatibility, delegates to type-specific) */
export function drawOreDeposit(
  ctx: CanvasRenderingContext2D,
  material: MaterialId,
  seed: number = 0
): void {
  // Delegate to type-specific drawing functions
  switch (material) {
    case "iron_ore":
      drawIronOreDeposit(ctx, seed);
      break;
    case "copper_ore":
      drawCopperOreDeposit(ctx, seed);
      break;
    case "coal":
      drawCoalDeposit(ctx, seed);
      break;
    case "silica_sand":
      drawSilicaSandDeposit(ctx, seed);
      break;
    default:
      // For processed materials, use generic approach with SHADING_PALETTE
      const depositColor = getDepositColor(material);
      const rgb = rgbFromCss(depositColor.css);
      
      const clusterCount = 15;
      for (let i = 0; i < clusterCount; i++) {
        const cx = Math.floor(seededRandom(seed + i, 0, 0) * 26) + 3;
        const cy = Math.floor(seededRandom(seed + i + 100, 0, 0) * 26) + 3;
        const size = 1 + Math.floor(seededRandom(seed + i + 200, 0, 0) * 3);
        
        drawMineralChunk(ctx, cx, cy, size, rgb, [0, 0, 0]);
      }
  }
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
