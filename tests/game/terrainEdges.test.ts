// Tests for terrain edge mask computation and overlay drawing
import { describe, it, expect } from "vitest";
import type { TerrainType } from "../../src/sim/types";
import {
  EDGE_N, EDGE_E, EDGE_S, EDGE_W,
  computeExposedEdgeMask, getWaterEdgeTextureKey, getRockEdgeTextureKey,
  drawWaterEdgeOverlay, drawRockEdgeOverlay,
} from "../../src/game/sprites/terrainEdges";

class MockContext {
  fillStyle: string = "";
  fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = [];
  fillRect(x: number, y: number, w: number, h: number): void { this.fillRectCalls.push({ x, y, w, h, fillStyle: this.fillStyle }); }
  getUniqueFillStyles(): Set<string> { return new Set(this.fillRectCalls.map((c) => c.fillStyle)); }
}
function createMockContext(): any { return new MockContext(); }
function createTestMap(w: number, h: number, t: TerrainType = "grass"): TerrainType[][] {
  const m: TerrainType[][] = [];
  for (let y = 0; y < h; y++) { const r: TerrainType[] = []; for (let x = 0; x < w; x++) r.push(t); m.push(r); }
  return m;
}

describe("Edge Bitmask Constants", () => {
  it("EDGE_N=1, EDGE_E=2, EDGE_S=4, EDGE_W=8", () => {
    expect(EDGE_N).toBe(1); expect(EDGE_E).toBe(2); expect(EDGE_S).toBe(4); expect(EDGE_W).toBe(8);
    expect(EDGE_N | EDGE_E | EDGE_S | EDGE_W).toBe(15);
  });
});

describe("computeExposedEdgeMask", () => {
  it("returns 0 for single tile or same terrain", () => {
    expect(computeExposedEdgeMask(createTestMap(1, 1, "water"), 0, 0, "water")).toBe(0);
    expect(computeExposedEdgeMask(createTestMap(3, 3, "water"), 1, 1, "water")).toBe(0);
  });
  it("detects individual edge exposures", () => {
    let m = createTestMap(3, 3, "water"); let r = m[0]; if (r) r[1] = "grass";
    expect(computeExposedEdgeMask(m, 1, 1, "water") & EDGE_N).toBe(EDGE_N);
    m = createTestMap(3, 3, "water"); r = m[1]; if (r) r[2] = "rock";
    expect(computeExposedEdgeMask(m, 1, 1, "water") & EDGE_E).toBe(EDGE_E);
    m = createTestMap(3, 3, "water"); r = m[2]; if (r) r[1] = "grass";
    expect(computeExposedEdgeMask(m, 1, 1, "water") & EDGE_S).toBe(EDGE_S);
    m = createTestMap(3, 3, "water"); r = m[1]; if (r) r[0] = "rock";
    expect(computeExposedEdgeMask(m, 1, 1, "water") & EDGE_W).toBe(EDGE_W);
  });
  it("detects multiple exposures and ignores boundaries", () => {
    let m = createTestMap(3, 3, "water"); let r0 = m[0], r1 = m[1];
    if (r0) r0[1] = "grass"; if (r1) r1[2] = "rock";
    expect(computeExposedEdgeMask(m, 1, 1, "water")).toBe(EDGE_N | EDGE_E);
    expect(computeExposedEdgeMask(createTestMap(3, 3, "water"), 0, 0, "water")).toBe(0);
    expect(computeExposedEdgeMask(m, -1, 0, "water")).toBe(0);
  });
  it("handles corner tiles correctly", () => {
    let m = createTestMap(3, 3, "water"); let r0 = m[0], r1 = m[1];
    if (r0) { r0[0] = "water"; r0[1] = "grass"; } if (r1) r1[0] = "rock";
    expect(computeExposedEdgeMask(m, 0, 0, "water")).toBe(EDGE_E | EDGE_S);
  });
  it("returns valid masks 0-15", () => {
    const map = createTestMap(5, 5, "water");
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const mask = computeExposedEdgeMask(map, x, y, "water");
      expect(mask).toBeGreaterThanOrEqual(0); expect(mask).toBeLessThanOrEqual(15);
    }
  });
});

describe("Texture Keys", () => {
  it("getWaterEdgeTextureKey format", () => {
    expect(getWaterEdgeTextureKey(0)).toBe("edge:water:mask:0");
    expect(getWaterEdgeTextureKey(15)).toBe("edge:water:mask:15");
  });
  it("getRockEdgeTextureKey format", () => {
    expect(getRockEdgeTextureKey(0)).toBe("edge:rock:mask:0");
    expect(getRockEdgeTextureKey(15)).toBe("edge:rock:mask:15");
  });
});

describe("drawWaterEdgeOverlay", () => {
  it("renders deterministically", () => {
    const c1 = createMockContext(), c2 = createMockContext();
    drawWaterEdgeOverlay(c1, 0); drawWaterEdgeOverlay(c2, 0);
    expect(c1.fillRectCalls).toEqual(c2.fillRectCalls);
    drawWaterEdgeOverlay(c1, 7); drawWaterEdgeOverlay(c2, 7);
    expect(c1.fillRectCalls).toEqual(c2.fillRectCalls);
  });
  it("produces different output for different masks", () => {
    const c1 = createMockContext(), c2 = createMockContext();
    drawWaterEdgeOverlay(c1, EDGE_N); drawWaterEdgeOverlay(c2, EDGE_S);
    expect(c1.fillRectCalls).not.toEqual(c2.fillRectCalls);
  });
  it("uses rgb format and stays within bounds", () => {
    const ctx = createMockContext(); drawWaterEdgeOverlay(ctx, EDGE_N | EDGE_E | EDGE_S | EDGE_W);
    for (const c of ctx.fillRectCalls) {
      expect(c.fillStyle).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(32); expect(c.y + c.h).toBeLessThanOrEqual(32);
    }
  });
  it("renders all masks 1-15 deterministically", () => {
    for (let mask = 1; mask <= 15; mask++) {
      const c1 = createMockContext(), c2 = createMockContext();
      drawWaterEdgeOverlay(c1, mask); drawWaterEdgeOverlay(c2, mask);
      expect(c1.fillRectCalls).toEqual(c2.fillRectCalls);
    }
  });
  it("has multiple colors", () => {
    const ctx = createMockContext(); drawWaterEdgeOverlay(ctx, 15);
    expect(ctx.getUniqueFillStyles().size).toBeGreaterThan(1);
  });
});

describe("drawRockEdgeOverlay", () => {
  it("renders deterministically", () => {
    const c1 = createMockContext(), c2 = createMockContext();
    drawRockEdgeOverlay(c1, 0); drawRockEdgeOverlay(c2, 0);
    expect(c1.fillRectCalls).toEqual(c2.fillRectCalls);
    drawRockEdgeOverlay(c1, 11); drawRockEdgeOverlay(c2, 11);
    expect(c1.fillRectCalls).toEqual(c2.fillRectCalls);
  });
  it("produces different output for different masks", () => {
    const c1 = createMockContext(), c2 = createMockContext();
    drawRockEdgeOverlay(c1, EDGE_N); drawRockEdgeOverlay(c2, EDGE_S);
    expect(c1.fillRectCalls).not.toEqual(c2.fillRectCalls);
  });
  it("uses rgb format and stays within bounds", () => {
    const ctx = createMockContext(); drawRockEdgeOverlay(ctx, EDGE_N | EDGE_E | EDGE_S | EDGE_W);
    for (const c of ctx.fillRectCalls) {
      expect(c.fillStyle).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(32); expect(c.y + c.h).toBeLessThanOrEqual(32);
    }
  });
  it("renders all masks 1-15 deterministically", () => {
    for (let mask = 1; mask <= 15; mask++) {
      const c1 = createMockContext(), c2 = createMockContext();
      drawRockEdgeOverlay(c1, mask); drawRockEdgeOverlay(c2, mask);
      expect(c1.fillRectCalls).toEqual(c2.fillRectCalls);
    }
  });
  it("uses multiple gray shades", () => {
    const ctx = createMockContext(); drawRockEdgeOverlay(ctx, 15);
    expect(ctx.getUniqueFillStyles().size).toBeGreaterThanOrEqual(3);
  });
  it("differs for N/W vs S/E edges", () => {
    const cN = createMockContext(), cS = createMockContext();
    drawRockEdgeOverlay(cN, EDGE_N); drawRockEdgeOverlay(cS, EDGE_S);
    expect(cN.fillRectCalls).not.toEqual(cS.fillRectCalls);
  });
});

describe("Edge Mask Combinations", () => {
  it("handles single edge masks", () => {
    for (const mask of [EDGE_N, EDGE_E, EDGE_S, EDGE_W]) {
      const ctx = createMockContext(); drawWaterEdgeOverlay(ctx, mask);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    }
  });
  it("handles double edge masks", () => {
    for (const mask of [EDGE_N | EDGE_E, EDGE_E | EDGE_S, EDGE_S | EDGE_W, EDGE_W | EDGE_N]) {
      const ctx = createMockContext(); drawRockEdgeOverlay(ctx, mask);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    }
  });
  it("handles triple edge masks", () => {
    for (const mask of [EDGE_N | EDGE_E | EDGE_S, EDGE_E | EDGE_S | EDGE_W, EDGE_S | EDGE_W | EDGE_N, EDGE_W | EDGE_N | EDGE_E]) {
      const ctx = createMockContext(); drawWaterEdgeOverlay(ctx, mask);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    }
  });
  it("handles full mask", () => {
    const full = EDGE_N | EDGE_E | EDGE_S | EDGE_W;
    const c1 = createMockContext(), c2 = createMockContext();
    drawWaterEdgeOverlay(c1, full); drawRockEdgeOverlay(c2, full);
    expect(c1.getUniqueFillStyles().size).toBeGreaterThan(1);
    expect(c2.getUniqueFillStyles().size).toBeGreaterThan(1);
  });
});
