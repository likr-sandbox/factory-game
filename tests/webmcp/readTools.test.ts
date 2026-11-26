// Unit tests for WebMCP read tool handlers
// Pure TypeScript - ZERO Phaser dependencies

import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/sim/world";
import { createReadToolHandlers } from "../../src/webmcp/readTools";

describe("createReadToolHandlers", () => {
  const world = createWorld(42);
  const handlers = createReadToolHandlers(() => world);

  describe("get_factory_summary", () => {
    it("returns a FactorySummary object with correct shape", () => {
      const result = handlers.get_factory_summary({});

      expect(result).toBeInstanceOf(Object);
      const summary = result as Record<string, unknown>;
      expect((summary.width as number)).toBe(64);
      expect((summary.height as number)).toBe(64);
      expect((summary.tick as number)).toBe(0);
      expect(typeof summary.spm).toBe("number");
      expect(typeof summary.buildingCount).toBe("number");
      expect(Array.isArray(summary.unlockedTechs)).toBe(true);
      expect(Array.isArray(summary.completedQuests)).toBe(true);
    });

    it("throws on non-object input", () => {
      expect(() => handlers.get_factory_summary(null as unknown as Record<string, unknown>)).toThrow();
      expect(() => handlers.get_factory_summary("invalid" as unknown as Record<string, unknown>)).toThrow();
    });
  });

  describe("inspect_region", () => {
    it("returns a TileEntry[] array with correct shape", () => {
      const result = handlers.inspect_region({ x: 0, y: 0, width: 10, height: 10 });

      expect(Array.isArray(result)).toBe(true);
      const tiles = result as Array<Record<string, unknown>>;
      expect(tiles.length).toBeGreaterThan(0);

      // Verify tile entries have required fields
      for (const tile of tiles) {
        expect(typeof tile.x).toBe("number");
        expect(typeof tile.y).toBe("number");
        expect(typeof tile.terrain).toBe("string");
      }
    });

    it("throws when required parameters are missing", () => {
      expect(() => handlers.inspect_region({} as Record<string, unknown>)).toThrow(/missing/);
      expect(() => handlers.inspect_region({ x: 0, y: 0 } as Record<string, unknown>)).toThrow(/missing/);
      expect(() => handlers.inspect_region({ x: 0, y: 0, width: 10 } as Record<string, unknown>)).toThrow(/missing/);
    });

    it("throws when parameters are non-numeric", () => {
      expect(() => handlers.inspect_region({ x: "0", y: 0, width: 10, height: 10 } as unknown as Record<string, unknown>)).toThrow(/finite numbers/);
      expect(() => handlers.inspect_region({ x: 0, y: null, width: 10, height: 10 } as unknown as Record<string, unknown>)).toThrow(/finite numbers/);
      expect(() => handlers.inspect_region({ x: 0, y: 0, width: NaN, height: 10 } as Record<string, unknown>)).toThrow(/finite numbers/);
      expect(() => handlers.inspect_region({ x: 0, y: 0, width: 10, height: Infinity } as Record<string, unknown>)).toThrow(/finite numbers/);
    });
  });

  describe("find_resources", () => {
    it("returns a ResourceInfo[] array", () => {
      const result = handlers.find_resources({});

      expect(Array.isArray(result)).toBe(true);
      const resources = result as Array<Record<string, unknown>>;

      // Resources should be sorted by distance
      if (resources.length > 1) {
        for (let i = 1; i < resources.length; i++) {
          const currDist = resources[i]?.distanceManhattan as number | undefined;
          const prevDist = resources[i - 1]?.distanceManhattan as number | undefined;
          expect(currDist).toBeGreaterThanOrEqual(prevDist ?? 0);
        }
      }
    });

    it("filters by material when specified", () => {
      const result = handlers.find_resources({ material: "iron_ore" });
      const resources = result as Array<Record<string, unknown>>;

      for (const resource of resources) {
        expect(resource.material).toBe("iron_ore");
      }
    });

    it("applies limit when specified", () => {
      const result = handlers.find_resources({ limit: 5 });
      const resources = result as Array<unknown>;
      expect(resources.length).toBeLessThanOrEqual(5);
    });
  });

  describe("list_recipes", () => {
    it("returns a RecipeInfo[] array", () => {
      const result = handlers.list_recipes({});

      expect(Array.isArray(result)).toBe(true);
      const recipes = result as Array<Record<string, unknown>>;
      expect(recipes.length).toBeGreaterThan(0);

      for (const recipe of recipes) {
        expect(typeof recipe.id).toBe("string");
        expect(typeof recipe.nameJa).toBe("string");
        expect(["smelter", "assembler"]).toContain(recipe.building);
      }
    });

    it("filters by unlocked status when specified", () => {
      const allRecipes = handlers.list_recipes({}) as Array<Record<string, unknown>>;
      const unlockedRecipes = handlers.list_recipes({ onlyUnlocked: true }) as Array<Record<string, unknown>>;

      expect(unlockedRecipes.length).toBeLessThanOrEqual(allRecipes.length);
      for (const recipe of unlockedRecipes) {
        expect((recipe.unlocked as boolean)).toBe(true);
      }
    });
  });

  describe("get_metrics", () => {
    it("returns a Metrics object with correct shape", () => {
      const result = handlers.get_metrics({});

      expect(result).toBeInstanceOf(Object);
      const metrics = result as Record<string, unknown>;
      expect(typeof metrics.spm).toBe("number");
      expect((metrics.spm as number)).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.deliveriesPerMinute).toBe("object");
      expect(Array.isArray(metrics.bottlenecks)).toBe(true);
      expect(Array.isArray(metrics.alerts)).toBe(true);
    });

    it("accepts windowTicks parameter", () => {
      const result = handlers.get_metrics({ windowTicks: 300 });
      const metrics = result as Record<string, unknown>;
      expect(typeof metrics.spm).toBe("number");
    });
  });
});
