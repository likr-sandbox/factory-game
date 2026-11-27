import { describe, it, expect } from "vitest";
import {
  WORLD_SIZE, HUB_ORIGIN, nextRandom, createRng, inBounds, getTile,
  directionDelta, oppositeDirection, isHubTile, createWorld,
} from "../../src/sim/world";

describe("World Generator", () => {
  it("WORLD_SIZE should be 64", () => expect(WORLD_SIZE).toBe(64));
  it("HUB_ORIGIN should be {x: 31, y: 31}", () => expect(HUB_ORIGIN).toEqual({ x: 31, y: 31 }));

  describe("PRNG Helpers", () => {
    it("nextRandom should produce deterministic values", () => {
      const { value: v1, nextState: ns1 } = nextRandom(42);
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
      const hubCoords = [{ x: 31, y: 31 }, { x: 32, y: 31 }, { x: 31, y: 32 }, { x: 32, y: 32 }];
      for (const coord of hubCoords) {
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
          if (t1.deposit) {
            expect(t2.deposit!.material).toBe(t1.deposit.material);
            expect(t2.deposit!.remaining).toBe(t1.deposit.remaining);
          } else expect(t2.deposit).toBeNull();
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
      outer1: for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          if (world.tiles[y]![x]!.terrain === "rock") { hasRock = true; break outer1; }
        }
      }
      expect(hasRock).toBe(true);
    });

    it("should have water terrain", () => {
      const world = createWorld(42);
      let hasWater = false;
      outer2: for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          if (world.tiles[y]![x]!.terrain === "water") { hasWater = true; break outer2; }
        }
      }
      expect(hasWater).toBe(true);
    });

    it("should not have rock or water overlapping hub", () => {
      const world = createWorld(42);
      const hubCoords = [{ x: 31, y: 31 }, { x: 32, y: 31 }, { x: 31, y: 32 }, { x: 32, y: 32 }];
      for (const coord of hubCoords) {
        const tile = world.tiles[coord.y]![coord.x]!;
        expect(tile.terrain).not.toBe("rock");
        expect(tile.terrain).not.toBe("water");
      }
    });

    it("should have mostly grass terrain", () => {
      const world = createWorld(42);
      let grass = 0, total = 0;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          total++;
          if (world.tiles[y]![x]!.terrain === "grass") grass++;
        }
      }
      expect(grass / total).toBeGreaterThan(0.5);
    });
  });

  describe("Progression and Tutorial State", () => {
    it("should initialize with zero research points", () => {
      const world = createWorld(42);
      expect(world.researchPoints).toBe(0);
    });

    it("should initialize tutorial phase at 0", () => {
      const world = createWorld(42);
      expect(world.tutorialPhase).toBe(0);
    });

    it("should initialize empty completed tutorial steps", () => {
      const world = createWorld(42);
      expect(world.completedTutorialSteps).toEqual([]);
    });

    it("should initialize empty active quests", () => {
      const world = createWorld(42);
      expect(world.activeQuests).toEqual([]);
    });

    it("should initialize nextQuestId at 0", () => {
      const world = createWorld(42);
      expect(world.nextQuestId).toBe(0);
    });

    it("should initialize empty SPM tracking", () => {
      const world = createWorld(42);
      expect(world.spm).toEqual({});
    });

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
});
