// 物流系 4 施設の 32×32 高精細ピクセルアート描画関数
import { getBuildingColor } from "../palette";
import type { Direction } from "../../sim/types";
import { fill, drawDropShadow, drawFaultBadge } from "./buildingHelpers";

const METAL_DARK = "#2F4F4F", METAL_BASE = "#708090", METAL_LIGHT = "#A9A9A9";
const METAL_HIGHLIGHT = "#C0C0C0", RUBBER_BLACK = "#1C1C1C", RUBBER_DARK = "#2A2A2A";
const CHEVRON_YELLOW = "#FFD700", WARNING_STRIPE = "#FFA500";

// Draw chevron pointing in given direction at (cx, cy)
function drawChevron(ctx: CanvasRenderingContext2D, dir: Direction, cx: number, cy: number, color: string): void {
  const stroke = 2;
  switch (dir) {
    case "N": // Up-pointing
      fill(ctx, cx - 5, cy - 3, stroke, 6, color);
      fill(ctx, cx - 3, cy - 5, stroke, 2, color);
      fill(ctx, cx + 3, cy - 3, stroke, 6, color);
      fill(ctx, cx + 1, cy - 5, stroke, 2, color);
      break;
    case "S": // Down-pointing
      fill(ctx, cx - 5, cy - 3, stroke, 6, color);
      fill(ctx, cx - 3, cy + 3, stroke, 2, color);
      fill(ctx, cx + 3, cy - 3, stroke, 6, color);
      fill(ctx, cx + 1, cy + 3, stroke, 2, color);
      break;
    case "E": // Right-pointing
      fill(ctx, cx - 3, cy - 5, 6, stroke, color);
      fill(ctx, cx + 3, cy - 3, 2, stroke, color);
      fill(ctx, cx - 3, cy + 3, 6, stroke, color);
      fill(ctx, cx + 3, cy + 1, 2, stroke, color);
      break;
    case "W": // Left-pointing
      fill(ctx, cx - 3, cy - 5, 6, stroke, color);
      fill(ctx, cx - 5, cy - 3, 2, stroke, color);
      fill(ctx, cx - 3, cy + 3, 6, stroke, color);
      fill(ctx, cx - 5, cy + 1, 2, stroke, color);
      break;
  }
}

// Horizontal belt (E/W direction): spans x=0..31, centered vertically
function drawHBeltHorizontal(ctx: CanvasRenderingContext2D, frame: number, dir: Direction): void {
  const beltYStart = 6, beltHeight = 20;
  // Metal guide rails top and bottom
  fill(ctx, 0, beltYStart - 1, 32, 1, METAL_DARK);
  fill(ctx, 0, beltYStart + beltHeight, 32, 1, METAL_DARK);
  // Rubber belt body
  for (let y = beltYStart; y < beltYStart + beltHeight; y++) {
    fill(ctx, 0, y, 32, 1, (y === beltYStart || y === beltYStart + beltHeight - 1) ? METAL_DARK : RUBBER_BLACK);
  }
  fill(ctx, 0, beltYStart + 2, 32, beltHeight - 4, RUBBER_DARK);
  // Chevron arrows scrolling horizontally with direction-aware pointing
  const scrollX = frame * 4;
  const chevronDir = dir === "W" ? "W" : "E";
  for (let baseX = 0; baseX < 32; baseX += 8) {
    const xPos = ((baseX + scrollX) % 32) - 4;
    if (xPos >= -6 && xPos < 32) drawChevron(ctx, chevronDir, xPos + 4, beltYStart + beltHeight / 2, CHEVRON_YELLOW);
  }
  // Side highlights
  fill(ctx, 0, beltYStart + 1, 32, 2, METAL_HIGHLIGHT);
  fill(ctx, 0, beltYStart + beltHeight - 3, 32, 2, METAL_LIGHT);
}

// Vertical belt (N/S direction): spans y=0..31, centered horizontally
function drawBeltVertical(ctx: CanvasRenderingContext2D, frame: number, dir: Direction): void {
  const beltXStart = 6, beltWidth = 20;
  // Metal guide rails left and right
  fill(ctx, beltXStart - 1, 0, 1, 32, METAL_DARK);
  fill(ctx, beltXStart + beltWidth, 0, 1, 32, METAL_DARK);
  // Rubber belt body
  for (let x = beltXStart; x < beltXStart + beltWidth; x++) {
    fill(ctx, x, 0, 1, 32, (x === beltXStart || x === beltXStart + beltWidth - 1) ? METAL_DARK : RUBBER_BLACK);
  }
  fill(ctx, beltXStart + 2, 0, beltWidth - 4, 32, RUBBER_DARK);
  // Chevron arrows scrolling vertically
  const scrollY = frame * 4;
  const chevronDir = dir === "N" ? "N" : "S";
  for (let baseY = 0; baseY < 32; baseY += 8) {
    const yPos = ((baseY + scrollY) % 32) - 4;
    if (yPos >= -6 && yPos < 32) drawChevron(ctx, chevronDir, beltXStart + beltWidth / 2, yPos + 4, CHEVRON_YELLOW);
  }
  // Side highlights
  fill(ctx, beltXStart + 1, 0, 2, 32, METAL_HIGHLIGHT);
  fill(ctx, beltXStart + beltWidth - 3, 0, 2, 32, METAL_LIGHT);
}

export function drawBelt(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  if (frame !== 0 && frame !== 1) throw new Error(`drawBelt: invalid frame ${frame}`);
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 0, 0, 32, 32);
  // N/S = vertical belt (spans y=0..31), E/W = horizontal belt (spans x=0..31)
  if (dir === "N" || dir === "S") {
    drawBeltVertical(ctx, frame, dir);
  } else {
    drawHBeltHorizontal(ctx, frame, dir);
  }
  if (faulted) drawFaultBadge(ctx);
}

export function drawSplitter(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  if (frame !== 0 && frame !== 1) throw new Error(`drawSplitter: invalid frame ${frame}`);
  const baseColor = getBuildingColor("splitter").css;
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 0, 0, 32, 32);
  fill(ctx, 4, 4, 24, 24, "#8B0000");
  fill(ctx, 5, 5, 22, 22, baseColor);
  fill(ctx, 5, 5, 22, 2, "#FF6347");
  fill(ctx, 5, 25, 22, 2, "#CD5C5C");
  const inputPos = {N:{x:12,y:20},E:{x:20,y:12},S:{x:12,y:4},W:{x:4,y:12}}[dir];
  fill(ctx, inputPos.x, inputPos.y, 8, 8, METAL_HIGHLIGHT);
  fill(ctx, inputPos.x+1, inputPos.y+1, 6, 6, METAL_BASE);
  const shootPos = {N:{x:13,y:0},E:{x:26,y:13},S:{x:13,y:26},W:{x:0,y:13}}[dir];
  fill(ctx, shootPos.x, shootPos.y, 6, 6, METAL_LIGHT);
  fill(ctx, shootPos.x+1, shootPos.y+1, 4, 4, METAL_HIGHLIGHT);
  const sideOffsets = {N:[{x:6,y:0},{x:21,y:0}],E:[{x:26,y:6},{x:26,y:21}],S:[{x:6,y:26},{x:21,y:26}],W:[{x:0,y:6},{x:0,y:21}]}[dir];
  for (const o of sideOffsets) { fill(ctx, o.x, o.y, 5, 5, METAL_BASE); fill(ctx, o.x+1, o.y+1, 3, 3, METAL_LIGHT); }
  fill(ctx, 12, 12, 8, 8, METAL_DARK); fill(ctx, 13, 13, 6, 6, METAL_BASE);
  if (frame === 0) { fill(ctx, 26, 2, 4, 4, "#00FF00"); fill(ctx, 27, 3, 2, 2, "#90EE90"); }
  if (faulted) drawFaultBadge(ctx);
}

export function drawFilterSplitter(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  if (frame !== 0 && frame !== 1) throw new Error(`drawFilterSplitter: invalid frame ${frame}`);
  const baseColor = getBuildingColor("filter_splitter").css;
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 0, 0, 32, 32);
  fill(ctx, 4, 4, 24, 24, "#8B0050");
  fill(ctx, 5, 5, 22, 22, baseColor);
  fill(ctx, 5, 5, 22, 2, "#FF1493");
  fill(ctx, 5, 25, 22, 2, "#DB7093");
  const inputPos = {N:{x:12,y:20},E:{x:20,y:12},S:{x:12,y:4},W:{x:4,y:12}}[dir];
  fill(ctx, inputPos.x, inputPos.y, 8, 8, METAL_HIGHLIGHT);
  fill(ctx, inputPos.x+1, inputPos.y+1, 6, 6, METAL_BASE);
  const shootPos = {N:{x:13,y:0},E:{x:26,y:13},S:{x:13,y:26},W:{x:0,y:13}}[dir];
  fill(ctx, shootPos.x, shootPos.y, 6, 6, METAL_LIGHT);
  fill(ctx, shootPos.x+1, shootPos.y+1, 4, 4, METAL_HIGHLIGHT);
  const sideOffsets = {N:[{x:6,y:0},{x:21,y:0}],E:[{x:26,y:6},{x:26,y:21}],S:[{x:6,y:26},{x:21,y:26}],W:[{x:0,y:6},{x:0,y:21}]}[dir];
  for (const o of sideOffsets) { fill(ctx, o.x, o.y, 5, 5, METAL_BASE); fill(ctx, o.x+1, o.y+1, 3, 3, METAL_LIGHT); }
  fill(ctx, 12, 12, 8, 8, METAL_DARK); fill(ctx, 13, 13, 6, 6, METAL_BASE);
  for (let i = 0; i < 3; i++) { const sx = 6 + i * 5; fill(ctx, sx, 6, 4, 3, "#8B0050"); fill(ctx, sx+1, 7, 2, 1, "#000"); if (i===1&&frame===0) fill(ctx, sx+2, 7, 2, 1, "#0F0"); }
  fill(ctx, 22, 18, 8, 5, "#2F4F4F"); fill(ctx, 23, 19, 6, 3, "#0F0"); fill(ctx, 24, 20, 2, 1, "#90EE90"); fill(ctx, 27, 20, 2, 1, "#90EE90");
  if (faulted) drawFaultBadge(ctx);
}

// Underground belt with direction-aware rendering
export function drawUndergroundBelt(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  if (frame !== 0 && frame !== 1) throw new Error(`drawUndergroundBelt: invalid frame ${frame}`);
  const baseColor = getBuildingColor("underground_belt").css;
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 0, 0, 32, 32);

  if (dir === "N" || dir === "S") {
    // Vertical tunnel (spans y=0..31)
    const tunnelX = 8, tunnelWidth = 16;
    fill(ctx, tunnelX - 1, 0, tunnelWidth + 2, 32, METAL_DARK);
    fill(ctx, tunnelX, 0, tunnelWidth, 32, baseColor);
    fill(ctx, tunnelX + 1, 0, tunnelWidth - 2, 32, METAL_BASE);
    fill(ctx, tunnelX, 0, tunnelWidth, 2, METAL_HIGHLIGHT);
    // Warning stripes scrolling vertically
    const scrollY = frame * 2;
    for (let baseY = 0; baseY < 32; baseY += 8) {
      const yPos = (baseY + scrollY) % 32;
      fill(ctx, tunnelX + 2, yPos, 4, 2, WARNING_STRIPE);
      fill(ctx, tunnelX + 6, yPos + 1, 4, 2, WARNING_STRIPE);
    }
    // Entrance (dark opening)
    const entranceX = tunnelX + 4, entranceWidth = 8;
    fill(ctx, entranceX, 0, entranceWidth, 1, METAL_DARK);
    fill(ctx, entranceX, 30, entranceWidth, 1, METAL_DARK);
    for (let y = 0; y < 30; y++) {
      fill(ctx, entranceX, y, entranceWidth, 1, `rgba(0,0,0,${0.3 + y/30*0.4})`);
    }
    // Scrollable belt inside
    const beltScroll = frame * 3;
    for (let by = 0; by < 32; by += 6) {
      const yPos = (by + beltScroll) % 32;
      fill(ctx, entranceX, yPos, entranceWidth, 1, CHEVRON_YELLOW);
    }
    // Rivets on sides
    for (const rx of [4, 12, 20, 28]) {
      fill(ctx, tunnelX - 1, rx, 2, 2, METAL_HIGHLIGHT);
      fill(ctx, tunnelX + tunnelWidth, rx, 2, 2, METAL_HIGHLIGHT);
    }
    // Direction indicator at front
    const frontY = dir === "N" ? 28 : 0;
    fill(ctx, tunnelX + 4, frontY, 8, 2, CHEVRON_YELLOW);
    if (faulted) drawFaultBadge(ctx);
  } else {
    // Horizontal tunnel (spans x=0..31)
    const tunnelY = 8, tunnelHeight = 16;
    fill(ctx, 0, tunnelY - 1, 32, tunnelHeight + 2, METAL_DARK);
    fill(ctx, 0, tunnelY, 32, tunnelHeight, baseColor);
    fill(ctx, 0, tunnelY + 1, 32, tunnelHeight - 2, METAL_BASE);
    fill(ctx, 0, tunnelY, 32, 2, METAL_HIGHLIGHT);
    // Warning stripes scrolling horizontally
    const scrollX = frame * 2;
    for (let baseX = 0; baseX < 32; baseX += 8) {
      const xPos = (baseX + scrollX) % 32;
      fill(ctx, xPos, tunnelY + 2, 2, 4, WARNING_STRIPE);
      fill(ctx, xPos + 1, tunnelY + 6, 2, 4, WARNING_STRIPE);
    }
    // Entrance (dark opening)
    const entranceY = tunnelY + 4, entranceHeight = 8;
    fill(ctx, 0, entranceY, 1, entranceHeight, METAL_DARK);
    fill(ctx, 30, entranceY, 1, entranceHeight, METAL_DARK);
    for (let x = 0; x < 30; x++) {
      fill(ctx, x, entranceY, 1, entranceHeight, `rgba(0,0,0,${0.3 + x/30*0.4})`);
    }
    // Scrollable belt inside
    const beltScroll = frame * 3;
    for (let bx = 0; bx < 32; bx += 6) {
      const xPos = (bx + beltScroll) % 32;
      fill(ctx, xPos, entranceY + 2, 1, entranceHeight - 4, CHEVRON_YELLOW);
    }
    // Rivets on top/bottom
    for (const ry of [4, 12, 20, 28]) {
      fill(ctx, ry, tunnelY - 1, 2, 2, METAL_HIGHLIGHT);
      fill(ctx, ry, tunnelY + tunnelHeight, 2, 2, METAL_HIGHLIGHT);
    }
    // Direction indicator at front
    const frontX = dir === "E" ? 28 : 0;
    fill(ctx, frontX, tunnelY + 4, 2, 8, CHEVRON_YELLOW);
    if (faulted) drawFaultBadge(ctx);
  }
}
