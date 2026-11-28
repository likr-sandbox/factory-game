import { describe, it, expect } from "vitest";
import { WORLD_SIZE, HUB_ORIGIN, nextRandom, createRng, inBounds, getTile, directionDelta, oppositeDirection, isHubTile, createWorld } from "../../src/sim/world";

describe("World Generator", () => {
  it("WORLD_SIZE should be 64", () => expect(WORLD_SIZE).toBe(64));
  it("HUB_ORIGIN should be {x: 31, y: 31}", () => expect(HUB_ORIGIN).toEqual({ x: 31, y: 31 }));

  describe("PRNG Helpers", () => {
    it("nextRandom should produce deterministic values", () => {
      const { value: v1 } = nextRandom(42);
      expect(typeof v1).toBe("number");
      expect(v1).toBeGreaterThanOrEqual(0);
      expect(v1).toBeLessThan(1);
    });
    it("createRng should produce deterministic sequence", () => {
      const rng1 = createRng(42), rng2 = createRng(42);
      expect([rng1(), rng1(), rng1()]).toEqual([rng2(), rng2(), rng2()]);
    });
    it("Different seeds should produce different sequences", () => {
      expect(createRng(42)()).not.toBe(createRng(99)());
    });
  });

  describe("Coordinate Helpers", () => {
    it("inBounds should check valid coordinates", () => {
      const world = createWorld(42);
      expect(inBounds(world, 0, 0)).toBe(true);
      expect(inBounds(world, 63, 63)).toBe(true);
      expect(inBounds(world, -1, 0)).toBe(false);
      expect(inBounds(world, 64, 0)).toBe(false);
    });
    it("getTile should return tile or null", () => {
      const world = createWorld(42);
      expect(getTile(world, 31, 31)).not.toBeNull();
      expect(getTile(world, 100, 100)).toBeNull();
    });
    it("directionDelta should return correct offsets", () => {
      expect(directionDelta("N")).toEqual({ dx: 0, dy: -1 });
      expect(directionDelta("E")).toEqual({ dx: 1, dy: 0 });
      expect(directionDelta("S")).toEqual({ dx: 0, dy: 1 });
      expect(directionDelta("W")).toEqual({ dx: -1, dy: 0 });
    });
    it("oppositeDirection should return correct opposites", () => {
      expect(oppositeDirection("N")).toBe("S");
      expect(oppositeDirection("E")).toBe("W");
      expect(oppositeDirection("S")).toBe("N");
      expect(oppositeDirection("W")).toBe("E");
    });
    it("isHubTile should identify hub tiles", () => {
      const world = createWorld(42);
      expect(isHubTile(world, 31, 31)).toBe(true);
      expect(isHubTile(world, 32, 31)).toBe(true);
      expect(isHubTile(world, 31, 32)).toBe(true);
      expect(isHubTile(world, 32, 32)).toBe(true);
      expect(isHubTile(world, 30, 31)).toBe(false);
    });
  });

  describe("World Creation", () => {
    it("should create 64x64 grid", () => {
      const world = createWorld(42);
      expect(world.width).toBe(64);
      expect(world.height).toBe(64);
      expect(world.tiles.length).toBe(64);
      for (let y = 0; y < 64; y++) expect(world.tiles[y]!.length).toBe(64);
    });
    it("should have hub building at center", () => {
      const world = createWorld(42);
      const hub = world.buildings["hub"]!;
      expect(hub.id).toBe("hub");
      expect(hub.type).toBe("hub");
      for (const coord of [{ x: 31, y: 31 }, { x: 32, y: 31 }, { x: 31, y: 32 }, { x: 32, y: 32 }]) {
        const tile = world.tiles[coord.y]![coord.x]!;
        expect(tile.terrain).toBe("grass");
        expect(tile.buildingId).toBe("hub");
      }
    });
    it("should be deterministic with same seed", () => {
      const w1 = createWorld(42), w2 = createWorld(42);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const t1 = w1.tiles[y]![x]!, t2 = w2.tiles[y]![x]!;
          expect(t1.terrain).toBe(t2.terrain);
          if (t1.deposit) { expect(t2.deposit!.material).toBe(t1.deposit.material); expect(t2.deposit!.remaining).toBe(t1.deposit.remaining); }
          else expect(t2.deposit).toBeNull();
          expect(t1.buildingId).toBe(t2.buildingId);
        }
      }
    });
    it("should produce different worlds with different seeds", () => {
      const w1 = createWorld(42), w2 = createWorld(99);
      let diff = 0;
      for (let y = 0; y < 64 && diff < 10; y++) {
        for (let x = 0; x < 64 && diff < 10; x++) {
          const t1 = w1.tiles[y]![x]!, t2 = w2.tiles[y]![x]!;
          if (t1.terrain !== t2.terrain || t1.buildingId !== t2.buildingId) diff++;
        }
      }
      expect(diff).toBeGreaterThan(0);
    });
  });

  describe("Resource Deposits", () => {
    it("should have all 4 resource types with positive amounts", () => {
      const world = createWorld(42), resources = new Set<string>();
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const d = world.tiles[y]![x]!.deposit;
          if (d && d.remaining > 0) resources.add(d.material);
        }
      }
      expect(resources.has("iron_ore")).toBe(true);
      expect(resources.has("copper_ore")).toBe(true);
      expect(resources.has("coal")).toBe(true);
      expect(resources.has("silica_sand")).toBe(true);
    });
    it("should have at least one cluster of each ore near hub", () => {
      const world = createWorld(42), maxDist = 25, nearHub = new Set<string>();
      for (let dy = -maxDist; dy <= maxDist; dy++) {
        for (let dx = -maxDist; dx <= maxDist; dx++) {
          const x = HUB_ORIGIN.x + dx, y = HUB_ORIGIN.y + dy;
          if (x < 0 || x >= 64 || y < 0 || y >= 64) continue;
          const d = world.tiles[y]![x]!.deposit;
          if (d && d.remaining > 0) nearHub.add(d.material);
        }
      }
      expect(nearHub.has("iron_ore")).toBe(true);
      expect(nearHub.has("copper_ore")).toBe(true);
      expect(nearHub.has("coal")).toBe(true);
      expect(nearHub.has("silica_sand")).toBe(true);
    });
  });

  describe("Terrain Generation", () => {
    it("should have rock terrain", () => {
      const world = createWorld(42);
      let hasRock = false;
      outer1: for (let y = 0; y < 64; y++) { for (let x = 0; x < 64; x++) { if (world.tiles[y]![x]!.terrain === "rock") { hasRock = true; break outer1; } } }
      expect(hasRock).toBe(true);
    });
    it("should have water terrain", () => {
      const world = createWorld(42);
      let hasWater = false;
      outer2: for (let y = 0; y < 64; y++) { for (let x = 0; x < 64; x++) { if (world.tiles[y]![x]!.terrain === "water") { hasWater = true; break outer2; } } }
      expect(hasWater).toBe(true);
    });
    it("should not have rock or water overlapping hub", () => {
      const world = createWorld(42);
      for (const coord of [{ x: 31, y: 31 }, { x: 32, y: 31 }, { x: 31, y: 32 }, { x: 32, y: 32 }]) {
        const tile = world.tiles[coord.y]![coord.x]!;
        expect(tile.terrain).not.toBe("rock");
        expect(tile.terrain).not.toBe("water");
      }
    });
    it("should have mostly grass terrain", () => {
      const world = createWorld(42);
      let grass = 0, total = 0;
      for (let y = 0; y < 64; y++) { for (let x = 0; x < 64; x++) { total++; if (world.tiles[y]![x]!.terrain === "grass") grass++; } }
      expect(grass / total).toBeGreaterThan(0.5);
    });
  });

  describe("Progression and Tutorial State", () => {
    it("should initialize with zero research points", () => { expect(createWorld(42).researchPoints).toBe(0); });
    it("should initialize tutorial phase at 1", () => { expect(createWorld(42).tutorialPhase).toBe(1); });
    it("should initialize empty completed tutorial steps", () => { expect(createWorld(42).completedTutorialSteps).toEqual([]); });
    it("should initialize empty active quests", () => { expect(createWorld(42).activeQuests).toEqual([]); });
    it("should initialize nextQuestId at 0", () => { expect(createWorld(42).nextQuestId).toBe(0); });
    it("should initialize empty SPM tracking", () => { expect(createWorld(42).spm).toEqual({}); });
    it("should be deterministic with same seed for all new fields", () => {
      const w1 = createWorld(42), w2 = createWorld(42);
      expect(w1.researchPoints).toBe(w2.researchPoints);
      expect(w1.tutorialPhase).toBe(w2.tutorialPhase);
      expect(w1.completedTutorialSteps).toEqual(w2.completedTutorialSteps);
      expect(w1.activeQuests).toEqual(w2.activeQuests);
      expect(w1.nextQuestId).toBe(w2.nextQuestId);
      expect(w1.spm).toEqual(w2.spm);
    });
  });

  describe("Tiered Resource Distribution (24 seeds)", () => {
    const seeds = [1, 42, 100, 200, 333, 555, 777, 888, 999, 1112, 2223, 3334, 4444, 5555, 6666, 7777, 8888, 9999, 11111, 13579, 24680, 12121, 34343, 56565];
    function euclideanDistance(x: number, y: number): number { const dx = x - 31.5; const dy = y - 31.5; return Math.sqrt(dx * dx + dy * dy); }
    function findConnectedCluster(tiles: any[][], startX: number, startY: number, material: string): { size: number; positions: { x: number; y: number }[] } {
      const visited = new Set<string>();
      const positions: { x: number; y: number }[] = [];
      const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
      visited.add(`${startX},${startY}`);
      while (queue.length > 0) {
        const pos = queue.shift()!;
        positions.push(pos);
        for (const n of [{ x: pos.x + 1, y: pos.y }, { x: pos.x - 1, y: pos.y }, { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 }]) {
          const key = `${n.x},${n.y}`;
          if (n.x < 0 || n.x >= 64 || n.y < 0 || n.y >= 64 || visited.has(key)) continue;
          const tile = tiles[n.y]![n.x]!;
          if (tile.deposit?.material === material) { visited.add(key); queue.push(n); }
        }
      }
      return { size: positions.length, positions };
    }
    function bfsReachable(tiles: any[][], starts: { x: number; y: number }[], targets: { x: number; y: number }[]): boolean {
      const visited = new Set<string>();
      const queue = [...starts.map(p => ({ pos: p }))];
      for (const start of starts) visited.add(`${start.x},${start.y}`);
      const targetSet = new Set(targets.map(p => `${p.x},${p.y}`));
      while (queue.length > 0) {
        const { pos } = queue.shift()!;
        if (targetSet.has(`${pos.x},${pos.y}`)) return true;
        for (const n of [{ x: pos.x + 1, y: pos.y }, { x: pos.x - 1, y: pos.y }, { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 }]) {
          const key = `${n.x},${n.y}`;
          if (n.x < 0 || n.x >= 64 || n.y < 0 || n.y >= 64 || visited.has(key)) continue;
          const tile = tiles[n.y]![n.x]!;
          if (tile.terrain === "grass") { visited.add(key); queue.push({ pos: n }); }
        }
      }
      return false;
    }
    for (const seed of seeds) {
      describe(`Seed ${seed}`, () => {
        it("Hub 2x2 tiles remain grass with buildingId===hub and deposit===null", () => {
          const world = createWorld(seed);
          for (const coord of [{ x: 31, y: 31 }, { x: 32, y: 31 }, { x: 31, y: 32 }, { x: 32, y: 32 }]) {
            const tile = world.tiles[coord.y]![coord.x]!;
            expect(tile.terrain).toBe("grass");
            expect(tile.buildingId).toBe("hub");
            expect(tile.deposit).toBeNull();
          }
        });
        it("Near-hub ring (5.5<=dist<=10) has iron_ore and copper_ore clusters with >=4 tiles and 400-700 amount", () => {
          const world = createWorld(seed);
          const ironClusters: { size: number; amount: number }[] = [];
          const copperClusters: { size: number; amount: number }[] = [];
          const checked = new Set<string>();
          for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
              const dist = euclideanDistance(x, y);
              if (dist < 5.5 || dist > 10) continue;
              const tile = world.tiles[y]![x]!;
              const key = `${x},${y}`;
              if (checked.has(key)) continue;
              if (tile.deposit?.material === "iron_ore") { const c = findConnectedCluster(world.tiles, x, y, "iron_ore"); if (c.size >= 4) ironClusters.push({ size: c.size, amount: tile.deposit.remaining }); for (const p of c.positions) checked.add(`${p.x},${p.y}`); }
              else if (tile.deposit?.material === "copper_ore") { const c = findConnectedCluster(world.tiles, x, y, "copper_ore"); if (c.size >= 4) copperClusters.push({ size: c.size, amount: tile.deposit.remaining }); for (const p of c.positions) checked.add(`${p.x},${p.y}`); }
            }
          }
          expect(ironClusters.some(c => c.amount >= 400 && c.amount <= 700)).toBe(true);
          expect(copperClusters.some(c => c.amount >= 400 && c.amount <= 700)).toBe(true);
        });
        it("Both starter iron_ore and copper_ore clusters are reachable from hub perimeter", () => {
          const world = createWorld(seed);
          const hubPerimeter: { x: number; y: number }[] = [];
          for (let dy = -1; dy <= 2; dy++) { for (let dx = -1; dx <= 2; dx++) { const x = 31 + dx, y = 31 + dy; if (x < 0 || x >= 64 || y < 0 || y >= 64) continue; if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) continue; const tile = world.tiles[y]![x]!; if (tile.terrain === "grass" && tile.deposit === null) hubPerimeter.push({ x, y }); } }
          const ironTargets: { x: number; y: number }[] = [];
          const copperTargets: { x: number; y: number }[] = [];
          for (let y = 0; y < 64; y++) { for (let x = 0; x < 64; x++) { const dist = euclideanDistance(x, y); if (dist < 5.5 || dist > 10) continue; const tile = world.tiles[y]![x]!; if (tile.deposit?.material === "iron_ore") ironTargets.push({ x, y }); else if (tile.deposit?.material === "copper_ore") copperTargets.push({ x, y }); } }
          expect(bfsReachable(world.tiles, hubPerimeter, ironTargets)).toBe(true);
          expect(bfsReachable(world.tiles, hubPerimeter, copperTargets)).toBe(true);
        });
        it("Mid-distance ring (10<=dist<18) has coal and silica_sand clusters with >=4 tiles and 600-1200 amount", () => {
          const world = createWorld(seed);
          const coalClusters: { size: number; amount: number }[] = [];
          const silicaClusters: { size: number; amount: number }[] = [];
          const checked = new Set<string>();
          for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
              const dist = euclideanDistance(x, y);
              if (dist < 10 || dist >= 18) continue;
              const tile = world.tiles[y]![x]!;
              const key = `${x},${y}`;
              if (checked.has(key)) continue;
              if (tile.deposit?.material === "coal") { const c = findConnectedCluster(world.tiles, x, y, "coal"); if (c.size >= 4) coalClusters.push({ size: c.size, amount: tile.deposit.remaining }); for (const p of c.positions) checked.add(`${p.x},${p.y}`); }
              else if (tile.deposit?.material === "silica_sand") { const c = findConnectedCluster(world.tiles, x, y, "silica_sand"); if (c.size >= 4) silicaClusters.push({ size: c.size, amount: tile.deposit.remaining }); for (const p of c.positions) checked.add(`${p.x},${p.y}`); }
            }
          }
          expect(coalClusters.some(c => c.amount >= 600 && c.amount <= 1200)).toBe(true);
          expect(silicaClusters.some(c => c.amount >= 600 && c.amount <= 1200)).toBe(true);
        });
        it("Outer area (18<=dist<=29) has all 4 resource types with >=6 tiles and 1500-3500 amount", () => {
          const world = createWorld(seed);
          const found = { iron_ore: false, copper_ore: false, coal: false, silica_sand: false };
          const checked = new Set<string>();
          for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
              const dist = euclideanDistance(x, y);
              if (dist < 18 || dist > 29) continue;
              const tile = world.tiles[y]![x]!;
              const key = `${x},${y}`;
              if (checked.has(key)) continue;
              for (const mat of ["iron_ore", "copper_ore", "coal", "silica_sand"] as const) {
                if (tile.deposit?.material === mat) { const c = findConnectedCluster(world.tiles, x, y, mat); if (c.size >= 6 && tile.deposit.remaining >= 1500 && tile.deposit.remaining <= 3500) found[mat] = true; for (const p of c.positions) checked.add(`${p.x},${p.y}`); }
              }
            }
          }
          expect(found.iron_ore).toBe(true);
          expect(found.copper_ore).toBe(true);
          expect(found.coal).toBe(true);
          expect(found.silica_sand).toBe(true);
        });
      });
    }
  });
});
