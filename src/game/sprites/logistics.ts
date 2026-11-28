// 物流系 4 施設の 32×32 高精細ピクセルアート描画関数
import { getBuildingColor } from "../palette";
import type { Direction } from "../../sim/types";
import { px, fill, drawDropShadow, drawFaultBadge } from "./buildingHelpers";

const METAL_DARK = "#2F4F4F", METAL_BASE = "#708090", METAL_LIGHT = "#A9A9A9";
const METAL_HIGHLIGHT = "#C0C0C0", RUBBER_BLACK = "#1C1C1C", RUBBER_DARK = "#2A2A2A";
const CHEVRON_YELLOW = "#FFD700", WARNING_STRIPE = "#FFA500";

function drawBeltInner(ctx: CanvasRenderingContext2D): void {
  const beltYStart = 6, beltHeight = 20;
  fill(ctx, 0, beltYStart - 1, 32, 1, METAL_DARK);
  fill(ctx, 0, beltYStart + beltHeight, 32, 1, METAL_DARK);
  for (let y = beltYStart; y < beltYStart + beltHeight; y++) {
    fill(ctx, 0, y, 32, 1, (y === beltYStart || y === beltYStart + beltHeight - 1) ? METAL_DARK : RUBBER_BLACK);
  }
  fill(ctx, 0, beltYStart + 2, 32, beltHeight - 4, RUBBER_DARK);
  for (let cx = 0; cx < 32; cx += 8) {
    const xPos = cx % 32, cy = beltYStart + beltHeight / 2, legLen = 5, stroke = 2;
    fill(ctx, xPos - legLen, cy - legLen + 2, stroke, legLen, CHEVRON_YELLOW);
    fill(ctx, xPos - legLen + stroke, cy - legLen + 2 + stroke, stroke, legLen - stroke, CHEVRON_YELLOW);
    fill(ctx, xPos + legLen - stroke, cy - legLen + 2, stroke, legLen, CHEVRON_YELLOW);
    fill(ctx, xPos + legLen - 2 * stroke, cy - legLen + 2 + stroke, stroke, legLen - stroke, CHEVRON_YELLOW);
  }
  fill(ctx, 0, beltYStart + 1, 32, 2, METAL_HIGHLIGHT);
  fill(ctx, 0, beltYStart + beltHeight - 3, 32, 2, METAL_LIGHT);
}

export function drawBelt(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  if (frame !== 0 && frame !== 1) throw new Error(`drawBelt: invalid frame ${frame}`);
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 0, 0, 32, 32);
  const offscreen = document.createElement("canvas");
  offscreen.width = 32; offscreen.height = 32;
  const offCtx = offscreen.getContext("2d")!;
  drawBeltInner(offCtx);
  ctx.save(); ctx.translate(16, 16);
  if (dir === "E") ctx.rotate(Math.PI / 2);
  else if (dir === "S") ctx.rotate(Math.PI);
  else if (dir === "W") ctx.rotate(-Math.PI / 2);
  ctx.drawImage(offscreen, -16, -16);
  ctx.restore();
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

export function drawUndergroundBelt(ctx: CanvasRenderingContext2D, dir: Direction, frame: number, faulted: boolean): void {
  if (frame !== 0 && frame !== 1) throw new Error(`drawUndergroundBelt: invalid frame ${frame}`);
  const baseColor = getBuildingColor("underground_belt").css;
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 0, 0, 32, 32);
  const tunnelY = 8, tunnelHeight = 16;
  fill(ctx, 0, tunnelY, 32, tunnelHeight, METAL_DARK);
  fill(ctx, 0, tunnelY + 1, 32, tunnelHeight - 2, baseColor);
  fill(ctx, 0, tunnelY + 2, 32, tunnelHeight - 4, METAL_BASE);
  fill(ctx, 0, tunnelY, 32, 2, METAL_HIGHLIGHT);
  for (let stripeX = 0; stripeX < 32; stripeX += 8) {
    const xPos = (stripeX + frame * 2) % 32;
    fill(ctx, xPos, tunnelY + 1, 2, 4, WARNING_STRIPE);
    fill(ctx, xPos + 1, tunnelY + 2, 2, 4, WARNING_STRIPE);
  }
  const entranceY = tunnelY + 4, entranceHeight = 8;
  fill(ctx, 0, entranceY, 32, 1, METAL_DARK);
  fill(ctx, 0, entranceY + entranceHeight, 32, 1, METAL_DARK);
  for (let y = 0; y < entranceHeight; y++) fill(ctx, 0, entranceY + y, 32, 1, `rgba(0,0,0,${0.3 + y/entranceHeight*0.4})`);
  for (let bx = 0; bx < 32; bx += 6) { const xPos = (bx + frame * 3) % 32; if (xPos < 32) fill(ctx, xPos, entranceY + 2, 20, 1, CHEVRON_YELLOW); }
  for (const ry of [4, 12, 20, 28]) { if (ry >= tunnelY && ry < tunnelY + tunnelHeight) { fill(ctx, 1, ry, 2, 2, METAL_HIGHLIGHT); fill(ctx, 2, ry + 1, 1, 1, "#FFF"); } }
  fill(ctx, 0, tunnelY, 2, tunnelHeight, METAL_DARK); fill(ctx, 30, tunnelY, 2, tunnelHeight, METAL_DARK);
  fill(ctx, 4, tunnelY + tunnelHeight - 2, 24, 2, METAL_DARK); fill(ctx, 6, tunnelY + tunnelHeight - 2, 20, 1, METAL_BASE);
  fill(ctx, 14, tunnelY + tunnelHeight - 4, 4, 2, CHEVRON_YELLOW); fill(ctx, 15, tunnelY + tunnelHeight - 3, 2, 1, CHEVRON_YELLOW);
  if (faulted) drawFaultBadge(ctx);
}
