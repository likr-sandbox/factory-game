// Unit tests for WebMCP build tool handlers
// Pure TypeScript - ZERO Phaser dependencies

import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/sim/world";
import { findResources } from "../../src/sim/query";
import { createBuildToolHandlers } from "../../src/webmcp/buildTools";

describe("createBuildToolHandlers", () => {
  it("should place a miner on a discovered resource deposit", () => {
    const world = createWorld(42);
    let mutated = false;
    
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    // Discover a real iron ore deposit (do NOT hardcode coordinates)
    const resources = findResources(world, { material: "iron_ore" });
    expect(resources.length).toBeGreaterThan(0);
    
    const deposit = resources[0]!;
    const result = handlers.place_building({
      x: deposit.x,
      y: deposit.y,
      type: "miner",
      direction: "N",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.buildingId).toBeDefined();
      expect(mutated).toBe(true);
      expect(world.tiles[deposit.y]?.[deposit.x]?.buildingId).toBe(result.buildingId);
    }
  });

  it("should place a belt line between two points", () => {
    const world = createWorld(42);
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    const result = handlers.place_belt_line({ startX: 10, startY: 10, endX: 15, endY: 10 });
    expect(result.success).toBe(true);
    expect(mutated).toBe(true);
  });

  it("should set recipe on a smelter placed on valid grass tile", () => {
    const world = createWorld(42);
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    const targetX = 50, targetY = 50;
    const placeResult = handlers.place_building({ x: targetX, y: targetY, type: "smelter", direction: "E", recipeId: "iron_plate" });
    expect(placeResult.success).toBe(true);

    mutated = false;
    const setResult = handlers.set_recipe({ x: targetX, y: targetY, recipeId: "copper_plate" });
    expect(setResult.success).toBe(true);
    expect(mutated).toBe(true);
    if (setResult.success && setResult.changes) {
      expect((setResult.changes as { recipeId?: string }).recipeId).toBe("copper_plate");
    }
  });

  it("should remove area and return buildings to inventory", () => {
    const world = createWorld(42);
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    handlers.place_building({ x: 20, y: 20, type: "belt", direction: "E" });
    handlers.place_building({ x: 21, y: 20, type: "belt", direction: "E" });
    handlers.place_building({ x: 22, y: 20, type: "belt", direction: "E" });

    const beforeCount = Object.keys(world.buildings).length;
    mutated = false;
    const result = handlers.remove_area({ x: 20, y: 20, width: 3, height: 1 });

    expect(result.success).toBe(true);
    expect(mutated).toBe(true);
    if (result.success && result.changes) {
      expect((result.changes as { removedCount: number }).removedCount).toBe(3);
    }
    expect(Object.keys(world.buildings).length).toBe(beforeCount - 3);
  });

  it("should execute batch actions atomically with rollback on failure", () => {
    const world = createWorld(42);
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    const successPlace = handlers.place_building({ x: 5, y: 5, type: "belt", direction: "E" });
    expect(successPlace.success).toBe(true);

    const beforeCount = Object.keys(world.buildings).length;
    mutated = false;

    // Batch with atomic=true where one action fails (miner on grass without deposit)
    const batchResult = handlers.batch_actions({
      actions: [
        { kind: "place_building", input: { x: 10, y: 10, type: "miner", direction: "N" } },
        { kind: "place_building", input: { x: 11, y: 11, type: "belt", direction: "E" } },
      ],
      atomic: true,
    });

    expect(batchResult.success).toBe(false);
    if (!batchResult.success) {
      expect(batchResult.error.code).toBe("BATCH_FAILED");
    }
    expect(mutated).toBe(false);
    expect(Object.keys(world.buildings).length).toBe(beforeCount);
  });

  it("should return INVALID_INPUT error for malformed input", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result1 = handlers.place_building({ x: 10 } as Record<string, unknown>);
    expect(result1.success).toBe(false);
    if (!result1.success) {
      expect(result1.error.code).toBe("INVALID_INPUT");
    }

    const result2 = handlers.place_building({ x: 10, y: 10, type: "belt", direction: "X" as any });
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe("INVALID_INPUT");
    }

    const result3 = handlers.batch_actions({} as Record<string, unknown>);
    expect(result3.success).toBe(false);
    if (!result3.success) {
      expect(result3.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should not call onWorldMutated when action fails", () => {
    const world = createWorld(42);
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    const result = handlers.place_building({ x: 10, y: 10, type: "miner", direction: "N" });
    expect(result.success).toBe(false);
    expect(mutated).toBe(false);
  });

  it("should reject placing hub building with success: false and error code, without invoking onWorldMutated", () => {
    const world = createWorld(42);
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    const result = handlers.place_building({ x: 5, y: 5, type: "hub", direction: "N" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("HUB_PROTECTED");
    }
    expect(mutated).toBe(false);
  });

  it("should successfully unlock a tech with sufficient research points", () => {
    const world = createWorld(42);
    world.researchPoints = 200; // Enough for underground_belt (cost: 80)
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    const result = handlers.unlock_tech({ techId: "underground_belt" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.changes).toBeDefined();
      expect((result.changes as { unlockedTech?: string }).unlockedTech).toBe("underground_belt");
    }
    expect(mutated).toBe(true);
    // Research points should be deducted
    expect(world.researchPoints).toBe(120); // 200 - 80
    expect(world.unlockedTechs).toContain("underground_belt");
  });

  it("should return INSUFFICIENT_POINTS error when research points are too low", () => {
    const world = createWorld(42);
    world.researchPoints = 50; // Not enough for any tech
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.unlock_tech({ techId: "underground_belt" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INSUFFICIENT_POINTS");
    }
  });

  it("should return INVALID_TECH error for unknown tech ID", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.unlock_tech({ techId: "invalid_tech" as any });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_TECH");
    }
  });

  it("should return INVALID_INPUT error for missing techId", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.unlock_tech({} as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return PREREQUISITE_NOT_MET error when prerequisites are missing", () => {
    const world = createWorld(42);
    world.researchPoints = 200; // Enough for recycler cost but missing prereqs
    const handlers = createBuildToolHandlers(() => world);

    // recycler requires filter_splitter as prerequisite
    const result = handlers.unlock_tech({ techId: "recycler" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PREREQUISITE_NOT_MET");
      expect(result.error.message).toContain("filter_splitter");
      expect((result.error.details as { techId?: string; missingPrerequisites?: string[] }).techId).toBe("recycler");
      expect((result.error.details as { techId?: string; missingPrerequisites?: string[] }).missingPrerequisites).toContain("filter_splitter");
    }
  });

  it("should succeed after unlocking prerequisites first via WebMCP handler", () => {
    const world = createWorld(42);
    world.researchPoints = 200;
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    // First unlock filter_splitter (no prerequisites)
    const prereqResult = handlers.unlock_tech({ techId: "filter_splitter" });
    expect(prereqResult.success).toBe(true);
    expect(mutated).toBe(true);
    expect(world.researchPoints).toBe(140); // 200 - 60
    
    mutated = false;
    // Now recycler should work
    const result = handlers.unlock_tech({ techId: "recycler" });
    expect(result.success).toBe(true);
    expect(mutated).toBe(true);
    if (result.success) {
      expect(result.changes).toEqual({ unlockedTech: "recycler" });
    }
    expect(world.researchPoints).toBe(40); // 140 - 100
    expect(world.unlockedTechs).toContain("recycler");
  });

  it("should return PREREQUISITE_NOT_MET for multi-level dependencies", () => {
    const world = createWorld(42);
    world.researchPoints = 1000;
    const handlers = createBuildToolHandlers(() => world);

    // automation requires electronics, which requires advanced_smelting
    const result = handlers.unlock_tech({ techId: "automation" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PREREQUISITE_NOT_MET");
      expect((result.error.details as { missingPrerequisites?: string[] }).missingPrerequisites).toContain("electronics");
    }
  });

  it("should succeed after unlocking full prerequisite chain via WebMCP handler", () => {
    const world = createWorld(42);
    world.researchPoints = 1000;
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    // Unlock advanced_smelting first (no prerequisites)
    const r1 = handlers.unlock_tech({ techId: "advanced_smelting" });
    expect(r1.success).toBe(true);
    expect(mutated).toBe(true);
    expect(world.researchPoints).toBe(850); // 1000 - 150
    
    mutated = false;
    // Then unlock electronics (requires advanced_smelting)
    const r2 = handlers.unlock_tech({ techId: "electronics" });
    expect(r2.success).toBe(true);
    expect(mutated).toBe(true);
    expect(world.researchPoints).toBe(630); // 850 - 220
    
    mutated = false;
    // Finally unlock automation (requires electronics)
    const r3 = handlers.unlock_tech({ techId: "automation" });
    expect(r3.success).toBe(true);
    expect(mutated).toBe(true);
    expect(world.researchPoints).toBe(230); // 630 - 400
    expect(world.unlockedTechs).toContain("automation");
  });

  it("should not call onWorldMutated when unlock_tech fails", () => {
    const world = createWorld(42);
    world.researchPoints = 50; // Insufficient
    let mutated = false;
    const handlers = createBuildToolHandlers(() => world, () => { mutated = true; });

    const result = handlers.unlock_tech({ techId: "underground_belt" });
    expect(result.success).toBe(false);
    expect(mutated).toBe(false);
  });

  it("should return INVALID_INPUT error for non-integer coordinates in place_building", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.place_building({ x: 10.5, y: 10, type: "belt", direction: "E" } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for non-existent building type", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.place_building({ x: 10, y: 10, type: "invalid_type" as any, direction: "N" } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for non-integer coordinates in place_belt_line", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.place_belt_line({ startX: 10.5, startY: 10, endX: 15, endY: 12 } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for invalid cornerFirst value", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.place_belt_line({ startX: 10, startY: 10, endX: 15, endY: 12, cornerFirst: "z" as any } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for non-integer coordinates in remove_area", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.remove_area({ x: 10.5, y: 10, width: 3, height: 1 } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for negative width/height in remove_area", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.remove_area({ x: 10, y: 10, width: -1, height: 1 } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for non-integer coordinates in set_recipe", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.set_recipe({ x: 10.5, y: 10, recipeId: "iron_plate" } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for invalid action kind in batch_actions", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.batch_actions({ actions: [{ kind: "invalid_kind", input: {} }] } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for non-integer coordinates in batch_actions place_building", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.batch_actions({
      actions: [{ kind: "place_building", input: { x: 10.5, y: 10, type: "belt", direction: "E" } }]
    } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("should return INVALID_INPUT error for invalid type in batch_actions place_building", () => {
    const world = createWorld(42);
    const handlers = createBuildToolHandlers(() => world);

    const result = handlers.batch_actions({
      actions: [{ kind: "place_building", input: { x: 10, y: 10, type: "invalid_type" as any, direction: "E" } }]
    } as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
