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

    it("includes tutorial progress fields", () => {
      const result = handlers.get_factory_summary({}) as Record<string, unknown>;
      
      expect(result.tutorialProgress).toBeDefined();
      const tutorialProgress = result.tutorialProgress as Record<string, unknown>;
      expect(typeof tutorialProgress.phase).toBe("number");
      expect(typeof tutorialProgress.completedSteps).toBe("number");
      expect(typeof tutorialProgress.totalStepsInPhase).toBe("number");
      expect(typeof tutorialProgress.isComplete).toBe("boolean");
      
      // Initial tutorial state: phase 1, currentStep not null
      expect((tutorialProgress.phase as number)).toBe(1);
      expect(tutorialProgress.currentStep).not.toBeNull();
    });

    it("includes tech tree status with all unlock fields", () => {
      const result = handlers.get_factory_summary({}) as Record<string, unknown>;
      
      expect(result.techTree).toBeDefined();
      const techTree = result.techTree as Record<string, unknown>;
      
      // Check basic tech unlocks
      expect(typeof techTree.undergroundBelt).toBe("boolean");
      expect(typeof techTree.filterSplitter).toBe("boolean");
      expect(typeof techTree.sensor).toBe("boolean");
      expect(typeof techTree.recycler).toBe("boolean");
      
      // Check nested structures
      expect(techTree.highEfficiencyRecipes).toBeDefined();
      const highEff = techTree.highEfficiencyRecipes as Record<string, unknown>;
      expect(typeof highEff.ironPlateHigh).toBe("boolean");
      expect(typeof highEff.copperPlateHigh).toBe("boolean");
      
      expect(techTree.advancedSmelting).toBeDefined();
      const advSmelt = techTree.advancedSmelting as Record<string, unknown>;
      expect(typeof advSmelt.steelPlate).toBe("boolean");
      expect(typeof advSmelt.siliconWafer).toBe("boolean");
      
      expect(techTree.electronics).toBeDefined();
      const electronics = techTree.electronics as Record<string, unknown>;
      expect(typeof electronics.assembler).toBe("boolean");
      expect(typeof electronics.circuitBoard).toBe("boolean");
      expect(typeof electronics.microchip).toBe("boolean");
      
      expect(techTree.automation).toBeDefined();
      const automation = techTree.automation as Record<string, unknown>;
      expect(typeof automation.automationModule).toBe("boolean");
    });

    it("includes research points field", () => {
      const result = handlers.get_factory_summary({}) as Record<string, unknown>;
      
      expect(typeof result.researchPoints).toBe("number");
      expect((result.researchPoints as number)).toBeGreaterThanOrEqual(0);
    });

    it("includes active quests field", () => {
      const result = handlers.get_factory_summary({}) as Record<string, unknown>;
      
      expect(result.activeQuests).toBeDefined();
      expect(Array.isArray(result.activeQuests)).toBe(true);
    });

    it("includes SPM field", () => {
      const result = handlers.get_factory_summary({}) as Record<string, unknown>;
      
      expect(typeof result.spm).toBe("number");
      expect((result.spm as number)).toBeGreaterThanOrEqual(0);
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

    it("includes unlocked field for each recipe", () => {
      const result = handlers.list_recipes({}) as Array<Record<string, unknown>>;
      
      for (const recipe of result) {
        expect(typeof recipe.unlocked).toBe("boolean");
      }
    });

    it("marks default recipes as unlocked", () => {
      const result = handlers.list_recipes({}) as Array<Record<string, unknown>>;
      
      // iron_plate and copper_plate should be unlocked by default
      const ironPlateRecipe = result.find(r => r.id === "iron_plate");
      const copperPlateRecipe = result.find(r => r.id === "copper_plate");
      
      expect(ironPlateRecipe).toBeDefined();
      expect(copperPlateRecipe).toBeDefined();
      expect((ironPlateRecipe?.unlocked as boolean)).toBe(true);
      expect((copperPlateRecipe?.unlocked as boolean)).toBe(true);
    });

    it("marks basic recipes as unlocked and tech-gated recipes as locked", () => {
      const result = handlers.list_recipes({}) as Array<Record<string, unknown>>;
      
      // Basic recipes should be unlocked by default
      const ironPlateRecipe = result.find(r => r.id === "iron_plate");
      const copperPlateRecipe = result.find(r => r.id === "copper_plate");
      const ironGearRecipe = result.find(r => r.id === "iron_gear");
      const copperWireRecipe = result.find(r => r.id === "copper_wire");
      
      expect(ironPlateRecipe).toBeDefined();
      expect(copperPlateRecipe).toBeDefined();
      expect(ironGearRecipe).toBeDefined();
      expect(copperWireRecipe).toBeDefined();
      expect((ironPlateRecipe?.unlocked as boolean)).toBe(true);
      expect((copperPlateRecipe?.unlocked as boolean)).toBe(true);
      expect((ironGearRecipe?.unlocked as boolean)).toBe(true);
      expect((copperWireRecipe?.unlocked as boolean)).toBe(true);

      // Tech-gated recipes should NOT be unlocked initially
      const steelPlateRecipe = result.find(r => r.id === "steel_plate");
      const circuitBoardRecipe = result.find(r => r.id === "circuit_board");
      const microchipRecipe = result.find(r => r.id === "microchip");
      const automationModuleRecipe = result.find(r => r.id === "automation_module");
      
      expect(steelPlateRecipe).toBeDefined();
      expect(circuitBoardRecipe).toBeDefined();
      expect(microchipRecipe).toBeDefined();
      expect(automationModuleRecipe).toBeDefined();
      expect((steelPlateRecipe?.unlocked as boolean)).toBe(false);
      expect((circuitBoardRecipe?.unlocked as boolean)).toBe(false);
      expect((microchipRecipe?.unlocked as boolean)).toBe(false);
      expect((automationModuleRecipe?.unlocked as boolean)).toBe(false);
    });

    it("filters by unlocked status when onlyUnlocked is true", () => {
      const allRecipes = handlers.list_recipes({}) as Array<Record<string, unknown>>;
      const unlockedRecipes = handlers.list_recipes({ onlyUnlocked: true }) as Array<Record<string, unknown>>;

      expect(unlockedRecipes.length).toBeLessThanOrEqual(allRecipes.length);
      
      // All returned recipes should be unlocked
      for (const recipe of unlockedRecipes) {
        expect((recipe.unlocked as boolean)).toBe(true);
      }
      
      // Unlocked recipes should be a subset of all recipes
      for (const unlocked of unlockedRecipes) {
        const found = allRecipes.find(r => r.id === unlocked.id);
        expect(found).toBeDefined();
        expect((found?.unlocked as boolean)).toBe(true);
      }
    });

    it("returns all recipes when onlyUnlocked is false or undefined", () => {
      const allRecipes = handlers.list_recipes({}) as Array<Record<string, unknown>>;
      const explicitAll = handlers.list_recipes({ onlyUnlocked: false }) as Array<Record<string, unknown>>;
      
      expect(allRecipes.length).toBe(explicitAll.length);
      expect(allRecipes.length).toBeGreaterThan(0);
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
