// Procedural pixel-art sprite drawers for material items (32x32)
import type { MaterialId } from "../../sim/types";
import { getMaterialColor } from "../palette";

function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function strokeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
}

/** Draw ore/rock sprite */
function drawOre(ctx: CanvasRenderingContext2D, color: string, dark: string) {
  const path = "M8,24L6,18L8,12L12,6L20,4L26,8L28,14L27,20L24,26L16,28Z";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(8,24); ctx.lineTo(6,18); ctx.lineTo(8,12); ctx.lineTo(12,6);
  ctx.lineTo(20,4); ctx.lineTo(26,8); ctx.lineTo(28,14); ctx.lineTo(27,20);
  ctx.lineTo(24,26); ctx.lineTo(16,28); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark;
  for (let i = 0; i < 6; i++) fillRect(ctx, 10+i*3, 10+i*2, 2, 2, dark);
  ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke();
}

/** Draw plate sprite */
function drawPlate(ctx: CanvasRenderingContext2D, color: string) {
  fillRect(ctx, 4, 6, 24, 20, color);
  fillRect(ctx, 5, 7, 22, 2, "#FFF"); fillRect(ctx, 5, 7, 2, 18, "#FFF");
  fillRect(ctx, 25, 7, 2, 18, "#333"); fillRect(ctx, 5, 23, 22, 2, "#333");
  fillRect(ctx, 6, 8, 3, 3, "#333"); fillRect(ctx, 23, 8, 3, 3, "#333");
  fillRect(ctx, 6, 21, 3, 3, "#333"); fillRect(ctx, 23, 21, 3, 3, "#333");
  ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16,7); ctx.lineTo(16,25); ctx.moveTo(4,16); ctx.lineTo(28,16); ctx.stroke();
}

/** Draw gear sprite */
function drawGear(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    fillRect(ctx, cx + Math.cos(a)*13 - 2, cy + Math.sin(a)*13 - 2, 4, 4, color);
  }
  ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fillStyle = "#000"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx-3, cy-3, 3, 0, Math.PI*2); ctx.fillStyle = "#CCC"; ctx.fill();
}

/** Draw wire sprite */
function drawWire(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= 36; i++) {
    const t = i/36, a = t * Math.PI * 4, r = 12 - t * 8;
    const x = 16 + Math.cos(a)*r, y = 16 + Math.sin(a)*r;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.fillStyle = "#FFD700";
  for (let i = 4; i < 32; i += 8) {
    const t = i/36, a = t * Math.PI * 4, r = 12 - t * 8;
    fillRect(ctx, 16 + Math.cos(a)*r - 2, 16 + Math.sin(a)*r - 2, 4, 4, "#FFD700");
  }
  fillRect(ctx, 14, 4, 4, 4, "#654321"); fillRect(ctx, 14, 24, 4, 4, "#654321");
}

/** Draw wafer sprite */
function drawWafer(ctx: CanvasRenderingContext2D) {
  const cx = 16, cy = 16;
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fillStyle = "#AFEEEE"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(14,28); ctx.lineTo(16,24); ctx.lineTo(18,28); ctx.closePath(); ctx.fillStyle="#000"; ctx.fill();
  ctx.strokeStyle = "#5F9EA0"; ctx.lineWidth = 1;
  for (let i = 8; i <= 24; i += 4) { ctx.beginPath(); ctx.moveTo(i,8); ctx.lineTo(i,24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8,i); ctx.lineTo(24,i); ctx.stroke(); }
  ctx.strokeStyle = "#2F4F4F"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI*2); ctx.stroke();
}

/** Draw circuit board sprite */
function drawCircuitBoard(ctx: CanvasRenderingContext2D) {
  fillRect(ctx, 3, 4, 26, 24, "#006400"); strokeRect(ctx, 3, 4, 26, 24, "#000");
  ctx.strokeStyle = "#B8860B"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(6,8); ctx.lineTo(12,8); ctx.lineTo(12,16); ctx.lineTo(20,16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,20); ctx.lineTo(16,20); ctx.lineTo(16,12); ctx.lineTo(24,12); ctx.stroke();
  fillRect(ctx, 6, 10, 8, 6, "#4682B4"); fillRect(ctx, 18, 14, 8, 6, "#4682B4");
  ctx.fillStyle = "#C0C0C0";
  for (let i = 0; i < 4; i++) {
    fillRect(ctx, 5, 11+i*2, 1, 1, "#C0C0C0"); fillRect(ctx, 14, 11+i*2, 1, 1, "#C0C0C0");
    fillRect(ctx, 17, 15+i*2, 1, 1, "#C0C0C0"); fillRect(ctx, 26, 15+i*2, 1, 1, "#C0C0C0");
  }
}

/** Draw microchip sprite */
function drawMicrochip(ctx: CanvasRenderingContext2D) {
  fillRect(ctx, 6, 6, 20, 20, "#1C1C1C"); strokeRect(ctx, 6, 6, 20, 20, "#333");
  for (let i = 0; i < 5; i++) {
    fillRect(ctx, 4, 8+i*3, 2, 2, "#FFD700"); fillRect(ctx, 26, 8+i*3, 2, 2, "#FFD700");
  }
  ctx.fillStyle = "#FFE4C4"; ctx.font = "4px monospace"; ctx.fillText("CHIP", 10, 14);
  fillRect(ctx, 8, 8, 2, 2, "#F00");
}

/** Draw automation module sprite */
function drawAutomationModule(ctx: CanvasRenderingContext2D) {
  fillRect(ctx, 4, 5, 24, 22, "#8A2BE2"); strokeRect(ctx, 4, 5, 24, 22, "#4B0082");
  fillRect(ctx, 6, 8, 3, 3, "#F00"); fillRect(ctx, 11, 8, 3, 3, "#0F0");
  fillRect(ctx, 16, 8, 3, 3, "#FF0"); fillRect(ctx, 21, 8, 3, 3, "#0CED");
  fillRect(ctx, 10, 13, 12, 10, "#4B0082"); fillRect(ctx, 12, 15, 8, 6, "#0CED");
  for (let i = 0; i < 4; i++) {
    fillRect(ctx, 6, 20, 2, 2, "#E6E6FA"); fillRect(ctx, 24, 20, 2, 2, "#E6E6FA");
  }
}

/** Draw silica sand sprite */
function drawSilicaSand(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#FFFACD";
  ctx.beginPath(); ctx.moveTo(4,28); ctx.quadraticCurveTo(8,20,12,18);
  ctx.quadraticCurveTo(16,14,20,18); ctx.quadraticCurveTo(24,20,28,28); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#F0E68C";
  for (let i = 0; i < 20; i++) fillRect(ctx, 8+(i*2)%16, 18+(i*3)%8, 2, 2, "#F0E68C");
  ctx.fillStyle = "#FFFFE0";
  for (let i = 0; i < 10; i++) fillRect(ctx, 10+(i*2)%12, 16+(i*2)%6, 2, 2, "#FFFFE0");
  ctx.strokeStyle = "#DAA520"; ctx.lineWidth = 2; ctx.stroke();
}

/** Draw slag sprite */
function drawSlag(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#555";
  ctx.beginPath(); ctx.moveTo(8,26); ctx.lineTo(6,18); ctx.lineTo(9,10); ctx.lineTo(15,6);
  ctx.lineTo(22,8); ctx.lineTo(26,14); ctx.lineTo(25,22); ctx.lineTo(21,28); ctx.lineTo(14,27); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#222";
  for (let i = 0; i < 6; i++) fillRect(ctx, 10+i*2, 12+i*2, 3, 3, "#222");
  ctx.fillStyle = "#8B4513";
  for (let i = 0; i < 4; i++) fillRect(ctx, 12+i*3, 14+i*2, 2, 2, "#8B4513");
  ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke();
}

/** Draw item sprite based on material ID */
export function drawItemSprite(ctx: CanvasRenderingContext2D, material: MaterialId): void {
  const color = getMaterialColor(material).hex;
  switch (material) {
    case "iron_ore": drawOre(ctx, color, "#654321"); break;
    case "copper_ore": drawOre(ctx, color, "#8B4513"); break;
    case "coal": drawOre(ctx, "#000", "#444"); break;
    case "silica_sand": drawSilicaSand(ctx); break;
    case "iron_plate": drawPlate(ctx, color); break;
    case "copper_plate": drawPlate(ctx, color); break;
    case "steel_plate": drawPlate(ctx, color); break;
    case "iron_gear": drawGear(ctx, color); break;
    case "copper_wire": drawWire(ctx, color); break;
    case "silicon_wafer": drawWafer(ctx); break;
    case "circuit_board": drawCircuitBoard(ctx); break;
    case "microchip": drawMicrochip(ctx); break;
    case "automation_module": drawAutomationModule(ctx); break;
    case "slag": drawSlag(ctx); break;
  }
}

/** Get texture key for a material */
export function getItemTextureKey(material: MaterialId): string {
  return `item_${material}`;
}
