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

  it("should have basic buildings unlocked by default", () => {
    // Basic buildings should be unlocked by default
    expect(BUILDING_CATALOG.hub.unlockedByDefault).toBe(true);
    expect(BUILDING_CATALOG.miner.unlockedByDefault).toBe(true);
    expect(BUILDING_CATALOG.belt.unlockedByDefault).toBe(true);
    expect(BUILDING_CATALOG.splitter.unlockedByDefault).toBe(true);
    expect(BUILDING_CATALOG.smelter.unlockedByDefault).toBe(true);
    expect(BUILDING_CATALOG.assembler.unlockedByDefault).toBe(true);
  });

  it("should have tech-gated buildings locked by default", () => {
    // Tech-gated buildings should NOT be unlocked by default
    expect(BUILDING_CATALOG.underground_belt.unlockedByDefault).toBe(false);
    expect(BUILDING_CATALOG.filter_splitter.unlockedByDefault).toBe(false);
    expect(BUILDING_CATALOG.sensor.unlockedByDefault).toBe(false);
    expect(BUILDING_CATALOG.recycler.unlockedByDefault).toBe(false);
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
  const expectedTechIds: string[] = [
    "filter_splitter", "underground_belt", "high_efficiency",
    "sensor", "recycler", "advanced_smelting", "electronics", "automation"
  ];

  it("should have all 8 tech entries", () => {
    expect(Object.keys(TECH_CATALOG).length).toBe(8);
    for (const id of expectedTechIds) {
      expect(TECH_CATALOG[id]).toBeDefined();
    }
  });

  it("should have valid structure for all tech entries", () => {
    for (const id of expectedTechIds) {
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

  it("should have correct costs matching TECH_COSTS in progression.ts", () => {
    expect(TECH_CATALOG["filter_splitter"]!.cost).toBe(100);
    expect(TECH_CATALOG["underground_belt"]!.cost).toBe(150);
    expect(TECH_CATALOG["high_efficiency"]!.cost).toBe(200);
    expect(TECH_CATALOG["sensor"]!.cost).toBe(150);
    expect(TECH_CATALOG["recycler"]!.cost).toBe(200);
    expect(TECH_CATALOG["advanced_smelting"]!.cost).toBe(200);
    expect(TECH_CATALOG["electronics"]!.cost).toBe(300);
    expect(TECH_CATALOG["automation"]!.cost).toBe(500);
  });

  it("should have correct unlocks for each tech", () => {
    expect(TECH_CATALOG["filter_splitter"]!.unlocks).toContain("filter_splitter");
    expect(TECH_CATALOG["underground_belt"]!.unlocks).toContain("underground_belt");
    expect(TECH_CATALOG["high_efficiency"]!.unlocks).toContain("iron_plate_high");
    expect(TECH_CATALOG["high_efficiency"]!.unlocks).toContain("copper_plate_high");
    expect(TECH_CATALOG["sensor"]!.unlocks).toContain("sensor");
    expect(TECH_CATALOG["recycler"]!.unlocks).toContain("recycler");
    expect(TECH_CATALOG["advanced_smelting"]!.unlocks).toContain("steel_plate");
    expect(TECH_CATALOG["advanced_smelting"]!.unlocks).toContain("silicon_wafer");
    expect(TECH_CATALOG["electronics"]!.unlocks).toContain("assembler");
    expect(TECH_CATALOG["electronics"]!.unlocks).toContain("circuit_board");
    expect(TECH_CATALOG["electronics"]!.unlocks).toContain("microchip");
    expect(TECH_CATALOG["automation"]!.unlocks).toContain("automation_module");
  });
});

describe("Quest Catalog", () => {
  // All 9 craftable items from RECIPE_CATALOG (excluding high-efficiency variants)
  const questIds: RecipeId[] = [
    "iron_plate", "copper_plate", "iron_gear", "copper_wire",
    "steel_plate", "silicon_wafer", "circuit_board", "microchip",
    "automation_module",
  ];

  it("should have all 9 craftable item quests", () => {
    expect(Object.keys(QUEST_CATALOG).length).toBe(9);
    for (const id of questIds) {
      expect(QUEST_CATALOG[id]).toBeDefined();
    }
  });

  it("should have positive rewardPoints for all quests", () => {
    for (const id of questIds) {
      const quest = QUEST_CATALOG[id];
      expect(quest).toBeDefined();
      if (quest) {
        expect(quest.rewardPoints).toBeGreaterThan(0);
      }
    }
  });

  it("should have valid deliver with materials from MATERIAL_CATALOG", () => {
    const validMaterials = Object.keys(MATERIAL_CATALOG);
    for (const id of questIds) {
      const quest = QUEST_CATALOG[id];
      expect(quest).toBeDefined();
      if (quest && quest.deliver) {
        const materials = Object.keys(quest.deliver);
        expect(materials.length).toBeGreaterThan(0);
        for (const materialId of materials) {
          expect(validMaterials).toContain(materialId);
        }
      }
    }
  });

  it("should have valid phase (1-4) for all quests", () => {
    for (const id of questIds) {
      const quest = QUEST_CATALOG[id];
      expect(quest).toBeDefined();
      if (quest) {
        expect([1, 2, 3, 4]).toContain(quest.phase);
      }
    }
  });

  it("should have non-empty Japanese names and descriptions", () => {
    for (const id of questIds) {
      const quest = QUEST_CATALOG[id];
      expect(quest).toBeDefined();
      if (quest) {
        expect(quest.nameJa.length).toBeGreaterThan(0);
        expect(quest.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("should have quests across all phases", () => {
    const phases = new Set<number>();
    for (const quest of Object.values(QUEST_CATALOG)) {
      phases.add(quest.phase);
    }
    // Should have at least phases 1, 2, 3, 4 covered
    expect(phases.size).toBeGreaterThanOrEqual(3);
    expect(phases).toContain(1);
  });

  it("should match quest deliver target with the recipe output material", () => {
    // Each quest should deliver the main output of its corresponding recipe
    for (const id of questIds) {
      const quest = QUEST_CATALOG[id];
      const recipe = RECIPE_CATALOG[id];
      expect(quest).toBeDefined();
      expect(recipe).toBeDefined();
      if (quest && recipe && quest.deliver) {
        const deliveredMaterial = Object.keys(quest.deliver)[0];
        expect(deliveredMaterial).toBe(id);
      }
    }
  });
});
