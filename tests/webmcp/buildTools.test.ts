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
});
