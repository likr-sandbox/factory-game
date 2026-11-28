// Central Delivery Hub (64×64 pixel art)
// Native resolution with energy core, conveyor inputs, cooling fins & antennas

import { px, fill, drawDropShadow, drawOutlinedFrame, drawFaultBadge64 } from "./buildingHelpers";
import { UI_PALETTE } from "../palette";
import type { Direction } from "../../sim/types";

// ============================================================================
// Color Constants
// ============================================================================

const HUB_BASE = "#FF4500";        // Orange red
const HUB_HIGHLIGHT = "#FF8C42";   // Light orange
const HUB_BEVEL = "#8B2500";       // Dark red-orange
const CORE_BLUE = "#4169E1";       // Royal blue
const CORE_GLOW = "#87CEEB";       // Sky blue
const CONVEYOR_BROWN = "#8B4513";  // Saddle brown
const COOLING_FIN_GRAY = "#696969";      // Dim gray
const ANTENNA_SILVER = "#C0C0C0";        // Silver
const OUTLINE = "#1a1a1a";               // Nearly black

// ============================================================================
// Energy Core (animated pulse based on frame)
// ============================================================================

function drawEnergyCore(ctx: CanvasRenderingContext2D, frame: number): void {
  const centerX = 32;
  const centerY = 32;
  
  // Outer core ring
  const pulseSize = frame === 0 ? 12 : 14;
  ctx.fillStyle = CORE_BLUE;
  fill(ctx, centerX - pulseSize, centerY - pulseSize, pulseSize * 2, pulseSize * 2, CORE_BLUE);
  
  // Inner glowing core
  const innerSize = frame === 0 ? 8 : 10;
  ctx.fillStyle = CORE_GLOW;
  fill(ctx, centerX - innerSize, centerY - innerSize, innerSize * 2, innerSize * 2, CORE_GLOW);
  
  // Core center (bright white)
  ctx.fillStyle = "#FFFFFF";
  const centerSize = frame === 0 ? 4 : 5;
  fill(ctx, centerX - centerSize, centerY - centerSize, centerSize * 2, centerSize * 2, "#FFFFFF");
  
  // Energy aura (subtle glow effect)
  ctx.fillStyle = "rgba(135, 206, 235, 0.3)";
  const auraSize = frame === 0 ? 16 : 18;
  fill(ctx, centerX - auraSize, centerY - auraSize, auraSize * 2, auraSize * 2, "rgba(135, 206, 235, 0.3)");
}

// ============================================================================
// Conveyor Belt Input Receivers (on all 4 sides)
// ============================================================================

function drawConveyorInputs(ctx: CanvasRenderingContext2D): void {
  const conveyorColor = CONVEYOR_BROWN;
  const beltHighlight = "#A0522D";
  
  // North input (top edge)
  fill(ctx, 24, 0, 16, 6, conveyorColor);
  fill(ctx, 26, 1, 12, 4, beltHighlight);
  
  // South input (bottom edge)
  fill(ctx, 24, 58, 16, 6, conveyorColor);
  fill(ctx, 26, 59, 12, 4, beltHighlight);
  
  // East input (right edge)
  fill(ctx, 58, 24, 6, 16, conveyorColor);
  fill(ctx, 59, 26, 4, 12, beltHighlight);
  
  // West input (left edge)
  fill(ctx, 0, 24, 6, 16, conveyorColor);
  fill(ctx, 1, 26, 4, 12, beltHighlight);
}

// ============================================================================
// Cooling Fins (at 4 corners)
// ============================================================================

function drawCoolingFins(ctx: CanvasRenderingContext2D): void {
  const finColor = COOLING_FIN_GRAY;
  const finHighlight = "#808080";
  
  // Top-left corner fins
  for (let i = 0; i < 3; i++) {
    fill(ctx, 2 + i * 3, 2, 2, 8, finColor);
    fill(ctx, 3 + i * 3, 3, 1, 6, finHighlight);
  }
  
  // Top-right corner fins
  for (let i = 0; i < 3; i++) {
    fill(ctx, 58 - i * 3, 2, 2, 8, finColor);
    fill(ctx, 57 - i * 3, 3, 1, 6, finHighlight);
  }
  
  // Bottom-left corner fins
  for (let i = 0; i < 3; i++) {
    fill(ctx, 2 + i * 3, 54, 2, 8, finColor);
    fill(ctx, 3 + i * 3, 55, 1, 6, finHighlight);
  }
  
  // Bottom-right corner fins
  for (let i = 0; i < 3; i++) {
    fill(ctx, 58 - i * 3, 54, 2, 8, finColor);
    fill(ctx, 57 - i * 3, 55, 1, 6, finHighlight);
  }
}

// ============================================================================
// Antennas (at 4 corners, extending upward)
// ============================================================================

function drawAntennas(ctx: CanvasRenderingContext2D): void {
  const antennaColor = ANTENNA_SILVER;
  const antennaBase = "#808080";
  const tipRed = "#FF0000";
  
  // Top-left antenna
  fill(ctx, 6, 0, 3, 8, antennaColor);
  fill(ctx, 5, 0, 5, 3, antennaBase);
  fill(ctx, 7, 0, 1, 2, tipRed);
  
  // Top-right antenna
  fill(ctx, 55, 0, 3, 8, antennaColor);
  fill(ctx, 54, 0, 5, 3, antennaBase);
  fill(ctx, 56, 0, 1, 2, tipRed);
  
  // Bottom-left antenna
  fill(ctx, 6, 56, 3, 8, antennaColor);
  fill(ctx, 5, 56, 5, 3, antennaBase);
  fill(ctx, 7, 62, 1, 2, tipRed);
  
  // Bottom-right antenna
  fill(ctx, 55, 56, 3, 8, antennaColor);
  fill(ctx, 54, 56, 5, 3, antennaBase);
  fill(ctx, 56, 62, 1, 2, tipRed);
}

// ============================================================================
// Main Hub Body with details
// ============================================================================

function drawHubBody(ctx: CanvasRenderingContext2D): void {
  // Main body with outline
  drawOutlinedFrame(ctx, 0, 0, 64, 64, HUB_BASE, HUB_HIGHLIGHT, HUB_BEVEL, OUTLINE);
  
  // Decorative panel lines
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  // Vertical panels
  for (let x = 10; x < 60; x += 10) {
    fill(ctx, x, 8, 1, 48, "rgba(0, 0, 0, 0.2)");
  }
  // Horizontal panels
  for (let y = 10; y < 60; y += 10) {
    fill(ctx, 8, y, 48, 1, "rgba(0, 0, 0, 0.2)");
  }
  
  // Corner reinforcements
  ctx.fillStyle = "#A0522D";
  fill(ctx, 4, 4, 6, 6, "#A0522D");
  fill(ctx, 54, 4, 6, 6, "#A0522D");
  fill(ctx, 4, 54, 6, 6, "#A0522D");
  fill(ctx, 54, 54, 6, 6, "#A0522D");
}

// ============================================================================
// Status Indicators (side panels)
// ============================================================================

function drawStatusIndicators(ctx: CanvasRenderingContext2D, faulted: boolean): void {
  const ledOn = faulted ? "#FF0000" : "#00FF00";
  const ledOff = "#333333";
  
  // Left side indicators
  fill(ctx, 8, 20, 3, 3, ledOn);
  fill(ctx, 8, 25, 3, 3, ledOff);
  fill(ctx, 8, 30, 3, 3, ledOff);
  
  // Right side indicators
  fill(ctx, 53, 20, 3, 3, ledOn);
  fill(ctx, 53, 25, 3, 3, ledOff);
  fill(ctx, 53, 30, 3, 3, ledOff);
}

// ============================================================================
// Main Hub Drawing Function
// ============================================================================

export function drawHub(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  if (W !== 64 || H !== 64) {
    throw new Error(`drawHub: expected 64×64 canvas, got ${W}×${H}`);
  }

  // Drop shadow (scaled for larger size)
  const shadowColor = "rgba(0, 0, 0, 0.35)";
  fill(ctx, 2, 2, 64, 64, shadowColor);

  // Draw main body
  drawHubBody(ctx);
  
  // Draw cooling fins at corners
  drawCoolingFins(ctx);
  
  // Draw antennas
  drawAntennas(ctx);
  
  // Draw conveyor belt inputs on all 4 sides
  drawConveyorInputs(ctx);
  
  // Draw energy core (animated pulse)
  drawEnergyCore(ctx, frame);
  
  // Draw status indicators
  drawStatusIndicators(ctx, faulted);
  
  // Draw fault badge if needed (NO direction indicator/arrow per requirements)
  if (faulted) {
    drawFaultBadge64(ctx);
  }
  
  // Note: Per requirements, we do NOT draw drawDirectionIndicator (white arrow)
  // The hub receives inputs from all 4 directions, so no single direction indicator is needed
}
