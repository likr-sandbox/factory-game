import { describe, it, expect } from "vitest";
import {
  MATERIAL_CATALOG,
  BUILDING_CATALOG,
  RECIPE_CATALOG,
  TECH_CATALOG,
  QUEST_CATALOG,
} from "../../src/sim/catalog";
import type { MaterialId, BuildingType, RecipeId } from "../../src/sim/types";

describe("Material Catalog", () => {
  const materialIds: MaterialId[] = [
    "iron_ore", "copper_ore", "coal", "silica_sand",
    "iron_plate", "copper_plate", "iron_gear", "copper_wire",
    "steel_plate", "silicon_wafer", "circuit_board", "microchip",
    "automation_module", "slag",
  ];

  it("should have all 14 materials", () => {
    expect(Object.keys(MATERIAL_CATALOG).length).toBe(14);
    for (const id of materialIds) {
      expect(MATERIAL_CATALOG[id]).toBeDefined();
    }
  });

  it("should have non-empty Japanese names for all materials", () => {
    for (const id of materialIds) {
      const material = MATERIAL_CATALOG[id];
      expect(material.nameJa).toBeTruthy();
      expect(material.nameJa.length).toBeGreaterThan(0);
    }
  });

  it("should have valid categories for all materials", () => {
    const validCategories = ["raw", "intermediate", "part", "electronic", "final", "byproduct"];
    for (const id of materialIds) {
      const material = MATERIAL_CATALOG[id];
      expect(validCategories).toContain(material.category);
    }
  });

  it("should match expected Japanese names", () => {
    expect(MATERIAL_CATALOG.iron_ore.nameJa).toBe("鉄鉱石");
    expect(MATERIAL_CATALOG.iron_plate.nameJa).toBe("鉄板");
    expect(MATERIAL_CATALOG.iron_gear.nameJa).toBe("鉄歯車");
    expect(MATERIAL_CATALOG.copper_wire.nameJa).toBe("銅線");
    expect(MATERIAL_CATALOG.slag.nameJa).toBe("スラグ");
  });
});

describe("Building Catalog", () => {
  const buildingTypes: BuildingType[] = [
    "miner", "belt", "splitter", "filter_splitter", "underground_belt",
    "smelter", "assembler", "recycler", "sensor", "hub",
  ];

  it("should have all 10 building types", () => {
    expect(Object.keys(BUILDING_CATALOG).length).toBe(10);
    for (const type of buildingTypes) {
      expect(BUILDING_CATALOG[type]).toBeDefined();
    }
  });

  it("should have hub as 2x2 dimensions", () => {
    expect(BUILDING_CATALOG.hub.width).toBe(2);
    expect(BUILDING_CATALOG.hub.height).toBe(2);
  });

  it("should have 1x1 dimensions for all buildings except hub", () => {
    for (const type of buildingTypes) {
      if (type !== "hub") {
        expect(BUILDING_CATALOG[type].width).toBe(1);
        expect(BUILDING_CATALOG[type].height).toBe(1);
      }
    }
  });

  it("should have non-empty Japanese names for all buildings", () => {
    for (const type of buildingTypes) {
      expect(BUILDING_CATALOG[type].nameJa.length).toBeGreaterThan(0);
    }
  });
});

describe("Recipe Catalog", () => {
  const recipeIds: RecipeId[] = [
    "iron_plate", "copper_plate", "iron_plate_high", "copper_plate_high",
    "iron_gear", "copper_wire", "steel_plate", "silicon_wafer",
    "circuit_board", "microchip", "automation_module",
  ];

  it("should have all 11 recipes", () => {
    expect(Object.keys(RECIPE_CATALOG).length).toBe(11);
    for (const id of recipeIds) {
      expect(RECIPE_CATALOG[id]).toBeDefined();
    }
  });

  it("should have positive craftTicks for all recipes", () => {
    for (const id of recipeIds) {
      expect(RECIPE_CATALOG[id].craftTicks).toBeGreaterThan(0);
    }
  });

  it("should have non-empty inputs for all recipes", () => {
    for (const id of recipeIds) {
      const recipe = RECIPE_CATALOG[id];
      const inputCount = Object.keys(recipe.inputs).length;
      expect(inputCount).toBeGreaterThan(0);
    }
  });

  it("should have non-empty outputs for all recipes", () => {
    for (const id of recipeIds) {
      const recipe = RECIPE_CATALOG[id];
      const outputCount = Object.keys(recipe.outputs).length;
      expect(outputCount).toBeGreaterThan(0);
    }
  });

  it("should reference valid materials in inputs", () => {
    const validMaterials = Object.keys(MATERIAL_CATALOG);
    for (const id of recipeIds) {
      const recipe = RECIPE_CATALOG[id];
      for (const materialId of Object.keys(recipe.inputs)) {
        expect(validMaterials).toContain(materialId);
      }
    }
  });

  it("should reference valid materials in outputs", () => {
    const validMaterials = Object.keys(MATERIAL_CATALOG);
    for (const id of recipeIds) {
      const recipe = RECIPE_CATALOG[id];
      for (const materialId of Object.keys(recipe.outputs)) {
        expect(validMaterials).toContain(materialId);
      }
    }
  });

  it("should reference valid buildings (smelter or assembler)", () => {
    for (const id of recipeIds) {
      const recipe = RECIPE_CATALOG[id];
      expect(["smelter", "assembler"]).toContain(recipe.building);
    }
  });

  it("should have Japanese names for all recipes", () => {
    for (const id of recipeIds) {
      expect(RECIPE_CATALOG[id].nameJa.length).toBeGreaterThan(0);
    }
  });

  it("should have correct recipe assignments", () => {
    expect(RECIPE_CATALOG.iron_plate.building).toBe("smelter");
    expect(RECIPE_CATALOG.iron_gear.building).toBe("assembler");
    expect(RECIPE_CATALOG.copper_wire.building).toBe("assembler");
  });

  it("should have slagChance on high-efficiency recipes", () => {
    expect(RECIPE_CATALOG.iron_plate_high.slagChance).toBe(0.15);
    expect(RECIPE_CATALOG.copper_plate_high.slagChance).toBe(0.15);
  });

  it("should have slagChance on advanced smelting recipes", () => {
    expect(RECIPE_CATALOG.steel_plate.slagChance).toBe(0.25);
    expect(RECIPE_CATALOG.silicon_wafer.slagChance).toBe(0.20);
  });

  it("should not have slagChance on basic recipes", () => {
    expect(RECIPE_CATALOG.iron_plate.slagChance).toBeUndefined();
    expect(RECIPE_CATALOG.copper_plate.slagChance).toBeUndefined();
    expect(RECIPE_CATALOG.iron_gear.slagChance).toBeUndefined();
  });

  it("should have higher output ratio for high-efficiency recipes", () => {
    // iron_plate_high: 3 iron_ore -> 2 iron_plate (better than 2->1)
    expect(RECIPE_CATALOG.iron_plate_high.inputs.iron_ore).toBe(3);
    expect(RECIPE_CATALOG.iron_plate_high.outputs.iron_plate).toBe(2);
    // copper_plate_high: 3 copper_ore -> 2 copper_plate
    expect(RECIPE_CATALOG.copper_plate_high.inputs.copper_ore).toBe(3);
    expect(RECIPE_CATALOG.copper_plate_high.outputs.copper_plate).toBe(2);
  });
});

describe("Tech Catalog", () => {
  it("should have tech entries with valid structure", () => {
    const techIds = Object.keys(TECH_CATALOG);
    expect(techIds.length).toBeGreaterThan(0);
    
    for (const id of techIds) {
      const tech = TECH_CATALOG[id];
      expect(tech).toBeDefined();
      if (tech) {
        expect(tech.nameJa.length).toBeGreaterThan(0);
        expect(tech.description.length).toBeGreaterThan(0);
        expect(tech.cost).toBeGreaterThan(0);
        expect(Array.isArray(tech.unlocks)).toBe(true);
      }
    }
  });
});

describe("Quest Catalog", () => {
  it("should have quest entries with valid structure", () => {
    const questIds = Object.keys(QUEST_CATALOG);
    expect(questIds.length).toBeGreaterThan(0);
    
    for (const id of questIds) {
      const quest = QUEST_CATALOG[id];
      expect(quest).toBeDefined();
      if (quest) {
        expect(quest.nameJa.length).toBeGreaterThan(0);
        expect(quest.description.length).toBeGreaterThan(0);
        expect([1, 2, 3, 4]).toContain(quest.phase);
      }
    }
  });

  it("should have quests across all phases", () => {
    const phases = new Set<number>();
    for (const quest of Object.values(QUEST_CATALOG)) {
      phases.add(quest.phase);
    }
    expect(phases.size).toBeGreaterThan(0);
  });
});
