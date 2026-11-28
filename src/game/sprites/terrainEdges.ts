// Water/Rock Edge Overlay Drawing Module for 4-Directional Autotiling
import type { TerrainType } from "../../sim/types";

export const EDGE_N = 1;
export const EDGE_E = 2;
export const EDGE_S = 4;
export const EDGE_W = 8;

/** Compute exposed edge mask (0-15) for terrain boundary detection. Map boundaries are not exposed. */
export function computeExposedEdgeMask(tiles: TerrainType[][], x: number, y: number, terrain: TerrainType): number {
  const height = tiles.length;
  if (height === 0) return 0;
  const firstRow = tiles[0];
  if (!firstRow) return 0;
  const width = firstRow.length;
  if (y < 0 || y >= height || x < 0 || x >= width) return 0;
  
  const row = tiles[y];
  if (!row) return 0;
  const current = row[x];
  if (current === undefined || current !== terrain) return 0;
  
  let mask = 0;
  if (y > 0) { const r = tiles[y - 1]; if (r && r[x] !== undefined && r[x] !== terrain) mask |= EDGE_N; }
  if (x < width - 1 && row[x + 1] !== undefined && row[x + 1] !== terrain) mask |= EDGE_E;
  if (y < height - 1) { const r = tiles[y + 1]; if (r && r[x] !== undefined && r[x] !== terrain) mask |= EDGE_S; }
  if (x > 0 && row[x - 1] !== undefined && row[x - 1] !== terrain) mask |= EDGE_W;
  return mask;
}

export function getWaterEdgeTextureKey(mask: number): string { return `edge:water:mask:${mask}`; }
export function getRockEdgeTextureKey(mask: number): string { return `edge:rock:mask:${mask}`; }

/** Draw water edge overlay with sand/soil edges and water rim highlights. */
export function drawWaterEdgeOverlay(ctx: CanvasRenderingContext2D, mask: number): void {
  const W = 32, Q = 8, H = 16;
  // Sand base on exposed edges
  ctx.fillStyle = "rgb(232, 217, 160)";
  if (mask & EDGE_N) ctx.fillRect(0, 0, W, Q);
  if (mask & EDGE_E) ctx.fillRect(W - Q, 0, Q, W);
  if (mask & EDGE_S) ctx.fillRect(0, W - Q, W, Q);
  if (mask & EDGE_W) ctx.fillRect(0, 0, Q, W);
  // Darker sand at corners
  ctx.fillStyle = "rgb(192, 177, 120)";
  if ((mask & EDGE_N) && (mask & EDGE_W)) ctx.fillRect(0, 0, Q, Q);
  if ((mask & EDGE_N) && (mask & EDGE_E)) ctx.fillRect(W - Q, 0, Q, Q);
  if ((mask & EDGE_S) && (mask & EDGE_E)) ctx.fillRect(W - Q, W - Q, Q, Q);
  if ((mask & EDGE_S) && (mask & EDGE_W)) ctx.fillRect(0, W - Q, Q, Q);
  // Water rim highlights
  ctx.fillStyle = "rgb(64, 164, 255)";
  if (mask & EDGE_N) ctx.fillRect(H - 2, 0, 4, Q);
  if (mask & EDGE_E) ctx.fillRect(W - Q, H - 2, Q, 4);
  if (mask & EDGE_S) ctx.fillRect(H - 2, W - Q, 4, Q);
  if (mask & EDGE_W) ctx.fillRect(0, H - 2, Q, 4);
  // Corner highlights
  ctx.fillStyle = "rgb(96, 184, 255)";
  if ((mask & EDGE_N) && (mask & EDGE_W)) ctx.fillRect(0, 0, 6, 6);
  if ((mask & EDGE_N) && (mask & EDGE_E)) ctx.fillRect(W - 6, 0, 6, 6);
  if ((mask & EDGE_S) && (mask & EDGE_E)) ctx.fillRect(W - 6, W - 6, 6, 6);
  if ((mask & EDGE_S) && (mask & EDGE_W)) ctx.fillRect(0, W - 6, 6, 6);
}

/** Draw rock edge overlay with N/W highlight bevels, S/E dark walls, and south drop shadow. */
export function drawRockEdgeOverlay(ctx: CanvasRenderingContext2D, mask: number): void {
  const W = 32, Q = 8, B = 4, H = 16;
  // Base rock wall
  ctx.fillStyle = "rgb(128, 128, 128)";
  if (mask & EDGE_N) ctx.fillRect(0, 0, W, Q);
  if (mask & EDGE_E) ctx.fillRect(W - Q, 0, Q, W);
  if (mask & EDGE_S) ctx.fillRect(0, W - Q, W, Q);
  if (mask & EDGE_W) ctx.fillRect(0, 0, Q, W);
  // N/W highlight bevels (light from top-left)
  ctx.fillStyle = "rgb(168, 168, 168)";
  if (mask & EDGE_N) ctx.fillRect(B, 0, W - B * 2, 2);
  if (mask & EDGE_W) ctx.fillRect(0, B, 2, W - B * 2);
  // S/E dark shading
  ctx.fillStyle = "rgb(88, 88, 88)";
  if (mask & EDGE_S) ctx.fillRect(Q, W - Q, W - Q * 2, Q - 2);
  if (mask & EDGE_E) ctx.fillRect(W - Q + 2, Q, Q - 2, W - Q * 2);
  // South drop shadow
  if (mask & EDGE_S) { ctx.fillStyle = "rgb(58, 58, 58)"; ctx.fillRect(Q + 4, W - 2, W - Q * 2 - 8, 2); }
  // Corner rounding
  ctx.fillStyle = "rgb(148, 148, 148)";
  if ((mask & EDGE_N) && (mask & EDGE_W)) { ctx.fillRect(0, 0, B, B); ctx.fillRect(2, 0, 2, 2); ctx.fillRect(0, 2, 2, 2); }
  if ((mask & EDGE_N) && (mask & EDGE_E)) { ctx.fillRect(W - B, 0, B, B); ctx.fillRect(W - 4, 2, 2, 2); }
  if ((mask & EDGE_S) && (mask & EDGE_E)) { ctx.fillRect(W - B, W - B, B, B); ctx.fillRect(W - 4, W - 4, 2, 2); }
  if ((mask & EDGE_S) && (mask & EDGE_W)) { ctx.fillRect(0, W - B, B, B); ctx.fillRect(2, W - 4, 2, 2); }
  // Single-edge corner caps
  if ((mask & EDGE_N) && !(mask & EDGE_W) && !(mask & EDGE_E)) { ctx.fillRect(0, 0, B, 4); ctx.fillRect(W - B, 0, B, 4); }
  if ((mask & EDGE_S) && !(mask & EDGE_W) && !(mask & EDGE_E)) { ctx.fillRect(0, W - 4, B, 4); ctx.fillRect(W - B, W - 4, B, 4); }
  if ((mask & EDGE_W) && !(mask & EDGE_N) && !(mask & EDGE_S)) { ctx.fillRect(0, 0, 4, B); ctx.fillRect(0, W - B, 4, B); }
  if ((mask & EDGE_E) && !(mask & EDGE_N) && !(mask & EDGE_S)) { ctx.fillRect(W - 4, 0, 4, B); ctx.fillRect(W - 4, W - B, 4, B); }
}
