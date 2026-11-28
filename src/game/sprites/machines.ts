// Production & Observation Facilities (32×32 pixel art)
// Miner, Smelter, Assembler, Recycler, Sensor with animated frames

import { fill, drawDropShadow, drawOutlinedFrame, drawDirectionChevron, drawFaultBadge } from "./buildingHelpers";
import type { Direction } from "../../sim/types";

// Color Constants
const MINER_BASE = "#4169E1", MINER_HIGHLIGHT = "#6495ED", MINER_BEVEL = "#1E3A8A";
const SMELTER_BASE = "#DC143C", SMELTER_HIGHLIGHT = "#FF6B6B", SMELTER_BEVEL = "#8B0000";
const FIRE_ORANGE = "#FF8C00", FLAME_YELLOW = "#FFD700";
const ASSEMBLER_BASE = "#32CD32", ASSEMBLER_HIGHLIGHT = "#7CFC00", ASSEMBLER_BEVEL = "#006400";
const METAL_GRAY = "#708090";
const RECYCLER_BASE = "#BA55D3", RECYCLER_HIGHLIGHT = "#DDA0DD", RECYCLER_BEVEL = "#8B008B";
const SAFETY_YELLOW = "#FFD700", SAFETY_BLACK = "#2F2F2F";
const SENSOR_BASE = "#00FFFF", SENSOR_HIGHLIGHT = "#E0FFFF", SENSOR_BEVEL = "#008B8B";
const LENS_PURPLE = "#9370DB", LED_GREEN = "#00FF00", LED_RED = "#FF0000";
const BEAM_COLOR = "rgba(0, 255, 255, 0.6)";
const OUTLINE = "#1a1a1a";

// ============================================================================
// Helper: Draw steel pillar frame at 4 corners
// ============================================================================

function drawSteelPillars(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cornerSize = 4;
  const pillarColor = "#555555";
  const highlight = "#777777";

  // Top-left
  fill(ctx, x, y, cornerSize, cornerSize, pillarColor);
  fill(ctx, x + 1, y + 1, 2, 2, highlight);
  // Top-right
  fill(ctx, x + 28, y, cornerSize, cornerSize, pillarColor);
  fill(ctx, x + 29, y + 1, 2, 2, highlight);
  // Bottom-left
  fill(ctx, x, y + 28, cornerSize, cornerSize, pillarColor);
  fill(ctx, x + 1, y + 29, 2, 2, highlight);
  // Bottom-right
  fill(ctx, x + 28, y + 28, cornerSize, cornerSize, pillarColor);
  fill(ctx, x + 29, y + 29, 2, 2, highlight);
}

// ============================================================================
// Miner: 4-corner steel pillars + rotating auger + output chute
// ============================================================================

export function drawMiner(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  if (W !== 32 || H !== 32) {
    throw new Error(`drawMiner: expected 32×32 canvas, got ${W}×${H}`);
  }

  // Drop shadow
  drawDropShadow(ctx, 0, 0, 32, 32);

  // Main body with outline
  drawOutlinedFrame(ctx, 0, 0, 32, 32, MINER_BASE, MINER_HIGHLIGHT, MINER_BEVEL, OUTLINE);

  // Steel corner pillars
  drawSteelPillars(ctx, 0, 0);

  // Central auger (rotating based on frame)
  const augerCenterX = 16;
  const augerCenterY = 16;
  const augerRadius = 6;

  ctx.fillStyle = "#444444"; // Dark gray auger body
  ctx.beginPath();
  ctx.arc(augerCenterX, augerCenterY, augerRadius, 0, Math.PI * 2);
  ctx.fill();

  // Auger blades (rotate based on frame)
  ctx.strokeStyle = "#888888"; // Light gray blades
  ctx.lineWidth = 2;
  const rotation = frame === 0 ? 0 : Math.PI / 4;

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI / 2) + rotation;
    const startX = augerCenterX + Math.cos(angle) * 2;
    const startY = augerCenterY + Math.sin(angle) * 2;
    const endX = augerCenterX + Math.cos(angle) * augerRadius;
    const endY = augerCenterY + Math.sin(angle) * augerRadius;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  // Auger center hub
  fill(ctx, augerCenterX - 2, augerCenterY - 2, 4, 4, "#666666");

  // Output chute (pointing in direction)
  ctx.fillStyle = "#3A5F8A";
  switch (dir) {
    case "N":
      fill(ctx, 14, 4, 4, 6, "#3A5F8A");
      break;
    case "E":
      fill(ctx, 24, 14, 6, 4, "#3A5F8A");
      break;
    case "S":
      fill(ctx, 14, 22, 4, 6, "#3A5F8A");
      break;
    case "W":
      fill(ctx, 2, 14, 6, 4, "#3A5F8A");
      break;
  }

  // Direction chevron
  drawDirectionChevron(ctx, dir, MINER_HIGHLIGHT, FLAME_YELLOW);

  // Fault badge if needed
  if (faulted) {
    drawFaultBadge(ctx);
  }
}

// ============================================================================
// Smelter:耐火レンガ + chimney + molten furnace hearth + flickering flames
// ============================================================================

export function drawSmelter(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  if (W !== 32 || H !== 32) {
    throw new Error(`drawSmelter: expected 32×32 canvas, got ${W}×${H}`);
  }

  // Drop shadow
  drawDropShadow(ctx, 0, 0, 32, 32);

  // Main body
  drawOutlinedFrame(ctx, 0, 0, 32, 32, SMELTER_BASE, SMELTER_HIGHLIGHT, SMELTER_BEVEL, OUTLINE);

  // Brick texture pattern (alternating dark pixels)
  ctx.fillStyle = "#5A0A0A";
  for (let ry = 4; ry < 28; ry += 4) {
    for (let rx = 2; rx < 30; rx += 4) {
      fill(ctx, rx, ry, 2, 2, "#5A0A0A");
    }
  }

  // Chimney on top
  ctx.fillStyle = "#5A0A0A";
  fill(ctx, 12, 0, 8, 6, "#5A0A0A");
  fill(ctx, 10, 0, 12, 2, "#5A0A0A");
  // Chimney highlight
  fill(ctx, 13, 1, 4, 4, "#7A0A0A");

  // Furnace opening (center)
  ctx.fillStyle = "#2A0A0A";
  fill(ctx, 10, 10, 12, 12, "#2A0A0A");

  // Molten core glow
  const glowIntensity = frame === 0 ? 0 : 2;
  ctx.fillStyle = `rgb(${200 + glowIntensity * 20}, ${50 + glowIntensity * 10}, 0)`;
  fill(ctx, 12, 12, 8, 8, `rgb(${200 + glowIntensity * 20}, ${50 + glowIntensity * 10}, 0)`);

  // Flickering flames
  ctx.fillStyle = FIRE_ORANGE;
  const flameOffset = frame === 0 ? 0 : 1;
  fill(ctx, 13, 13 + flameOffset, 2, 4, FIRE_ORANGE);
  fill(ctx, 17, 12 + flameOffset, 2, 5, FIRE_ORANGE);
  
  ctx.fillStyle = FLAME_YELLOW;
  fill(ctx, 14, 14 + flameOffset, 2, 2, FLAME_YELLOW);
  fill(ctx, 18, 13 + flameOffset, 2, 3, FLAME_YELLOW);

  // Smoke particles from chimney (subtle)
  ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
  const smokePhase = frame === 0 ? 0 : 2;
  fill(ctx, 14 + smokePhase, 0, 2, 2, "rgba(100, 100, 100, 0.5)");
  fill(ctx, 18 - smokePhase, 0, 2, 2, "rgba(100, 100, 100, 0.4)");

  // Direction chevron
  drawDirectionChevron(ctx, dir, SMELTER_HIGHLIGHT, FLAME_YELLOW);

  // Fault badge if needed
  if (faulted) {
    drawFaultBadge(ctx);
  }
}

// ============================================================================
// Assembler: metal frame + workbench/gears + moving robotic arm
// ============================================================================

export function drawAssembler(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  if (W !== 32 || H !== 32) {
    throw new Error(`drawAssembler: expected 32×32 canvas, got ${W}×${H}`);
  }

  // Drop shadow
  drawDropShadow(ctx, 0, 0, 32, 32);

  // Main body
  drawOutlinedFrame(ctx, 0, 0, 32, 32, ASSEMBLER_BASE, ASSEMBLER_HIGHLIGHT, ASSEMBLER_BEVEL, OUTLINE);

  // Metal frame structure
  ctx.fillStyle = METAL_GRAY;
  // Vertical supports
  fill(ctx, 4, 4, 3, 24, METAL_GRAY);
  fill(ctx, 25, 4, 3, 24, METAL_GRAY);
  // Horizontal braces
  fill(ctx, 4, 8, 24, 2, METAL_GRAY);
  fill(ctx, 4, 22, 24, 2, METAL_GRAY);

  // Central workbench area
  ctx.fillStyle = "#2D5016";
  fill(ctx, 8, 10, 16, 12, "#2D5016");

  // Gear mechanism (rotating based on frame)
  const gearCenterX = 16;
  const gearCenterY = 16;
  const gearRadius = 4;

  ctx.fillStyle = "#696969"; // Dim gray gear
  // Draw gear teeth
  const gearRotation = frame === 0 ? 0 : Math.PI / 8;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI / 4) + gearRotation;
    const toothX = gearCenterX + Math.cos(angle) * (gearRadius + 2);
    const toothY = gearCenterY + Math.sin(angle) * (gearRadius + 2);
    fill(ctx, Math.floor(toothX) - 1, Math.floor(toothY) - 1, 2, 2, "#696969");
  }
  // Gear center
  fill(ctx, gearCenterX - 2, gearCenterY - 2, 4, 4, "#A9A9A9");

  // Robotic arm (animated based on frame)
  ctx.fillStyle = "#808080";
  const armAngle = frame === 0 ? -Math.PI / 6 : Math.PI / 6;
  const armLength = 8;
  const armBaseX = 22;
  const armBaseY = 16;
  
  // Arm segments
  const armEndX = armBaseX + Math.cos(armAngle) * armLength;
  const armEndY = armBaseY + Math.sin(armAngle) * armLength;
  
  fill(ctx, armBaseX - 2, armBaseY - 2, 4, 4, "#808080");
  fill(ctx, armBaseX + 2, armBaseY - 1, Math.floor(armEndX - armBaseX), 2, "#808080");
  fill(ctx, Math.floor(armEndX) - 2, Math.floor(armEndY) - 2, 4, 4, "#696969");

  // Direction chevron
  drawDirectionChevron(ctx, dir, ASSEMBLER_HIGHLIGHT, FLAME_YELLOW);

  // Fault badge if needed
  if (faulted) {
    drawFaultBadge(ctx);
  }
}

// ============================================================================
// Recycler: hopper + crushing rollers + safety stripes
// ============================================================================

export function drawRecycler(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  if (W !== 32 || H !== 32) {
    throw new Error(`drawRecycler: expected 32×32 canvas, got ${W}×${H}`);
  }

  // Drop shadow
  drawDropShadow(ctx, 0, 0, 32, 32);

  // Main body
  drawOutlinedFrame(ctx, 0, 0, 32, 32, RECYCLER_BASE, RECYCLER_HIGHLIGHT, RECYCLER_BEVEL, OUTLINE);

  // Top hopper (funnel shape)
  ctx.fillStyle = "#6B3FA0";
  fill(ctx, 8, 4, 16, 6, "#6B3FA0");
  fill(ctx, 10, 10, 12, 4, "#6B3FA0");

  // Safety stripes (diagonal yellow/black pattern)
  ctx.fillStyle = SAFETY_YELLOW;
  for (let i = 0; i < 6; i++) {
    const stripeX = 6 + i * 4;
    fill(ctx, stripeX, 14, 2, 14, SAFETY_YELLOW);
    fill(ctx, stripeX + 2, 14 + 2, 2, 12, SAFETY_BLACK);
  }

  // Crushing rollers (animated rotation)
  const rollerY = 18;
  const rollerRotation = frame === 0 ? 0 : Math.PI / 6;
  
  ctx.fillStyle = "#444444";
  // Left roller
  fill(ctx, 8, rollerY - 2, 6, 4, "#444444");
  // Right roller  
  fill(ctx, 18, rollerY - 2, 6, 4, "#444444");

  // Roller teeth (visible based on rotation)
  ctx.fillStyle = "#666666";
  if (frame === 0) {
    fill(ctx, 10, rollerY - 3, 2, 2, "#666666");
    fill(ctx, 20, rollerY - 3, 2, 2, "#666666");
  } else {
    fill(ctx, 10, rollerY - 1, 2, 2, "#666666");
    fill(ctx, 20, rollerY + 1, 2, 2, "#666666");
  }

  // Material input indicator
  ctx.fillStyle = "#8B45A0";
  fill(ctx, 14, 2, 4, 3, "#8B45A0");

  // Direction chevron
  drawDirectionChevron(ctx, dir, RECYCLER_HIGHLIGHT, FLAME_YELLOW);

  // Fault badge if needed
  if (faulted) {
    drawFaultBadge(ctx);
  }
}

// ============================================================================
// Sensor: observation base + radar/optical lens + status LED + scan beam
// ============================================================================

export function drawSensor(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  if (W !== 32 || H !== 32) {
    throw new Error(`drawSensor: expected 32×32 canvas, got ${W}×${H}`);
  }

  // Drop shadow
  drawDropShadow(ctx, 0, 0, 32, 32);

  // Main body
  drawOutlinedFrame(ctx, 0, 0, 32, 32, SENSOR_BASE, SENSOR_HIGHLIGHT, SENSOR_BEVEL, OUTLINE);

  // Base platform
  ctx.fillStyle = "#006666";
  fill(ctx, 6, 20, 20, 8, "#006666");

  // Central support pillar
  ctx.fillStyle = "#008B8B";
  fill(ctx, 14, 10, 4, 14, "#008B8B");

  // Radar/optical lens assembly
  ctx.fillStyle = LENS_PURPLE;
  fill(ctx, 10, 6, 12, 10, LENS_PURPLE);
  
  // Lens center (glowing)
  const lensGlow = frame === 0 ? "#C9A0FF" : "#E0B0FF";
  fill(ctx, 13, 8, 6, 6, lensGlow);
  
  // Lens ring
  ctx.fillStyle = "#6A5ACD";
  fill(ctx, 11, 7, 10, 8, "#6A5ACD");

  // Support struts
  ctx.fillStyle = "#555555";
  fill(ctx, 12, 14, 2, 6, "#555555");
  fill(ctx, 18, 14, 2, 6, "#555555");

  // Status LED (green = OK, red = fault)
  const ledColor = faulted ? LED_RED : LED_GREEN;
  fill(ctx, 24, 6, 4, 4, ledColor);
  // LED glow
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  fill(ctx, 25, 7, 2, 2, "rgba(255, 255, 255, 0.4)");

  // Scan beam (animated, directional)
  ctx.fillStyle = BEAM_COLOR;
  const beamOffset = frame === 0 ? 0 : 2;
  switch (dir) {
    case "N":
      fill(ctx, 14, 0 + beamOffset, 4, 8, BEAM_COLOR);
      break;
    case "E":
      fill(ctx, 24 - beamOffset, 14, 8, 4, BEAM_COLOR);
      break;
    case "S":
      fill(ctx, 14, 24 - beamOffset, 4, 8, BEAM_COLOR);
      break;
    case "W":
      fill(ctx, 0 + beamOffset, 14, 8, 4, BEAM_COLOR);
      break;
  }

  // Direction chevron
  drawDirectionChevron(ctx, dir, SENSOR_HIGHLIGHT, FLAME_YELLOW);

  // Fault badge if needed
  if (faulted) {
    drawFaultBadge(ctx);
  }
}
