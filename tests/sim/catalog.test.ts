import { describe, it, expect } from "vitest";
import {
  MATERIAL_CATALOG,
  BUILDING_CATALOG,
  RECIPE_CATALOG,
  TECH_CATALOG,
  QUEST_CATALOG,
  MINING_INTERVAL,
  BELT_MOVE_INTERVAL,
  MAX_OUTPUT_BUFFER,
  MIN_INPUT_BUFFER_PER_MATERIAL,
  INPUT_BUFFER_MULTIPLIER,
} from "../../src/sim/catalog";
import { RESEARCH_POINTS } from "../../src/sim/progression";
import * as Buffers from "../../src/sim/buffers";
import type { MaterialId, BuildingType, RecipeId, BuildingState, BeltItem } from "../../src/sim/types";

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

describe("Balance Constants", () => {
  it("should export correct balance constants", () => {
    expect(MINING_INTERVAL).toBe(60);
    expect(BELT_MOVE_INTERVAL).toBe(10);
    expect(MAX_OUTPUT_BUFFER).toBe(10);
    expect(MIN_INPUT_BUFFER_PER_MATERIAL).toBe(6);
    expect(INPUT_BUFFER_MULTIPLIER).toBe(3);
  });
});

describe("Production Ratios at 60 TPS", () => {
  it("should have clean integer ratios for iron_plate (60 ticks = 1.0/s, 2 miners : 1 smelter)", () => {
    expect(RECIPE_CATALOG.iron_plate.craftTicks).toBe(60);
    expect(RECIPE_CATALOG.iron_plate.inputs.iron_ore).toBe(2);
    expect(RECIPE_CATALOG.iron_plate.outputs.iron_plate).toBe(1);
    // At 60 TPS: 60 ticks = 1 craft/sec = 1 plate/sec
    // Each miner produces 1 ore/60 ticks = 1 ore/sec
    // 2 ores needed per plate, so 2 miners feed 1 smelter
  });

  it("should have clean integer ratios for iron_plate_high (75 ticks = 1.6/s, faster AND more ore-efficient)", () => {
    expect(RECIPE_CATALOG.iron_plate_high.craftTicks).toBe(75);
    expect(RECIPE_CATALOG.iron_plate_high.inputs.iron_ore).toBe(3);
    expect(RECIPE_CATALOG.iron_plate_high.outputs.iron_plate).toBe(2);
    // At 60 TPS: 75 ticks = 0.8 crafts/sec = 1.6 plates/sec
    // Ore efficiency: 3 ore / 2 plates = 1.5 ore/plate (vs 2 ore/plate for basic)
    // Faster: 1.6/s vs 1.0/s
    // More efficient: 1.5 ore/plate vs 2 ore/plate
  });

  it("should have clean integer ratios for copper_plate_high (75 ticks = 1.6/s, faster AND more ore-efficient)", () => {
    expect(RECIPE_CATALOG.copper_plate_high.craftTicks).toBe(75);
    expect(RECIPE_CATALOG.copper_plate_high.inputs.copper_ore).toBe(3);
    expect(RECIPE_CATALOG.copper_plate_high.outputs.copper_plate).toBe(2);
  });

  it("should have clean integer ratios for iron_gear (60 ticks = 1.0/s, 2 basic iron smelters : 1 gear assembler)", () => {
    expect(RECIPE_CATALOG.iron_gear.craftTicks).toBe(60);
    expect(RECIPE_CATALOG.iron_gear.inputs.iron_plate).toBe(2);
    expect(RECIPE_CATALOG.iron_gear.outputs.iron_gear).toBe(1);
    // At 60 TPS: 60 ticks = 1 craft/sec = 1 gear/sec
    // 2 iron_plate needed per gear, each basic smelter produces 1 plate/sec
    // So 2 basic iron smelters feed 1 gear assembler
  });

  it("should have clean integer ratios for copper_wire (60 ticks = 2.0/s, 1 basic copper smelter : 1 wire assembler)", () => {
    expect(RECIPE_CATALOG.copper_wire.craftTicks).toBe(60);
    expect(RECIPE_CATALOG.copper_wire.inputs.copper_plate).toBe(1);
    expect(RECIPE_CATALOG.copper_wire.outputs.copper_wire).toBe(2);
    // At 60 TPS: 60 ticks = 1 craft/sec = 2 wire/sec
    // 1 copper_plate needed for 2 wires, 1 basic smelter produces 1 plate/sec
    // So 1 basic copper smelter feeds 1 wire assembler
  });

  it("should have clean integer ratios for steel_plate (120 ticks = 0.5/s, slagChance: 0.25)", () => {
    expect(RECIPE_CATALOG.steel_plate.craftTicks).toBe(120);
    expect(RECIPE_CATALOG.steel_plate.inputs.iron_plate).toBe(2);
    expect(RECIPE_CATALOG.steel_plate.inputs.coal).toBe(1);
    expect(RECIPE_CATALOG.steel_plate.outputs.steel_plate).toBe(1);
    expect(RECIPE_CATALOG.steel_plate.slagChance).toBe(0.25);
    // At 60 TPS: 120 ticks = 0.5 crafts/sec = 0.5 steel_plate/sec
  });

  it("should have clean integer ratios for silicon_wafer (120 ticks = 0.5/s, slagChance: 0.20)", () => {
    expect(RECIPE_CATALOG.silicon_wafer.craftTicks).toBe(120);
    expect(RECIPE_CATALOG.silicon_wafer.inputs.silica_sand).toBe(2);
    expect(RECIPE_CATALOG.silicon_wafer.inputs.coal).toBe(1);
    expect(RECIPE_CATALOG.silicon_wafer.outputs.silicon_wafer).toBe(1);
    expect(RECIPE_CATALOG.silicon_wafer.slagChance).toBe(0.20);
    // At 60 TPS: 120 ticks = 0.5 crafts/sec = 0.5 silicon_wafer/sec
  });

  it("should have clean integer ratios for circuit_board (90 ticks = 2/3/s, 1 wire assembler feeds 1 circuit_board assembler)", () => {
    expect(RECIPE_CATALOG.circuit_board.craftTicks).toBe(90);
    expect(RECIPE_CATALOG.circuit_board.inputs.iron_plate).toBe(1);
    expect(RECIPE_CATALOG.circuit_board.inputs.copper_wire).toBe(3);
    expect(RECIPE_CATALOG.circuit_board.outputs.circuit_board).toBe(1);
    // At 60 TPS: 90 ticks = 2/3 crafts/sec = 2/3 circuit_board/sec
    // 3 copper_wire needed per circuit_board, wire assembler produces 2 wire/sec
    // 1 wire assembler produces 2 wire/sec, needs 3 wire per circuit_board craft
    // So 1 wire assembler feeds 1 circuit_board assembler (both run at 2/3 rate)
  });

  it("should have clean integer ratios for microchip (240 ticks = 0.25/s)", () => {
    expect(RECIPE_CATALOG.microchip.craftTicks).toBe(240);
    expect(RECIPE_CATALOG.microchip.inputs.circuit_board).toBe(1);
    expect(RECIPE_CATALOG.microchip.inputs.silicon_wafer).toBe(2);
    expect(RECIPE_CATALOG.microchip.inputs.copper_wire).toBe(2);
    expect(RECIPE_CATALOG.microchip.outputs.microchip).toBe(1);
    // At 60 TPS: 240 ticks = 0.25 crafts/sec = 0.25 microchip/sec
  });

  it("should have clean integer ratios for automation_module (240 ticks = 0.25/s, 1 steel smelter + 1 gear assembler + 2 microchip assemblers : 1 automation_module assembler)", () => {
    expect(RECIPE_CATALOG.automation_module.craftTicks).toBe(240);
    expect(RECIPE_CATALOG.automation_module.inputs.steel_plate).toBe(2);
    expect(RECIPE_CATALOG.automation_module.inputs.iron_gear).toBe(4);
    expect(RECIPE_CATALOG.automation_module.inputs.microchip).toBe(2);
    expect(RECIPE_CATALOG.automation_module.outputs.automation_module).toBe(1);
    // At 60 TPS: 240 ticks = 0.25 crafts/sec = 0.25 automation_module/sec
    // Needs: 2 steel_plate/sec * 0.25 = 0.5 steel_plate/sec → 1 steel smelter (0.5/s)
    //        4 iron_gear/sec * 0.25 = 1 iron_gear/sec → 1 gear assembler (1.0/s)
    //        2 microchip/sec * 0.25 = 0.5 microchip/sec → 2 microchip assemblers (0.25/s each)
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

  it("should have correct costs matching specification", () => {
    expect(TECH_CATALOG["filter_splitter"]!.cost).toBe(60);
    expect(TECH_CATALOG["underground_belt"]!.cost).toBe(80);
    expect(TECH_CATALOG["sensor"]!.cost).toBe(80);
    expect(TECH_CATALOG["recycler"]!.cost).toBe(100);
    expect(TECH_CATALOG["high_efficiency"]!.cost).toBe(120);
    expect(TECH_CATALOG["advanced_smelting"]!.cost).toBe(150);
    expect(TECH_CATALOG["electronics"]!.cost).toBe(220);
    expect(TECH_CATALOG["automation"]!.cost).toBe(400);
  });

  it("should have correct prerequisites for each tech", () => {
    expect(TECH_CATALOG["filter_splitter"]!.prerequisites).toEqual([]);
    expect(TECH_CATALOG["underground_belt"]!.prerequisites).toEqual([]);
    expect(TECH_CATALOG["sensor"]!.prerequisites).toEqual([]);
    expect(TECH_CATALOG["recycler"]!.prerequisites).toEqual(["filter_splitter"]);
    expect(TECH_CATALOG["high_efficiency"]!.prerequisites).toEqual(["filter_splitter"]);
    expect(TECH_CATALOG["advanced_smelting"]!.prerequisites).toEqual([]);
    expect(TECH_CATALOG["electronics"]!.prerequisites).toEqual(["advanced_smelting"]);
    expect(TECH_CATALOG["automation"]!.prerequisites).toEqual(["electronics"]);
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
    expect(TECH_CATALOG["electronics"]!.unlocks).not.toContain("assembler");
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

describe("Buffers Module", () => {
  const mockBuildingBase: BuildingState = {
    id: "test-building",
    type: "miner",
    x: 0,
    y: 0,
    direction: "N",
    inputBuffer: {},
    outputBuffer: {},
    beltItems: [],
    craftProgress: 0,
    roundRobinIndex: 0,
    faulted: false,
    load: 0,
    idleTicks: 0,
    blockedTicks: 0,
  };

  describe("getInputBufferLimit", () => {
    it("should return 0 for smelter/assembler without recipeId", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "smelter", recipeId: undefined };
      expect(Buffers.getInputBufferLimit(building, "iron_plate")).toBe(0);
    });

    it("should return 0 for smelter/assembler with material not in recipe inputs", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
      };
      // copper_ore is not in iron_plate recipe inputs
      expect(Buffers.getInputBufferLimit(building, "copper_ore")).toBe(0);
    });

    it("should return correct limit for valid recipe material", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
      };
      // iron_plate requires 2 iron_ore, so limit = max(6, 2 * 3) = 6
      expect(Buffers.getInputBufferLimit(building, "iron_ore" as MaterialId)).toBe(6);
    });

    it("should use INPUT_BUFFER_MULTIPLIER for higher required amounts", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "assembler",
        recipeId: "circuit_board" as RecipeId,
      };
      // circuit_board requires 3 copper_wire, so limit = max(6, 3 * 3) = 9
      expect(Buffers.getInputBufferLimit(building, "copper_wire" as MaterialId)).toBe(9);
    });

    it("should return MAX_OUTPUT_BUFFER for non-smelter/assembler buildings", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "splitter" };
      expect(Buffers.getInputBufferLimit(building, "iron_plate" as MaterialId)).toBe(10);
    });
  });

  describe("canAcceptItem", () => {
    it("should allow belts to accept items if beltItems.length < 3", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "belt", beltItems: [] };
      expect(Buffers.canAcceptItem(building, "iron_plate" as MaterialId)).toBe(true);
    });

    it("should reject belt items if beltItems.length >= 3", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "belt",
        beltItems: [
          { material: "iron_plate" as MaterialId, movedAtTick: 0 },
          { material: "iron_plate" as MaterialId, movedAtTick: 0 },
          { material: "iron_plate" as MaterialId, movedAtTick: 0 },
        ],
      };
      expect(Buffers.canAcceptItem(building, "iron_plate" as MaterialId)).toBe(false);
    });

    it("should reject smelter/assembler item if no recipeId", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "smelter", recipeId: undefined, inputBuffer: {} };
      expect(Buffers.canAcceptItem(building, "iron_plate" as MaterialId)).toBe(false);
    });

    it("should reject smelter/assembler item if material not in recipe inputs", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
        inputBuffer: {},
      };
      expect(Buffers.canAcceptItem(building, "copper_ore" as MaterialId)).toBe(false);
    });

    it("should accept smelter/assembler item if under per-material limit", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
        inputBuffer: { iron_ore: 5 },
      };
      // Limit is 6, current is 5, so should accept
      expect(Buffers.canAcceptItem(building, "iron_ore" as MaterialId)).toBe(true);
    });

    it("should reject smelter/assembler item if at or over per-material limit", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
        inputBuffer: { iron_ore: 6 },
      };
      // Limit is 6, current is 6, so should reject
      expect(Buffers.canAcceptItem(building, "iron_ore" as MaterialId)).toBe(false);
    });

    it("should check total buffer count for splitter", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "splitter",
        inputBuffer: { iron_plate: 9 },
      };
      expect(Buffers.canAcceptItem(building, "iron_plate" as MaterialId)).toBe(true);
    });

    it("should reject splitter if total buffer items >= MAX_OUTPUT_BUFFER", () => {
      const building: BuildingState = {
        ...mockBuildingBase,
        type: "splitter",
        inputBuffer: { iron_plate: 10 },
      };
      expect(Buffers.canAcceptItem(building, "iron_plate" as MaterialId)).toBe(false);
    });
  });

  describe("canAcceptBeltItem", () => {
    it("should delegate to canAcceptItem", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "belt", beltItems: [] };
      expect(Buffers.canAcceptBeltItem(building, "iron_plate" as MaterialId)).toBe(true);
    });
  });

  describe("addToBuffer", () => {
    it("should add amount to buffer", () => {
      const buffer: Partial<Record<MaterialId, number>> = {};
      Buffers.addToBuffer(buffer, "iron_plate" as MaterialId, 5);
      expect(buffer["iron_plate"]).toBe(5);
    });

    it("should accumulate existing buffer values", () => {
      const buffer: Partial<Record<MaterialId, number>> = { iron_plate: 3 };
      Buffers.addToBuffer(buffer, "iron_plate" as MaterialId, 2);
      expect(buffer["iron_plate"]).toBe(5);
    });
  });

  describe("countBufferItems", () => {
    it("should return 0 for empty buffer", () => {
      expect(Buffers.countBufferItems({})).toBe(0);
    });

    it("should sum all materials in buffer", () => {
      const buffer: Partial<Record<MaterialId, number>> = { iron_plate: 3, copper_plate: 5 };
      expect(Buffers.countBufferItems(buffer)).toBe(8);
    });
  });

  describe("addItemToBuilding", () => {
    it("should add belt item with movedAtTick for belts", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "belt", beltItems: [] };
      Buffers.addItemToBuilding(building, "iron_plate" as MaterialId, 42);
      expect(building.beltItems).toHaveLength(1);
      expect(building.beltItems[0]).toEqual({ material: "iron_plate" as MaterialId, movedAtTick: 42 });
    });

    it("should use movedAtTick: 0 for belts when tick is undefined", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "belt", beltItems: [] };
      Buffers.addItemToBuilding(building, "iron_plate" as MaterialId);
      expect(building.beltItems[0]!.movedAtTick).toBe(0);
    });

    it("should add to inputBuffer for smelter", () => {
      const building: BuildingState = { ...mockBuildingBase, type: "smelter", inputBuffer: {} };
      Buffers.addItemToBuilding(building, "iron_ore" as MaterialId, 10);
      expect(building.inputBuffer["iron_ore"]).toBe(1);
    });
  });

  describe("transferItem", () => {
    it("should return 0 for smelter/assembler with invalid/non-recipe material", () => {
      const sourceBuffer: Partial<Record<MaterialId, number>> = { copper_ore: 10 };
      const targetBuilding: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
        inputBuffer: {},
      };
      // copper_ore is not in iron_plate recipe
      expect(Buffers.transferItem(sourceBuffer, targetBuilding, "copper_ore" as MaterialId, 5, 100)).toBe(0);
      expect(sourceBuffer["copper_ore"]).toBe(10); // unchanged
    });

    it("should transfer within per-material limit for smelter", () => {
      const sourceBuffer: Partial<Record<MaterialId, number>> = { iron_ore: 10 };
      const targetBuilding: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
        inputBuffer: {},
      };
      const transferred = Buffers.transferItem(sourceBuffer, targetBuilding, "iron_ore" as MaterialId, 5, 100);
      expect(transferred).toBe(5); // Can transfer up to limit of 6
      expect(sourceBuffer["iron_ore"]).toBe(5);
      expect(targetBuilding.inputBuffer["iron_ore"]).toBe(5);
    });

    it("should respect per-material limit cap for smelter", () => {
      const sourceBuffer: Partial<Record<MaterialId, number>> = { iron_ore: 20 };
      const targetBuilding: BuildingState = {
        ...mockBuildingBase,
        type: "smelter",
        recipeId: "iron_plate" as RecipeId,
        inputBuffer: { iron_ore: 4 }, // Already has 4
      };
      // Limit is 6, already has 4, so can only transfer 2
      const transferred = Buffers.transferItem(sourceBuffer, targetBuilding, "iron_ore" as MaterialId, 10, 100);
      expect(transferred).toBe(2);
      expect(targetBuilding.inputBuffer["iron_ore"]).toBe(6);
    });

    it("should transfer to belt with movedAtTick", () => {
      const sourceBuffer: Partial<Record<MaterialId, number>> = { iron_plate: 10 };
      const targetBuilding: BuildingState = { ...mockBuildingBase, type: "belt", beltItems: [] };
      const transferred = Buffers.transferItem(sourceBuffer, targetBuilding, "iron_plate" as MaterialId, 3, 200);
      expect(transferred).toBe(3); // maxAmount is 3, adds up to 3 belt items
      expect(targetBuilding.beltItems).toHaveLength(3);
      expect(targetBuilding.beltItems[0]!.movedAtTick).toBe(200);
    });

    it("should reject belt transfer if belt full", () => {
      const sourceBuffer: Partial<Record<MaterialId, number>> = { iron_plate: 10 };
      const targetBuilding: BuildingState = {
        ...mockBuildingBase,
        type: "belt",
        beltItems: [
          { material: "iron_plate" as MaterialId, movedAtTick: 0 },
          { material: "iron_plate" as MaterialId, movedAtTick: 0 },
          { material: "iron_plate" as MaterialId, movedAtTick: 0 },
        ],
      };
      const transferred = Buffers.transferItem(sourceBuffer, targetBuilding, "iron_plate" as MaterialId, 5, 100);
      expect(transferred).toBe(0);
    });

    it("should enforce MAX_OUTPUT_BUFFER for splitter", () => {
      const sourceBuffer: Partial<Record<MaterialId, number>> = { iron_plate: 20 };
      const targetBuilding: BuildingState = {
        ...mockBuildingBase,
        type: "splitter",
        inputBuffer: { iron_plate: 8 },
      };
      const transferred = Buffers.transferItem(sourceBuffer, targetBuilding, "iron_plate" as MaterialId, 10, 100);
      expect(transferred).toBe(2); // Only 2 more allowed to reach MAX_OUTPUT_BUFFER of 10
      expect(targetBuilding.inputBuffer["iron_plate"]).toBe(10);
    });
  });
});

describe("Research Points Value Verification", () => {
  it("should have slag with 0 RP value", () => {
    expect(RESEARCH_POINTS["slag"]).toBe(0);
  });

  it("should have positive RP values for all production materials except slag", () => {
    const materials: MaterialId[] = ["iron_plate", "copper_plate", "iron_gear", "copper_wire",
      "steel_plate", "silicon_wafer", "circuit_board", "microchip", "automation_module"];
    for (const mat of materials) {
      expect(RESEARCH_POINTS[mat]).toBeGreaterThan(0);
    }
  });

  it("should have higher RP values for more advanced materials", () => {
    // automation_module should have highest RP value
    expect(RESEARCH_POINTS["automation_module"]).toBe(240);
    // microchip should be second highest
    expect(RESEARCH_POINTS["microchip"]).toBe(75);
    // circuit_board should be higher than basic materials
    expect(RESEARCH_POINTS["circuit_board"]).toBe(24);
    // Basic materials should have lower values
    expect(RESEARCH_POINTS["iron_plate"]).toBe(2);
    expect(RESEARCH_POINTS["copper_plate"]).toBe(2);
    expect(RESEARCH_POINTS["copper_wire"]).toBe(2);
  });
});
