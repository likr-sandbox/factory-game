// Procedural 32x32 terrain and ore deposit sprite drawers
import type { TerrainType, MaterialId } from "../../sim/types";
import { getTerrainColor, getDepositColor, SHADING_PALETTE } from "../palette";

export type DepositStage = "rich" | "medium" | "low" | "depleted";
export const DEPOSIT_STAGES: DepositStage[] = ["rich", "medium", "low", "depleted"] as const;
export const TERRAIN_VARIANT_COUNTS: Record<TerrainType, number> = { grass: 5, rock: 4, water: 3 };

export function getTerrainVariant(x: number, y: number, worldSeed: number, terrain: TerrainType): number {
  const combined = x * 73856093 ^ y * 19349663 ^ worldSeed * 83492791;
  const hash = Math.sin(combined) * 43758.5453;
  const variant = Math.floor((hash - Math.floor(hash)) * TERRAIN_VARIANT_COUNTS[terrain]);
  return Math.max(0, Math.min(variant, TERRAIN_VARIANT_COUNTS[terrain] - 1));
}

export function getDepositStage(remaining: number, initialAmount: number): DepositStage {
  if (initialAmount <= 0 || remaining <= 0) return "depleted";
  const ratio = remaining / initialAmount;
  if (ratio > 0.66) return "rich";
  if (ratio > 0.33) return "medium";
  return "low";
}

export function getTerrainTextureKey(terrain: TerrainType, seed: number = 0): string {
  return `terrain:${terrain}:seed:${seed}`;
}

export function getDepositTextureKey(deposit: MaterialId, seed: number = 0, stage: DepositStage = "rich"): string {
  return `deposit:${deposit}:seed:${seed}:stage:${stage}`;
}

function seededRandom(seed: number, x: number, y: number): number {
  const n = Math.sin(seed * 12.9898 + x * 57.234 + y * 31.456) * 43758.5453;
  return n - Math.floor(n);
}

function rgbFromCss(css: string): [number, number, number] {
  const match = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [128, 128, 128];
}

function drawBaseTerrain(ctx: CanvasRenderingContext2D, terrain: TerrainType, seed: number = 0): void {
  const baseRgb = rgbFromCss(getTerrainColor(terrain).css);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const v = (seededRandom(seed, x, y) - 0.5) * 0.05;
      ctx.fillStyle = `rgb(${Math.round(baseRgb[0] * (1 + v))},${Math.round(baseRgb[1] * (1 + v))},${Math.round(baseRgb[2] * (1 + v))})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawMineralChunk(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, baseRgb: [number, number, number]): void {
  ctx.fillStyle = SHADING_PALETTE.outline.css;
  for (let oy = -1; oy <= size; oy++) for (let ox = -1; ox <= size; ox++) {
    if (ox === -1 || ox === size || oy === -1 || oy === size) ctx.fillRect(x + ox, y + oy, 1, 1);
  }
  ctx.fillStyle = `rgb(${baseRgb[0]},${baseRgb[1]},${baseRgb[2]})`;
  ctx.fillRect(x + 1, y + 1, Math.max(1, size - 1), Math.max(1, size - 1));
}

export function drawGrassTile(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawBaseTerrain(ctx, "grass", seed);
  const variant = getTerrainVariant(0, 0, seed, "grass");
  const rgb = rgbFromCss(getTerrainColor("grass").css);
  const colors: [number, number, number][] = [
    [0.85, 0.85, 0.85], [0.9, 0.9, 0.9], [0.7, 0.6, 0.5], [0.8, 0.75, 0.7], [1.15, 1.2, 1.1]
  ];
  const c = colors[variant]!;
  ctx.fillStyle = `rgb(${Math.round(rgb[0] * c[0])},${Math.round(rgb[1] * c[1])},${Math.round(rgb[2] * c[2])})`;
  if (variant === 0) for (let i = 0; i < 25; i++) ctx.fillRect(Math.floor(seededRandom(seed + i, 0, 0) * 30), Math.floor(seededRandom(seed + i + 100, 0, 0) * 30), 1, 2 + Math.floor(seededRandom(seed + i + 200, 0, 0) * 3));
  else if (variant === 1) for (let i = 0; i < 15; i++) { const t = Math.floor(seededRandom(seed + i, 0, 0) * 28) + 2; ctx.fillRect(t, Math.floor(seededRandom(seed + i + 100, 0, 0) * 28) + 2, 2, 1); }
  else if (variant === 2) for (let i = 0; i < 8; i++) ctx.fillRect(Math.floor(seededRandom(seed + i, 0, 0) * 24) + 4, Math.floor(seededRandom(seed + i + 100, 0, 0) * 24) + 4, 3, 2);
  else if (variant === 3) for (let i = 0; i < 20; i++) ctx.fillRect(Math.floor(seededRandom(seed + i, 0, 0) * 30), Math.floor(seededRandom(seed + i + 100, 0, 0) * 30), 2, 2);
  else for (let i = 0; i < 18; i++) ctx.fillRect(Math.floor(seededRandom(seed + i, 0, 0) * 30), Math.floor(seededRandom(seed + i + 100, 0, 0) * 30), 1, 1);
}

export function drawRockTile(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawBaseTerrain(ctx, "rock", seed);
  const variant = getTerrainVariant(0, 0, seed, "rock");
  const baseRgb = rgbFromCss(getTerrainColor("rock").css);
  if (variant === 0) {
    ctx.fillStyle = `rgb(${Math.round(baseRgb[0] * 0.6)},${Math.round(baseRgb[1] * 0.6)},${Math.round(baseRgb[2] * 0.6)})`;
    for (let i = 0; i < 50; i++) ctx.fillRect(Math.floor(seededRandom(seed + i, 0, 0) * 32), Math.floor(seededRandom(seed + i + 100, 0, 0) * 32), 1, 1);
    ctx.fillStyle = `rgb(${Math.round(baseRgb[0] * 1.3)},${Math.round(baseRgb[1] * 1.3)},${Math.round(baseRgb[2] * 1.3)})`;
    for (let i = 0; i < 30; i++) ctx.fillRect(Math.floor(seededRandom(seed + i + 200, 0, 0) * 32), Math.floor(seededRandom(seed + i + 300, 0, 0) * 32), 1, 1);
  } else if (variant === 1) for (let i = 0; i < 6; i++) { const c = Math.floor(seededRandom(seed + i, 0, 0) * 28) + 2; for (let j = 0; j < 3 + Math.floor(seededRandom(seed + i + 200, 0, 0) * 4); j++) ctx.fillRect(c + j, Math.floor(seededRandom(seed + i + 100, 0, 0) * 28) + 2 + (j % 2), 1, 1); }
  else if (variant === 2) for (let i = 0; i < 4; i++) ctx.fillRect(Math.floor(seededRandom(seed + i, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i + 100, 0, 0) * 20) + 6, 4 + Math.floor(seededRandom(seed + i + 200, 0, 0) * 4), 2);
  else for (let i = 0; i < 12; i++) { const r = Math.floor(seededRandom(seed + i, 0, 0) * 26) + 3; ctx.fillRect(r, Math.floor(seededRandom(seed + i + 100, 0, 0) * 26) + 3, 3, 2); }
}

export function drawWaterTile(ctx: CanvasRenderingContext2D, seed: number = 0): void {
  drawBaseTerrain(ctx, "water", seed);
  const variant = getTerrainVariant(0, 0, seed, "water");
  const baseRgb = rgbFromCss(getTerrainColor("water").css);
  if (variant === 0) for (let row = 0; row < 32; row += 4) for (let col = Math.floor(seededRandom(seed + row, 0, 0) * 3); col < 32; col += 6) ctx.fillRect(col, row, 2, 1);
  else if (variant === 1) for (let i = 0; i < 20; i++) ctx.fillRect(Math.floor(seededRandom(seed + i, 0, 0) * 30), Math.floor(seededRandom(seed + i + 100, 0, 0) * 30), 1, 1);
  else for (let wave = 0; wave < 5; wave++) for (let x = 0; x < 32; x += 4) ctx.fillRect(x, Math.floor(seededRandom(seed + wave, 0, 0) * 28) + 2 - (1 + Math.floor(seededRandom(seed + wave + 100, x, 0) * 2)), 2, 1);
}

function drawDepositStage(ctx: CanvasRenderingContext2D, stage: DepositStage, earthRgb: [number, number, number], chunkRgb: [number, number, number], seed: number, countMultiplier: number, sizeOffset: number, highlightChance: number): void {
  if (stage === "rich") { ctx.fillStyle = `rgb(${earthRgb[0]},${earthRgb[1]},${earthRgb[2]})`; ctx.fillRect(6, 6, 20, 20); for (let i = 0; i < 14 * countMultiplier; i++) { const c = Math.floor(seededRandom(seed + i * 7, 0, 0) * 20) + 6; drawMineralChunk(ctx, c, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 20) + 6, 3 + Math.floor(seededRandom(seed + i * 7 + 200, 0, 0) * sizeOffset), chunkRgb); if (seededRandom(seed + i * 7 + 300, 0, 0) > highlightChance) { ctx.fillStyle = SHADING_PALETTE.highlight.css; ctx.fillRect(c + 1, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 20) + 7, 1, 1); } } }
  else if (stage === "medium") { ctx.fillStyle = `rgb(${earthRgb[0]},${earthRgb[1]},${earthRgb[2]})`; ctx.fillRect(8, 8, 16, 16); for (let i = 0; i < 10 * countMultiplier; i++) { const c = Math.floor(seededRandom(seed + i * 7, 0, 0) * 20) + 6; drawMineralChunk(ctx, c, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 20) + 6, 2 + Math.floor(seededRandom(seed + i * 7 + 200, 0, 0) * sizeOffset), chunkRgb); } }
  else if (stage === "low") { ctx.fillStyle = `rgb(${earthRgb[0]},${earthRgb[1]},${earthRgb[2]})`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 6 * countMultiplier; i++) { const c = Math.floor(seededRandom(seed + i * 7, 0, 0) * 18) + 7; drawMineralChunk(ctx, c, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 18) + 7, 1 + Math.floor(seededRandom(seed + i * 7 + 200, 0, 0) * sizeOffset), chunkRgb); } }
  else { ctx.fillStyle = `rgb(${earthRgb[0] - 30},${earthRgb[1] - 25},${earthRgb[2] - 20})`; ctx.fillRect(8, 8, 16, 16); ctx.fillStyle = `rgb(${earthRgb[0] - 50},${earthRgb[1] - 45},${earthRgb[2] - 40})`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 3; i++) ctx.fillRect(Math.floor(seededRandom(seed + i * 7, 0, 0) * 16) + 8, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 16) + 8, 1, 1); }
}

export function drawIronOreDeposit(ctx: CanvasRenderingContext2D, seed: number = 0, stage: DepositStage = "rich"): void {
  const rgb = rgbFromCss(getDepositColor("iron_ore").css);
  if (stage === "depleted") { ctx.fillStyle = `rgb(90,75,50)`; ctx.fillRect(8, 8, 16, 16); ctx.fillStyle = `rgb(70,55,35)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 3; i++) ctx.fillRect(Math.floor(seededRandom(seed + i * 7, 0, 0) * 16) + 8, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 16) + 8, 1, 1); return; }
  if (stage === "rich") { ctx.fillStyle = `rgb(139,115,85)`; ctx.fillRect(6, 6, 20, 20); for (let i = 0; i < 14; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 7, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 20) + 6, 4, rgb); }
  else if (stage === "medium") { ctx.fillStyle = `rgb(139,115,85)`; ctx.fillRect(8, 8, 16, 16); for (let i = 0; i < 10; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 7, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 20) + 6, 3, rgb); }
  else { ctx.fillStyle = `rgb(139,115,85)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 6; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 7, 0, 0) * 18) + 7, Math.floor(seededRandom(seed + i * 7 + 100, 0, 0) * 18) + 7, 2, rgb); }
}

export function drawCopperOreDeposit(ctx: CanvasRenderingContext2D, seed: number = 0, stage: DepositStage = "rich"): void {
  const rgb = rgbFromCss(getDepositColor("copper_ore").css);
  if (stage === "depleted") { ctx.fillStyle = `rgb(90,75,50)`; ctx.fillRect(8, 8, 16, 16); ctx.fillStyle = `rgb(70,55,35)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 3; i++) ctx.fillRect(Math.floor(seededRandom(seed + i * 5, 0, 0) * 16) + 8, Math.floor(seededRandom(seed + i * 5 + 100, 0, 0) * 16) + 8, 1, 1); return; }
  if (stage === "rich") { ctx.fillStyle = `rgb(139,115,85)`; ctx.fillRect(6, 6, 20, 20); for (let i = 0; i < 16; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 5, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 5 + 100, 0, 0) * 20) + 6, 3, rgb); }
  else if (stage === "medium") { ctx.fillStyle = `rgb(139,115,85)`; ctx.fillRect(8, 8, 16, 16); for (let i = 0; i < 11; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 5, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 5 + 100, 0, 0) * 20) + 6, 2, rgb); }
  else { ctx.fillStyle = `rgb(139,115,85)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 7; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 5, 0, 0) * 18) + 7, Math.floor(seededRandom(seed + i * 5 + 100, 0, 0) * 18) + 7, 2, rgb); }
}

export function drawCoalDeposit(ctx: CanvasRenderingContext2D, seed: number = 0, stage: DepositStage = "rich"): void {
  const rgb = rgbFromCss(getDepositColor("coal").css);
  const darkRgb: [number, number, number] = [Math.min(rgb[0], 99), Math.min(rgb[1], 99), Math.min(rgb[2], 99)];
  if (stage === "depleted") { ctx.fillStyle = `rgb(30,28,25)`; ctx.fillRect(8, 8, 16, 16); ctx.fillStyle = `rgb(20,18,15)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 3; i++) ctx.fillRect(Math.floor(seededRandom(seed + i * 4, 0, 0) * 16) + 8, Math.floor(seededRandom(seed + i * 4 + 100, 0, 0) * 16) + 8, 1, 1); return; }
  if (stage === "rich") { ctx.fillStyle = `rgb(60,50,40)`; ctx.fillRect(6, 6, 20, 20); for (let i = 0; i < 18; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 4, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 4 + 100, 0, 0) * 20) + 6, 2, darkRgb); }
  else if (stage === "medium") { ctx.fillStyle = `rgb(60,50,40)`; ctx.fillRect(8, 8, 16, 16); for (let i = 0; i < 12; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 4, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 4 + 100, 0, 0) * 20) + 6, 2, darkRgb); }
  else { ctx.fillStyle = `rgb(60,50,40)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 7; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 4, 0, 0) * 18) + 7, Math.floor(seededRandom(seed + i * 4 + 100, 0, 0) * 18) + 7, 1, darkRgb); }
}

export function drawSilicaSandDeposit(ctx: CanvasRenderingContext2D, seed: number = 0, stage: DepositStage = "rich"): void {
  const rgb = rgbFromCss(getDepositColor("silica_sand").css);
  const lightRgb: [number, number, number] = [Math.max(rgb[0], 151), Math.max(rgb[1], 151), Math.max(rgb[2], 151)];
  if (stage === "depleted") { ctx.fillStyle = `rgb(150,120,80)`; ctx.fillRect(8, 8, 16, 16); ctx.fillStyle = `rgb(100,80,50)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 3; i++) ctx.fillRect(Math.floor(seededRandom(seed + i * 6, 0, 0) * 16) + 8, Math.floor(seededRandom(seed + i * 6 + 100, 0, 0) * 16) + 8, 1, 1); return; }
  if (stage === "rich") { ctx.fillStyle = `rgb(210,180,140)`; ctx.fillRect(6, 6, 20, 20); for (let i = 0; i < 16; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 6, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 6 + 100, 0, 0) * 20) + 6, 2, lightRgb); }
  else if (stage === "medium") { ctx.fillStyle = `rgb(210,180,140)`; ctx.fillRect(8, 8, 16, 16); for (let i = 0; i < 11; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 6, 0, 0) * 20) + 6, Math.floor(seededRandom(seed + i * 6 + 100, 0, 0) * 20) + 6, 2, lightRgb); }
  else { ctx.fillStyle = `rgb(210,180,140)`; ctx.fillRect(10, 10, 12, 12); for (let i = 0; i < 6; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i * 6, 0, 0) * 18) + 7, Math.floor(seededRandom(seed + i * 6 + 100, 0, 0) * 18) + 7, 1, lightRgb); }
}

export function drawOreDeposit(ctx: CanvasRenderingContext2D, material: MaterialId, seed: number = 0, stage: DepositStage = "rich"): void {
  switch (material) {
    case "iron_ore": drawIronOreDeposit(ctx, seed, stage); break;
    case "copper_ore": drawCopperOreDeposit(ctx, seed, stage); break;
    case "coal": drawCoalDeposit(ctx, seed, stage); break;
    case "silica_sand": drawSilicaSandDeposit(ctx, seed, stage); break;
    default: const rgb = rgbFromCss(getDepositColor(material).css); for (let i = 0; i < 15; i++) drawMineralChunk(ctx, Math.floor(seededRandom(seed + i, 0, 0) * 26) + 3, Math.floor(seededRandom(seed + i + 100, 0, 0) * 26) + 3, 1 + Math.floor(seededRandom(seed + i + 200, 0, 0) * 3), rgb);
  }
}

export function drawTerrainTile(ctx: CanvasRenderingContext2D, terrain: TerrainType, deposit: MaterialId | null = null, seed: number = 0): void {
  if (terrain === "grass") drawGrassTile(ctx, seed);
  else if (terrain === "rock") drawRockTile(ctx, seed);
  else drawWaterTile(ctx, seed);
  if (deposit) drawOreDeposit(ctx, deposit, seed + 1000);
}
