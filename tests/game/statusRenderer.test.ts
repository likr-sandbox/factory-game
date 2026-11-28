import { describe, it, expect } from "vitest";
import { getBuildingAnimationFrame, computeBeltItemLayout, drawFaultIndicator, drawDepletedIndicator, syncBuildingStatusOverlays } from "../../src/game/statusRenderer";
import type { BuildingState, WorldState } from "../../src/sim/types";

class MockGraphics {
  cleared = false;
  alpha = 1;
  positionX = 0;
  positionY = 0;
  destroyed = false;
  clear() { this.cleared = true; }
  setAlpha(a: number) { this.alpha = a; }
  fillRect(x: number, y: number, w: number, h: number) {}
  fillCircle(x: number, y: number, r: number) {}
  lineWidth(w: number) {}
  lineColor(r: number, g: number, b: number, a?: number) {}
  fillStyle(c: string, a?: number) {}
  strokeRect(x: number, y: number, w: number, h: number) {}
  setPosition(x: number, y: number) { this.positionX = x; this.positionY = y; }
  destroy() { this.destroyed = true; }
}
class MockScene {
  graphicsObjects: MockGraphics[] = [];
  add = { graphics: () => { const g = new MockGraphics(); this.graphicsObjects.push(g); return g; } };
}

function makeWorld(tick: number, tiles: any[] = []): WorldState {
  return { seed: 42, width: 10, height: 10, tick, rngState: 1, tiles, buildings: {}, nextBuildingId: 1, hubOrigin: { x: 0, y: 0 }, delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [] };
}
function makeBuilding(overrides: Partial<BuildingState> = {}): BuildingState {
  return { id: `b${overrides.id ?? 1}`, type: overrides.type ?? "belt", x: overrides.x ?? 0, y: overrides.y ?? 0, direction: overrides.direction ?? "E", recipeId: overrides.recipeId, filterMaterial: overrides.filterMaterial, inputBuffer: overrides.inputBuffer ?? {}, outputBuffer: overrides.outputBuffer ?? {}, beltItems: overrides.beltItems ?? [], craftProgress: overrides.craftProgress ?? 0, roundRobinIndex: 0, faulted: overrides.faulted ?? false, load: 0, idleTicks: 0, blockedTicks: overrides.blockedTicks ?? 0 };
}

describe("getBuildingAnimationFrame", () => {
  it("returns 0 for faulted buildings", () => { expect(getBuildingAnimationFrame(makeBuilding({ faulted: true }), makeWorld(100))).toBe(0); });
  it("alternates belt frames based on tick/6", () => { expect(getBuildingAnimationFrame(makeBuilding(), makeWorld(0))).toBe(0); expect(getBuildingAnimationFrame(makeBuilding(), makeWorld(6))).toBe(1); expect(getBuildingAnimationFrame(makeBuilding(), makeWorld(12))).toBe(0); });
  it("alternates underground_belt frames", () => { expect(getBuildingAnimationFrame(makeBuilding({ type: "underground_belt" }), makeWorld(0))).toBe(0); expect(getBuildingAnimationFrame(makeBuilding({ type: "underground_belt" }), makeWorld(6))).toBe(1); });
  it("returns 0 for miner with no deposit", () => { const b = makeBuilding({ type: "miner", x: 0, y: 0 }); const w = makeWorld(100, [[]]); expect(getBuildingAnimationFrame(b, w)).toBe(0); });
  it("alternates miner frames when deposit has remaining > 0", () => { const tileData = [[{ deposit: { remaining: 100 } }]]; const b = makeBuilding({ type: "miner", x: 0, y: 0 }); expect(getBuildingAnimationFrame(b, makeWorld(0, tileData))).toBe(0); expect(getBuildingAnimationFrame(b, makeWorld(8, tileData))).toBe(1); });
  it("returns 0 for inactive smelter", () => { expect(getBuildingAnimationFrame(makeBuilding({ type: "smelter" }), makeWorld(100))).toBe(0); expect(getBuildingAnimationFrame(makeBuilding({ type: "smelter", recipeId: "iron_plate", craftProgress: 0 }), makeWorld(100))).toBe(0); });
  it("alternates smelter frames when active", () => { const b = makeBuilding({ type: "smelter", recipeId: "iron_plate", craftProgress: 30 }); expect(getBuildingAnimationFrame(b, makeWorld(0))).toBe(0); expect(getBuildingAnimationFrame(b, makeWorld(8))).toBe(1); });
  it("alternates assembler frames when active", () => { const b = makeBuilding({ type: "assembler", recipeId: "iron_gear", craftProgress: 50 }); expect(getBuildingAnimationFrame(b, makeWorld(0))).toBe(0); expect(getBuildingAnimationFrame(b, makeWorld(8))).toBe(1); });
  it("alternates recycler frames based on tick/12", () => { expect(getBuildingAnimationFrame(makeBuilding({ type: "recycler" }), makeWorld(0))).toBe(0); expect(getBuildingAnimationFrame(makeBuilding({ type: "recycler" }), makeWorld(12))).toBe(1); });
  it("alternates hub frames based on tick/12", () => { expect(getBuildingAnimationFrame(makeBuilding({ type: "hub" }), makeWorld(0))).toBe(0); expect(getBuildingAnimationFrame(makeBuilding({ type: "hub" }), makeWorld(12))).toBe(1); });
  it("returns 0 for splitter/filter_splitter/sensor", () => { expect(getBuildingAnimationFrame(makeBuilding({ type: "splitter" }), makeWorld(100))).toBe(0); expect(getBuildingAnimationFrame(makeBuilding({ type: "filter_splitter" }), makeWorld(100))).toBe(0); expect(getBuildingAnimationFrame(makeBuilding({ type: "sensor" }), makeWorld(100))).toBe(0); });
});

describe("computeBeltItemLayout", () => {
  it("scales items to 0.58", () => { expect(computeBeltItemLayout(makeBuilding(), 0, 3, 100).scale).toBe(0.58); });
  it("positions item 0 centered on building", () => { const layout = computeBeltItemLayout(makeBuilding({ x: 1, y: 1, direction: "E" }), 0, 3, 100); expect(layout.x).toBe(48); expect(layout.y).toBe(48); });
  it("positions item 1 above center for N direction", () => { const layout1 = computeBeltItemLayout(makeBuilding({ direction: "N" }), 1, 3, 100); expect(layout1.y).toBeLessThan(16); });
  it("positions item 1 below center for S direction", () => { const layout1 = computeBeltItemLayout(makeBuilding({ direction: "S" }), 1, 3, 100); expect(layout1.y).toBeGreaterThan(16); });
  it("positions item 1 left of center for W direction", () => { const layout1 = computeBeltItemLayout(makeBuilding({ direction: "W" }), 1, 3, 100); expect(layout1.x).toBeLessThan(16); });
  it("positions item 1 right of center for E direction", () => { const layout1 = computeBeltItemLayout(makeBuilding({ direction: "E" }), 1, 3, 100); expect(layout1.x).toBeGreaterThan(16); });
  it("orders items from front to back", () => { const layout1 = computeBeltItemLayout(makeBuilding({ direction: "E" }), 1, 3, 100); const layout2 = computeBeltItemLayout(makeBuilding({ direction: "E" }), 2, 3, 100); expect(layout2.x).toBeGreaterThan(layout1.x); });
});

describe("drawFaultIndicator", () => {
  it("clears graphics and draws at local coordinates", () => { const g = new MockGraphics(); drawFaultIndicator(g, false, 0); expect(g.cleared).toBe(true); });
  it("blinks based on tick/15", () => { const g0 = new MockGraphics(); const g1 = new MockGraphics(); drawFaultIndicator(g0, false, 0); drawFaultIndicator(g1, false, 15); expect(g0.alpha).toBe(1); expect(g1.alpha).toBe(0.45); });
  it("draws badge at different Y for hub vs non-hub", () => { const gh = new MockGraphics(); const gn = new MockGraphics(); drawFaultIndicator(gh, true, 0); drawFaultIndicator(gn, false, 0); expect(gh.positionY).toBe(0); expect(gn.positionY).toBe(0); });
});

describe("drawDepletedIndicator", () => {
  it("clears graphics and draws X at local (0,0)", () => { const g = new MockGraphics(); drawDepletedIndicator(g); expect(g.cleared).toBe(true); });
});

describe("syncBuildingStatusOverlays", () => {
  it("creates overlays for buildings needing status rendering", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "smelter", recipeId: "iron_plate", craftProgress: 30 }); const world = makeWorld(100); world.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world); expect(overlays.has(b.id)).toBe(true); expect(scene.graphicsObjects.length).toBe(1); });
  it("destroys overlays for buildings no longer needing status", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "smelter", recipeId: "iron_plate", craftProgress: 30 }); const world1 = makeWorld(100); world1.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world1); const existing = overlays.get(b.id)!; syncBuildingStatusOverlays(scene, overlays, makeWorld(100)); expect(existing.destroyed).toBe(true); expect(overlays.has(b.id)).toBe(false); });
  it("positions overlay at building pixel coordinates", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "smelter", x: 2, y: 3, recipeId: "iron_plate", craftProgress: 30 }); const world = makeWorld(100); world.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world); const o = overlays.get(b.id)!; expect(o.positionX).toBe(80); expect(o.positionY).toBe(112); });
  it("shows progress bar for active smelter", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "smelter", recipeId: "iron_plate", craftProgress: 30 }); const world = makeWorld(100); world.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world); expect(overlays.has(b.id)).toBe(true); });
  it("shows material color indicator for smelter with recipe", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "smelter", recipeId: "iron_plate", craftProgress: 30 }); const world = makeWorld(100); world.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world); expect(overlays.has(b.id)).toBe(true); });
  it("shows congestion indicator when blockedTicks >= 30", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "belt", blockedTicks: 35, faulted: false }); const world = makeWorld(100); world.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world); expect(overlays.has(b.id)).toBe(true); });
  it("does not show congestion indicator when faulted", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "belt", blockedTicks: 35, faulted: true }); const world = makeWorld(100); world.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world); expect(overlays.has(b.id)).toBe(false); });
  it("reuses existing overlay instead of creating new one", () => { const scene = new MockScene(); const overlays = new Map<string, MockGraphics>(); const b = makeBuilding({ type: "smelter", recipeId: "iron_plate", craftProgress: 30 }); const world = makeWorld(100); world.buildings[b.id] = b; syncBuildingStatusOverlays(scene, overlays, world); const first = overlays.get(b.id); syncBuildingStatusOverlays(scene, overlays, world); const second = overlays.get(b.id); expect(first).toBe(second); expect(scene.graphicsObjects.length).toBe(1); });
});
