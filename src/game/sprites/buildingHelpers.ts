// Common 32×32 (and 64×64 hub) pixel-art drawing primitives for buildings
// Uses only Canvas2D API - no external images

import { UI_PALETTE } from "../palette";
import type { Direction } from "../../sim/types";

// ============================================================================
// Basic Drawing Primitives
// ============================================================================

/** Draw a single pixel at (x, y) */
export function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`px: non-integer coordinates (${x}, ${y})`);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

/** Fill a rectangle with color */
export function fill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(h)) {
    throw new Error(`fill: non-integer parameters (${x}, ${y}, ${w}, ${h})`);
  }
  if (w <= 0 || h <= 0) {
    throw new Error(`fill: non-positive dimensions (${w}×${h})`);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ============================================================================
// Shadow & Frame Utilities
// ============================================================================

/**
 * Draw a 1px translucent black drop shadow beneath a rect.
 * Offset by +2px right and +2px down for natural grounding.
 */
export function drawDropShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const shadowColor = "rgba(0, 0, 0, 0.35)";
  const offsetX = 2;
  const offsetY = 2;
  fill(ctx, x + offsetX, y + offsetY, w, h, shadowColor);
}

/**
 * Draw a framed building body with:
 * - 1px dark outline
 * - top face highlight
 * - bottom face bevel
 *
 * For 32×32: outer box at (x,y) with size w×h
 * For 64×64: same proportions scaled ×2
 */
export function drawOutlinedFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  baseColor: string,
  highlightColor: string,
  bevelColor: string,
  outlineColor: string
): void {
  if (w < 4 || h < 4) {
    throw new Error(`drawOutlinedFrame: too small (${w}×${h}), minimum 4×4`);
  }

  // Outer outline (1px on all sides)
  fill(ctx, x, y, w, h, outlineColor);

  // Inner content area (shrunk by 1px)
  const innerX = x + 1;
  const innerY = y + 1;
  const innerW = w - 2;
  const innerH = h - 2;

  // Base fill
  fill(ctx, innerX, innerY, innerW, innerH, baseColor);

  // Top highlight (1px strip along top edge of inner area)
  fill(ctx, innerX, innerY, innerW, 1, highlightColor);

  // Bottom bevel (1px strip along bottom edge of inner area)
  fill(ctx, innerX, innerY + innerH - 1, innerW, 1, bevelColor);
}

// ============================================================================
// Direction Chevron / Shoot Marker
// ============================================================================

/**
 * Draw a clear output-direction chevron for 1×1 facilities.
 * Renders a V-shaped arrow pointing in the given direction.
 *
 * For 32×32 sprites: centered near the output edge.
 * For 64×64 sprites: scale ×2 and position accordingly.
 */
export function drawDirectionChevron(
  ctx: CanvasRenderingContext2D,
  dir: Direction,
  color: string,
  accentColor: string
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // Determine center and arrow size based on canvas size
  const isLarge = W >= 64 && H >= 64;
  const scale = isLarge ? 2 : 1;
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);

  // Chevron leg length (~6px for 32×32, ~12px for 64×64)
  const legLen = 6 * scale;
  const strokeWidth = 2 * scale;

  ctx.fillStyle = color;

  switch (dir) {
    case "N": {
      // Up-pointing chevron at top
      const yBase = 8 * scale;
      // Left leg
      fill(ctx, cx - legLen, yBase + legLen, strokeWidth, legLen, color);
      fill(ctx, cx - legLen + strokeWidth, yBase + legLen - strokeWidth, strokeWidth, legLen - strokeWidth, color);
      // Right leg
      fill(ctx, cx + legLen - strokeWidth, yBase + legLen, strokeWidth, legLen, color);
      fill(ctx, cx + legLen - 2 * strokeWidth, yBase + legLen - strokeWidth, strokeWidth, legLen - strokeWidth, color);
      // Accent tip
      fill(ctx, cx - strokeWidth, yBase, 2 * strokeWidth, strokeWidth, accentColor);
      break;
    }
    case "E": {
      // Right-pointing chevron at right
      const xBase = W - 10 * scale;
      // Top leg
      fill(ctx, xBase - legLen, cy - legLen, legLen, strokeWidth, color);
      fill(ctx, xBase - legLen + strokeWidth, cy - legLen + strokeWidth, legLen - strokeWidth, strokeWidth, color);
      // Bottom leg
      fill(ctx, xBase - legLen, cy + legLen - strokeWidth, legLen, strokeWidth, color);
      fill(ctx, xBase - legLen + strokeWidth, cy + legLen - 2 * strokeWidth, legLen - strokeWidth, strokeWidth, color);
      // Accent tip
      fill(ctx, xBase - strokeWidth, cy - strokeWidth, 2 * strokeWidth, 2 * strokeWidth, accentColor);
      break;
    }
    case "S": {
      // Down-pointing chevron at bottom
      const yBase = H - 10 * scale;
      // Left leg
      fill(ctx, cx - legLen, yBase - legLen, strokeWidth, legLen, color);
      fill(ctx, cx - legLen + strokeWidth, yBase - legLen + strokeWidth, strokeWidth, legLen - strokeWidth, color);
      // Right leg
      fill(ctx, cx + legLen - strokeWidth, yBase - legLen, strokeWidth, legLen, color);
      fill(ctx, cx + legLen - 2 * strokeWidth, yBase - legLen + strokeWidth, strokeWidth, legLen - strokeWidth, color);
      // Accent tip
      fill(ctx, cx - strokeWidth, yBase - 2 * strokeWidth, 2 * strokeWidth, strokeWidth, accentColor);
      break;
    }
    case "W": {
      // Left-pointing chevron at left
      const xBase = 10 * scale;
      // Top leg
      fill(ctx, xBase + legLen, cy - legLen, legLen, strokeWidth, color);
      fill(ctx, xBase + legLen - strokeWidth, cy - legLen + strokeWidth, legLen - strokeWidth, strokeWidth, color);
      // Bottom leg
      fill(ctx, xBase + legLen, cy + legLen - strokeWidth, legLen, strokeWidth, color);
      fill(ctx, xBase + legLen - strokeWidth, cy + legLen - 2 * strokeWidth, legLen - strokeWidth, strokeWidth, color);
      // Accent tip
      fill(ctx, xBase, cy - strokeWidth, 2 * strokeWidth, 2 * strokeWidth, accentColor);
      break;
    }
  }
}

// ============================================================================
// Fault Warning Badges
// ============================================================================

/**
 * Draw a 32×32-compatible fault warning badge.
 * Positioned at top-right corner: triangle with exclamation mark.
 * Uses UI_PALETTE.warning (orange border) and UI_PALETTE.fault (red fill).
 */
export function drawFaultBadge(ctx: CanvasRenderingContext2D): void {
  const warnColor = UI_PALETTE.warning.css;
  const faultColor = UI_PALETTE.fault.css;

  // Triangle base (approximate triangle as stacked rects)
  const x = 18;
  const y = 2;
  const size = 12;

  // Outer warning triangle (orange)
  fill(ctx, x, y, size, 10, warnColor);
  fill(ctx, x + 1, y + 1, size - 2, 8, warnColor);

  // Inner fault triangle (red)
  fill(ctx, x + 2, y + 2, size - 4, 6, faultColor);
  fill(ctx, x + 3, y + 3, size - 6, 4, faultColor);

  // Exclamation mark (white)
  fill(ctx, x + 5, y + 4, 2, 3, "white");
  fill(ctx, x + 5, y + 8, 2, 2, "white");
}

/**
 * Draw a 64×64 hub-compatible fault warning badge.
 * Scaled ×2 version of drawFaultBadge, positioned at top-right.
 */
export function drawFaultBadge64(ctx: CanvasRenderingContext2D): void {
  const warnColor = UI_PALETTE.warning.css;
  const faultColor = UI_PALETTE.fault.css;

  const x = 36;
  const y = 4;
  const scale = 2;

  // Outer warning triangle (orange) - scaled (12 * 2 = 24)
  const size = 12 * scale;
  fill(ctx, x, y, size, 20, warnColor);
  fill(ctx, x + 2, y + 2, size - 4, 16, warnColor);

  // Inner fault triangle (red) - scaled
  fill(ctx, x + 4, y + 4, size - 8, 12, faultColor);
  fill(ctx, x + 6, y + 6, size - 12, 8, faultColor);

  // Exclamation mark (white) - scaled
  fill(ctx, x + 9, y + 7, 4, 6, "white");
  fill(ctx, x + 9, y + 15, 4, 4, "white");
}
