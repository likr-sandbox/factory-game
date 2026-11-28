// Procedural 32x32 building sprite drawers for pixel-art rendering
// Uses only palette colors - no external images

import type { BuildingType, Direction } from "../../sim/types";
import { getBuildingColor, UI_PALETTE, SHADING_PALETTE } from "../palette";

const W = 32;
const H = 32;

/** Draw a single pixel */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

/** Fill rect with color */
function fill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ============================================================================
// Base building shapes (direction-agnostic foundations)
// ============================================================================

function drawMinerBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("miner").css;
  // Main body 20x20 centered
  fill(ctx, 6, 6, 20, 20, base);
  // Darker border
  fill(ctx, 7, 7, 18, 18, SHADING_PALETTE.metalDark.css);
  fill(ctx, 8, 8, 16, 16, base);
  // Inner detail
  fill(ctx, 11, 11, 10, 10, SHADING_PALETTE.metalMid.css);
}

function drawBeltBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("belt").css;
  // Belt platform 24x8 or 8x24 depending on direction handled in main
  fill(ctx, 4, 12, 24, 8, base);
  fill(ctx, 5, 13, 22, 6, SHADING_PALETTE.shadow.css);
}

function drawSplitterBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("splitter").css;
  fill(ctx, 6, 6, 20, 20, base);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalMid.css);
  // Y-split pattern
  fill(ctx, 15, 8, 2, 16, SHADING_PALETTE.metalLight.css);
  fill(ctx, 8, 15, 16, 2, SHADING_PALETTE.metalLight.css);
}

function drawFilterSplitterBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("filter_splitter").css;
  fill(ctx, 6, 6, 20, 20, base);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalMid.css);
  // Filter indicator lines
  fill(ctx, 10, 10, 12, 2, SHADING_PALETTE.metalLight.css);
  fill(ctx, 10, 14, 12, 2, SHADING_PALETTE.metalLight.css);
}

function drawUndergroundBeltBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("underground_belt").css;
  fill(ctx, 6, 6, 20, 20, base);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalMid.css);
  // Tunnel entrance
  fill(ctx, 10, 10, 12, 12, SHADING_PALETTE.metalDark.css);
  fill(ctx, 12, 12, 8, 8, SHADING_PALETTE.metalLight.css);
}

function drawSmelterBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("smelter").css;
  fill(ctx, 6, 6, 20, 20, base);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalMid.css);
  // Furnace opening
  fill(ctx, 10, 10, 12, 12, SHADING_PALETTE.metalDark.css);
}

function drawAssemblerBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("assembler").css;
  fill(ctx, 6, 6, 20, 20, base);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalMid.css);
  // Gear symbol center
  fill(ctx, 13, 13, 6, 6, SHADING_PALETTE.metalLight.css);
}

function drawRecyclerBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("recycler").css;
  fill(ctx, 6, 6, 20, 20, base);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalMid.css);
  // Recycle arrows hint
  fill(ctx, 11, 11, 10, 10, SHADING_PALETTE.metalLight.css);
}

function drawSensorBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("sensor").css;
  fill(ctx, 6, 6, 20, 20, base);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalMid.css);
  // Lens center
  fill(ctx, 12, 12, 8, 8, SHADING_PALETTE.metalLight.css);
  fill(ctx, 14, 14, 4, 4, SHADING_PALETTE.highlight.css);
}

function drawHubBase(ctx: CanvasRenderingContext2D) {
  const base = getBuildingColor("hub").css;
  fill(ctx, 4, 4, 24, 24, base);
  fill(ctx, 6, 6, 20, 20, SHADING_PALETTE.metalMid.css);
  fill(ctx, 8, 8, 16, 16, SHADING_PALETTE.metalLight.css);
  // Central emblem
  fill(ctx, 12, 12, 8, 8, SHADING_PALETTE.highlight.css);
}

// ============================================================================
// Direction indicators
// ============================================================================

function drawDirectionIndicator(ctx: CanvasRenderingContext2D, dir: Direction) {
  const arrowColor = SHADING_PALETTE.highlight.css;
  const shadowColor = SHADING_PALETTE.dropShadow.css;
  
  switch (dir) {
    case "N":
      // Up arrow at top
      fill(ctx, 14, 2, 4, 2, shadowColor);
      fill(ctx, 15, 3, 2, 2, arrowColor);
      fill(ctx, 14, 4, 4, 2, arrowColor);
      fill(ctx, 13, 5, 6, 2, arrowColor);
      break;
    case "E":
      // Right arrow at right
      fill(ctx, 26, 14, 2, 4, shadowColor);
      fill(ctx, 25, 15, 2, 2, arrowColor);
      fill(ctx, 24, 14, 2, 4, arrowColor);
      fill(ctx, 23, 13, 2, 6, arrowColor);
      break;
    case "S":
      // Down arrow at bottom
      fill(ctx, 14, 28, 4, 2, shadowColor);
      fill(ctx, 15, 27, 2, 2, arrowColor);
      fill(ctx, 14, 25, 4, 2, arrowColor);
      fill(ctx, 13, 24, 6, 2, arrowColor);
      break;
    case "W":
      // Left arrow at left
      fill(ctx, 4, 14, 2, 4, shadowColor);
      fill(ctx, 5, 15, 2, 2, arrowColor);
      fill(ctx, 6, 14, 2, 4, arrowColor);
      fill(ctx, 7, 13, 2, 6, arrowColor);
      break;
  }
}

// ============================================================================
// Animation overlays
// ============================================================================

function drawBeltStripes(ctx: CanvasRenderingContext2D, frame: number, dir: Direction) {
  const stripeColor = SHADING_PALETTE.highlight.css;
  const offset = (frame * 4) % 16;
  
  if (dir === "N" || dir === "S") {
    // Vertical belt stripes
    for (let i = 0; i < 4; i++) {
      const y = ((i * 8) + offset) % 24 + 12;
      if (y >= 12 && y <= 19) {
        fill(ctx, 6, Math.floor(y), 20, 1, stripeColor);
      }
    }
  } else {
    // Horizontal belt stripes
    for (let i = 0; i < 4; i++) {
      const x = ((i * 8) + offset) % 24 + 4;
      if (x >= 4 && x <= 25) {
        fill(ctx, Math.floor(x), 12, 1, 8, stripeColor);
      }
    }
  }
}

function drawMinerBlade(ctx: CanvasRenderingContext2D, frame: number) {
  const bladeColor = SHADING_PALETTE.metalLight.css;
  // Rotating blade effect
  if (frame === 0) {
    fill(ctx, 10, 14, 12, 4, bladeColor);
    fill(ctx, 14, 10, 4, 12, bladeColor);
  } else {
    fill(ctx, 10, 12, 12, 8, bladeColor);
  }
}

function drawSmelterFlame(ctx: CanvasRenderingContext2D, frame: number) {
  const flame1 = SHADING_PALETTE.alertRed.css;
  const flame2 = SHADING_PALETTE.alertAmber.css;
  const flame3 = SHADING_PALETTE.statusGreen.css;
  
  // Flickering flame in furnace opening
  if (frame === 0) {
    fill(ctx, 12, 14, 8, 6, flame1);
    fill(ctx, 14, 12, 4, 4, flame2);
    fill(ctx, 15, 11, 2, 2, flame3);
  } else {
    fill(ctx, 12, 15, 8, 5, flame1);
    fill(ctx, 13, 13, 6, 4, flame2);
    fill(ctx, 15, 12, 2, 3, flame3);
  }
}

function drawFaultBadge(ctx: CanvasRenderingContext2D) {
  const warnColor = UI_PALETTE.warning.css;
  const faultColor = UI_PALETTE.fault.css;
  
  // Warning triangle badge at top-right corner
  fill(ctx, 18, 2, 12, 10, warnColor);
  fill(ctx, 19, 3, 10, 8, faultColor);
  // Exclamation mark
  fill(ctx, 23, 5, 2, 4, "white");
  fill(ctx, 23, 10, 2, 2, "white");
}

// ============================================================================
// Main drawer functions for each building type
// ============================================================================

export function drawMiner(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawMinerBase(ctx);
  drawDirectionIndicator(ctx, dir);
  drawMinerBlade(ctx, frame);
  if (faulted) drawFaultBadge(ctx);
}

export function drawBelt(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  // Rotate belt orientation based on direction
  if (dir === "N" || dir === "S") {
    // Vertical belt
    fill(ctx, 12, 4, 8, 24, getBuildingColor("belt").css);
    fill(ctx, 13, 5, 6, 22, SHADING_PALETTE.shadow.css);
  } else {
    // Horizontal belt
    fill(ctx, 4, 12, 24, 8, getBuildingColor("belt").css);
    fill(ctx, 5, 13, 22, 6, SHADING_PALETTE.shadow.css);
  }
  drawDirectionIndicator(ctx, dir);
  drawBeltStripes(ctx, frame, dir);
  if (faulted) drawFaultBadge(ctx);
}

export function drawSplitter(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawSplitterBase(ctx);
  drawDirectionIndicator(ctx, dir);
  if (faulted) drawFaultBadge(ctx);
}

export function drawFilterSplitter(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawFilterSplitterBase(ctx);
  drawDirectionIndicator(ctx, dir);
  if (faulted) drawFaultBadge(ctx);
}

export function drawUndergroundBelt(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawUndergroundBeltBase(ctx);
  drawDirectionIndicator(ctx, dir);
  // Scroll indicator for underground
  const scrollColor = SHADING_PALETTE.highlight.css;
  const offset = (frame * 3) % 8;
  fill(ctx, 14, 14 + offset, 4, 2, scrollColor);
  if (faulted) drawFaultBadge(ctx);
}

export function drawSmelter(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawSmelterBase(ctx);
  drawDirectionIndicator(ctx, dir);
  drawSmelterFlame(ctx, frame);
  if (faulted) drawFaultBadge(ctx);
}

export function drawAssembler(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawAssemblerBase(ctx);
  drawDirectionIndicator(ctx, dir);
  // Slight pulsing effect
  if (frame > 0) {
    fill(ctx, 12, 12, 8, 8, SHADING_PALETTE.metalLight.css);
  }
  if (faulted) drawFaultBadge(ctx);
}

export function drawRecycler(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawRecyclerBase(ctx);
  drawDirectionIndicator(ctx, dir);
  // Rotating recycle hint
  if (frame === 0) {
    fill(ctx, 10, 12, 12, 2, SHADING_PALETTE.metalLight.css);
  } else {
    fill(ctx, 12, 10, 2, 12, SHADING_PALETTE.metalLight.css);
  }
  if (faulted) drawFaultBadge(ctx);
}

export function drawSensor(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawSensorBase(ctx);
  drawDirectionIndicator(ctx, dir);
  // Scanning beam in direction
  const beamColor = SHADING_PALETTE.highlight.css;
  if (dir === "N") fill(ctx, 14, 0, 4, 6, beamColor);
  else if (dir === "E") fill(ctx, 26, 14, 6, 4, beamColor);
  else if (dir === "S") fill(ctx, 14, 26, 4, 6, beamColor);
  else if (dir === "W") fill(ctx, 2, 14, 6, 4, beamColor);
  if (faulted) drawFaultBadge(ctx);
}

export function drawHub(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean) {
  drawHubBase(ctx);
  drawDirectionIndicator(ctx, dir);
  // Crown/top detail
  fill(ctx, 10, 2, 12, 4, SHADING_PALETTE.metalLight.css);
  if (faulted) drawFaultBadge(ctx);
}

// ============================================================================
// Texture key helper
// ============================================================================

export function getBuildingTextureKey(type: BuildingType, direction: Direction, frame: number): string {
  return `${type}_${direction}_${frame}`;
}

// ============================================================================
// Generic drawer dispatcher
// ============================================================================

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  type: BuildingType,
  dir: Direction,
  frame: number,
  faulted: boolean
): void {
  switch (type) {
    case "miner": drawMiner(ctx, dir, frame, faulted); break;
    case "belt": drawBelt(ctx, dir, frame, faulted); break;
    case "splitter": drawSplitter(ctx, dir, frame, faulted); break;
    case "filter_splitter": drawFilterSplitter(ctx, dir, frame, faulted); break;
    case "underground_belt": drawUndergroundBelt(ctx, dir, frame, faulted); break;
    case "smelter": drawSmelter(ctx, dir, frame, faulted); break;
    case "assembler": drawAssembler(ctx, dir, frame, faulted); break;
    case "recycler": drawRecycler(ctx, dir, frame, faulted); break;
    case "sensor": drawSensor(ctx, dir, frame, faulted); break;
    case "hub": drawHub(ctx, dir, frame, faulted); break;
  }
}
