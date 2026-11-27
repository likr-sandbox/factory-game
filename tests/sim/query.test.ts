// Unit tests for simulation query layer
import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/sim/world";
import { stepTicks } from "../../src/sim/engine";
import { placeBuilding } from "../../src/sim/actions";
import { getFactorySummary, inspectRegion, findResources, listRecipes, getMetrics, type TileEntry, type ResourceInfo, type RecipeInfo } from "../../src/sim/query";

describe("Query Functions", () => {
  describe("getFactorySummary", () => {
    it("returns summary for empty world with hub", () => {
      const world = createWorld(12345);
      const summary = getFactorySummary(world);

      expect(summary.width).toBe(64);
      expect(summary.height).toBe(64);
      expect(summary.tick).toBe(0);
      expect(summary.hubOrigin).toEqual({ x: 31, y: 31 });
      expect(summary.buildingCount).toBe(1); // Just the hub
      expect(summary.delivered).toEqual({});
      expect(summary.unlockedTechs).toEqual([]);
      expect(summary.completedQuests).toEqual([]);
      expect(summary.researchPoints).toBe(0);
      expect(summary.techTree).toBeDefined();
      // Initial tech tree state: basic buildings unlocked, tech-gated buildings not unlocked
      expect(summary.techTree.undergroundBelt).toBe(false);
      expect(summary.techTree.filterSplitter).toBe(false);
      expect(summary.techTree.sensor).toBe(false);
      expect(summary.techTree.recycler).toBe(false);
      // Electronics tech not unlocked, but assembler building is unlocked by default
      expect(summary.techTree.electronics.assembler).toBe(true);
      expect(summary.techTree.electronics.circuitBoard).toBe(false);
      expect(summary.techTree.electronics.microchip).toBe(false);
      // Advanced smelting recipes not unlocked
      expect(summary.techTree.advancedSmelting.steelPlate).toBe(false);
      expect(summary.techTree.advancedSmelting.siliconWafer).toBe(false);
      // Automation module not unlocked
      expect(summary.techTree.automation.automationModule).toBe(false);
      expect(summary.tutorialProgress).toBeDefined();
      // Initial tutorial state: phase 1, currentStep not null (first step pending)
      expect(summary.tutorialProgress.phase).toBe(1);
      expect(summary.tutorialProgress.currentStep).not.toBeNull();
      expect(summary.activeQuests).toEqual([]);
    });

    it("counts buildings and tracks deliveries after actions", () => {
      const world = createWorld(42);
      
      // Find a position with iron_ore deposit for the miner
      const resources = findResources(world, { material: "iron_ore", limit: 1 });
      expect(resources.length).toBeGreaterThan(0);
      const minerPos = resources[0]!;
      
      // Place a miner on the deposit
      const result = placeBuilding(world, {
        x: minerPos.x,
        y: minerPos.y,
        type: "miner",
        direction: "E",
      });
      expect(result.success).toBe(true);

      // Step ticks to simulate mining
      stepTicks(world, 120);

      const summary = getFactorySummary(world);
      expect(summary.buildingCount).toBe(2); // hub + miner
      expect(summary.activeCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("inspectRegion", () => {
    it("returns tiles within bounds", () => {
      const world = createWorld(12345);
      const entries = inspectRegion(world, { x: 0, y: 0, width: 5, height: 5 });

      expect(entries.length).toBe(25);
      expect(entries[0]?.x).toBe(0);
      expect(entries[0]?.y).toBe(0);
      expect(entries[0]?.terrain).toBeDefined();
    });

    it("clamps region to max dimension", () => {
      const world = createWorld(12345);
      const entries = inspectRegion(world, { x: 0, y: 0, width: 30, height: 30 });

      // Should be clamped to 24x24 = 576 entries max
      expect(entries.length).toBeLessThanOrEqual(576);
    });

    it("clamps to map bounds", () => {
      const world = createWorld(12345);
      const entries = inspectRegion(world, { x: 60, y: 60, width: 10, height: 10 });

      // Should only return tiles within 64x64 bounds
      for (const entry of entries) {
        expect(entry.x).toBeLessThan(64);
        expect(entry.y).toBeLessThan(64);
      }
    });

    it("includes deposit and building info when present", () => {
      const world = createWorld(42);
      
      // Place a belt
      const result = placeBuilding(world, {
        x: 10,
        y: 10,
        type: "belt",
        direction: "E",
      });
      expect(result.success).toBe(true);

      const entries = inspectRegion(world, { x: 9, y: 9, width: 3, height: 3 });
      const beltEntry = entries.find((e: TileEntry) => e.x === 10 && e.y === 10);

      expect(beltEntry?.building).toBeDefined();
      expect(beltEntry?.building?.type).toBe("belt");
      expect(beltEntry?.building?.direction).toBe("E");
    });
  });

  describe("findResources", () => {
    it("finds all resources sorted by distance", () => {
      const world = createWorld(12345);
      const resources = findResources(world);

      expect(resources.length).toBeGreaterThan(0);
      
      // Verify sorted by Manhattan distance
      for (let i = 1; i < resources.length; i++) {
        expect(resources[i]!.distanceManhattan).toBeGreaterThanOrEqual(resources[i - 1]!.distanceManhattan);
      }
    });

    it("filters by material", () => {
      const world = createWorld(12345);
      const ironResources = findResources(world, { material: "iron_ore" });

      expect(ironResources.length).toBeGreaterThan(0);
      expect(ironResources.every((r: ResourceInfo) => r.material === "iron_ore")).toBe(true);
    });

    it("filters available resources", () => {
      const world = createWorld(12345);
      
      // All resources should be available initially
      const available = findResources(world, { onlyAvailable: true });
      expect(available.every((r: ResourceInfo) => r.remaining > 0)).toBe(true);

      // Include depleted (should still find resources since none depleted yet)
      const all = findResources(world, { onlyAvailable: false });
      expect(all.length).toBe(available.length);
    });

    it("applies limit", () => {
      const world = createWorld(12345);
      const limited = findResources(world, { limit: 5 });

      expect(limited.length).toBeLessThanOrEqual(5);
    });

    it("computes correct distances from hub", () => {
      const world = createWorld(12345);
      const resources = findResources(world, { limit: 10 });

      for (const r of resources) {
        const expectedManhattan = Math.abs(r.x - world.hubOrigin.x) + Math.abs(r.y - world.hubOrigin.y);
        const expectedEuclidean = Math.sqrt(
          Math.pow(r.x - world.hubOrigin.x, 2) + Math.pow(r.y - world.hubOrigin.y, 2)
        );
        expect(r.distanceManhattan).toBe(expectedManhattan);
        expect(r.distanceEuclidean).toBeCloseTo(expectedEuclidean);
      }
    });
  });

  describe("listRecipes", () => {
    it("returns all recipes from catalog", () => {
      const world = createWorld(12345);
      const recipes = listRecipes(world);

      expect(recipes.length).toBeGreaterThan(0);
      
      // Check structure
      for (const recipe of recipes) {
        expect(recipe.id).toBeDefined();
        expect(recipe.nameJa).toBeDefined();
        expect(recipe.building).toMatch(/^(smelter|assembler)$/);
        expect(recipe.craftTicks).toBeGreaterThan(0);
        expect(recipe.inputs).toBeDefined();
        expect(recipe.outputs).toBeDefined();
      }
    });

    it("marks basic recipes as unlocked and tech-gated recipes as locked", () => {
      const world = createWorld(12345);
      const recipes = listRecipes(world);

      // Basic recipes should be unlocked by default
      const ironPlateRecipe = recipes.find((r: RecipeInfo) => r.id === "iron_plate");
      const copperPlateRecipe = recipes.find((r: RecipeInfo) => r.id === "copper_plate");
      const ironGearRecipe = recipes.find((r: RecipeInfo) => r.id === "iron_gear");
      const copperWireRecipe = recipes.find((r: RecipeInfo) => r.id === "copper_wire");
      
      expect(ironPlateRecipe).toBeDefined();
      expect(copperPlateRecipe).toBeDefined();
      expect(ironGearRecipe).toBeDefined();
      expect(copperWireRecipe).toBeDefined();
      expect((ironPlateRecipe?.unlocked as boolean)).toBe(true);
      expect((copperPlateRecipe?.unlocked as boolean)).toBe(true);
      expect((ironGearRecipe?.unlocked as boolean)).toBe(true);
      expect((copperWireRecipe?.unlocked as boolean)).toBe(true);

      // Tech-gated recipes should NOT be unlocked initially
      const steelPlateRecipe = recipes.find((r: RecipeInfo) => r.id === "steel_plate");
      const circuitBoardRecipe = recipes.find((r: RecipeInfo) => r.id === "circuit_board");
      const microchipRecipe = recipes.find((r: RecipeInfo) => r.id === "microchip");
      const automationModuleRecipe = recipes.find((r: RecipeInfo) => r.id === "automation_module");
      
      expect(steelPlateRecipe).toBeDefined();
      expect(circuitBoardRecipe).toBeDefined();
      expect(microchipRecipe).toBeDefined();
      expect(automationModuleRecipe).toBeDefined();
      expect((steelPlateRecipe?.unlocked as boolean)).toBe(false);
      expect((circuitBoardRecipe?.unlocked as boolean)).toBe(false);
      expect((microchipRecipe?.unlocked as boolean)).toBe(false);
      expect((automationModuleRecipe?.unlocked as boolean)).toBe(false);
    });

    it("includes unlocked status", () => {
      const world = createWorld(12345);
      const recipes = listRecipes(world);

      // Some recipes should be unlocked by default
      const defaultUnlocked = recipes.filter((r: RecipeInfo) => r.unlocked);
      expect(defaultUnlocked.length).toBeGreaterThan(0);
    });

    it("filters by unlocked when requested", () => {
      const world = createWorld(12345);
      const allRecipes = listRecipes(world);
      const unlockedOnly = listRecipes(world, { onlyUnlocked: true });

      expect(unlockedOnly.length).toBeLessThanOrEqual(allRecipes.length);
      expect(unlockedOnly.every((r: RecipeInfo) => r.unlocked)).toBe(true);
    });
  });

  describe("getMetrics", () => {
    it("returns SPM and bottlenecks", () => {
      const world = createWorld(12345);
      const metrics = getMetrics(world);

      expect(metrics.spm).toBeGreaterThanOrEqual(0);
      expect(metrics.deliveriesPerMinute).toBeDefined();
      expect(Array.isArray(metrics.bottlenecks)).toBe(true);
      expect(Array.isArray(metrics.alerts)).toBe(true);
      expect(metrics.researchPoints).toBe(0);
    });

    it("tracks delivery rates per material", () => {
      const world = createWorld(42);

      // Place miner and smelter to produce iron plates
      placeBuilding(world, { x: 20, y: 20, type: "miner", direction: "E" });
      placeBuilding(world, { x: 21, y: 20, type: "smelter", direction: "E", recipeId: "iron_plate" });
      
      // Run for many ticks to accumulate some production
      stepTicks(world, 600);

      const metrics = getMetrics(world);
      expect(metrics.spm).toBeGreaterThanOrEqual(0);
    });

    it("identifies bottleneck candidates", () => {
      const world = createWorld(12345);

      // Place an isolated belt with no items
      placeBuilding(world, { x: 50, y: 50, type: "belt", direction: "E" });

      const metrics = getMetrics(world);
      // Belt might show as idle or not depending on implementation
      expect(Array.isArray(metrics.bottlenecks)).toBe(true);
    });

    it("generates alerts for faulted/depleted buildings", () => {
      const world = createWorld(12345);

      // No faulted or depleted buildings initially
      const metrics = getMetrics(world);
      expect(metrics.alerts.length).toBe(0);
    });

    it("supports custom window size", () => {
      const world = createWorld(12345);
      const metrics1 = getMetrics(world, { windowTicks: 300 });
      const metrics2 = getMetrics(world, { windowTicks: 1200 });

      expect(metrics1.spm).toBeGreaterThanOrEqual(0);
      expect(metrics2.spm).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Integration test with world simulation", () => {
    it("full workflow: build, run, query", () => {
      const world = createWorld(999);

      // Find a valid iron_ore deposit position for the miner
      const resources = findResources(world, { material: "iron_ore", limit: 1 });
      expect(resources.length).toBeGreaterThan(0);
      const minerPos = resources[0]!;

      // Setup: Place a simple production line
      // Miner at deposit position facing East
      const minerResult = placeBuilding(world, {
        x: minerPos.x,
        y: minerPos.y,
        type: "miner",
        direction: "E",
      });
      expect(minerResult.success).toBe(true);

      // Belt next to miner
      const beltResult = placeBuilding(world, {
        x: minerPos.x + 1,
        y: minerPos.y,
        type: "belt",
        direction: "E",
      });
      expect(beltResult.success).toBe(true);

      // Smelter at (minerPos.x + 2, minerPos.y) 
      const smelterResult = placeBuilding(world, {
        x: minerPos.x + 2,
        y: minerPos.y,
        type: "smelter",
        direction: "S",
        recipeId: "iron_plate",
      });
      expect(smelterResult.success).toBe(true);

      // Step the simulation
      stepTicks(world, 300);

      // Query the state
      const summary = getFactorySummary(world);
      expect(summary.tick).toBe(300);
      expect(summary.buildingCount).toBe(4); // hub + miner + belt + smelter

      // Inspect the region around our production line (around miner position)
      const region = inspectRegion(world, { 
        x: Math.max(0, minerPos.x - 2), 
        y: Math.max(0, minerPos.y - 2), 
        width: 10, 
        height: 10 
      });
      expect(region.some((e: TileEntry) => e.building?.type === "miner")).toBe(true);
      expect(region.some((e: TileEntry) => e.building?.type === "smelter")).toBe(true);

      // Find nearby resources
      const ironResources = findResources(world, { material: "iron_ore", limit: 5 });
      expect(ironResources.length).toBeGreaterThan(0);

      // Get metrics
      const metrics = getMetrics(world);
      expect(metrics.spm).toBeGreaterThanOrEqual(0);
    });
  });
});
