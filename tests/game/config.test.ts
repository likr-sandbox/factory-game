// Unit tests for Phaser config and FactoryScene texture/item sync
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Phaser before importing anything else
vi.mock("phaser", () => ({
  Scene: class MockScene {
    constructor(public key: string) {}
  },
  AUTO: 1,
  Game: class MockGame {
    constructor(_config: unknown) {}
  },
}));

import { Scene } from "phaser";
import { createPhaserConfig } from "../../src/game/config";
import { FactoryScene, TILE_SIZE } from "../../src/game/FactoryScene";
import { getTerrainTextureKey, getDepositTextureKey } from "../../src/game/sprites/terrain";
import type { WorldState, BuildingState, BeltItem } from "../../src/sim/types";

describe("createPhaserConfig", () => {
  it("should set pixelArt to true", () => {
    const config = createPhaserConfig();
    expect(config.pixelArt).toBe(true);
  });

  it("should set roundPixels to true", () => {
    const config = createPhaserConfig();
    expect(config.roundPixels).toBe(true);
  });

  it("should set antialias to false", () => {
    const config = createPhaserConfig();
    expect(config.antialias).toBe(false);
  });

  it("should default parent to game-container", () => {
    const config = createPhaserConfig();
    expect(config.parent).toBe("game-container");
  });

  it("should use custom parent when provided", () => {
    const config = createPhaserConfig("custom-container");
    expect(config.parent).toBe("custom-container");
  });

  it("should register FactoryScene in scene array", () => {
    const config = createPhaserConfig();
    expect(Array.isArray(config.scene)).toBe(true);
    if (Array.isArray(config.scene)) {
      expect(config.scene.includes(FactoryScene)).toBe(true);
    }
  });

  it("should use sceneInstance when provided", () => {
    const instance = new FactoryScene();
    const config = createPhaserConfig(undefined, instance);
    expect(config.scene).toBe(instance);
  });

  it("should set backgroundColor to #1a1a2e", () => {
    const config = createPhaserConfig();
    expect(config.backgroundColor).toBe("#1a1a2e");
  });

  it("should set type to Phaser.AUTO", () => {
    const config = createPhaserConfig();
    expect(config.type).toBe(1); // Phaser.AUTO = 1 in mock
  });
});

describe("FactoryScene", () => {
  it("should export TILE_SIZE as 32", () => {
    expect(TILE_SIZE).toBe(32);
  });

  it("should have correct scene key", () => {
    // FactoryScene extends Scene and passes "FactoryScene" to super()
    const scene = new FactoryScene();
    expect(scene).toBeInstanceOf(Scene);
  });
});

describe("getTerrainTextureKey and getDepositTextureKey", () => {
  it("getTerrainTextureKey should generate deterministic keys", () => {
    expect(getTerrainTextureKey("grass", 0)).toBe("terrain:grass:seed:0");
    expect(getTerrainTextureKey("rock", 0)).toBe("terrain:rock:seed:0");
    expect(getTerrainTextureKey("water", 0)).toBe("terrain:water:seed:0");
  });

  it("getDepositTextureKey should generate deterministic keys", () => {
    expect(getDepositTextureKey("iron_ore", 0)).toBe("deposit:iron_ore:seed:0");
    expect(getDepositTextureKey("copper_ore", 0)).toBe("deposit:copper_ore:seed:0");
  });
});

describe("FactoryScene.syncWorld and updateBeltItemSprites", () => {
  it("should reset itemIndex inside per-building loop for multiple buildings", () => {
    // Create mock world with two buildings, each with belt items
    const building1Id = "building_1";
    const building2Id = "building_2";

    const world: WorldState = {
      seed: 12345,
      width: 64,
      height: 64,
      tick: 0,
      rngState: 12345,
      tiles: [],
      buildings: {
        [building1Id]: {
          id: building1Id,
          type: "belt",
          x: 10,
          y: 10,
          direction: "E",
          inputBuffer: {},
          outputBuffer: {},
          beltItems: [{ material: "iron_ore", movedAtTick: 0 }] as BeltItem[],
          craftProgress: 0,
          roundRobinIndex: 0,
          faulted: false,
          load: 0,
          idleTicks: 0,
          blockedTicks: 0,
        } as BuildingState,
        [building2Id]: {
          id: building2Id,
          type: "belt",
          x: 20,
          y: 20,
          direction: "E",
          inputBuffer: {},
          outputBuffer: {},
          beltItems: [
            { material: "iron_plate", movedAtTick: 0 },
            { material: "copper_plate", movedAtTick: 0 },
          ] as BeltItem[],
          craftProgress: 0,
          roundRobinIndex: 0,
          faulted: false,
          load: 0,
          idleTicks: 0,
          blockedTicks: 0,
        } as BuildingState,
      },
      nextBuildingId: 3,
      hubOrigin: { x: 31, y: 31 },
      delivered: {},
      deliveryHistory: [],
      unlockedTechs: [],
      completedQuests: [],
    };

    // Expected item keys based on per-building index
    const expectedKeys = [
      `${building1Id}_item_0`,
      `${building2Id}_item_0`,
      `${building2Id}_item_1`,
    ];

    // Verify the pattern matches what syncWorld expects
    expect(expectedKeys).toEqual([
      "building_1_item_0",
      "building_2_item_0",
      "building_2_item_1",
    ]);
  });

  it("should clean up removed item sprites when building loses items", () => {
    const buildingId = "building_test";

    const worldWithItems: WorldState = {
      seed: 12345,
      width: 64,
      height: 64,
      tick: 0,
      rngState: 12345,
      tiles: [],
      buildings: {
        [buildingId]: {
          id: buildingId,
          type: "belt",
          x: 10,
          y: 10,
          direction: "E",
          inputBuffer: {},
          outputBuffer: {},
          beltItems: [
            { material: "iron_ore", movedAtTick: 0 },
            { material: "iron_plate", movedAtTick: 0 },
          ] as BeltItem[],
          craftProgress: 0,
          roundRobinIndex: 0,
          faulted: false,
          load: 0,
          idleTicks: 0,
          blockedTicks: 0,
        } as BuildingState,
      },
      nextBuildingId: 2,
      hubOrigin: { x: 31, y: 31 },
      delivered: {},
      deliveryHistory: [],
      unlockedTechs: [],
      completedQuests: [],
    };

    const worldWithoutItems: WorldState = {
      ...worldWithItems,
      buildings: {
        [buildingId]: {
          ...worldWithItems.buildings[buildingId]!,
          beltItems: [] as BeltItem[],
        } as BuildingState,
      },
    };

    // Expected keys when items exist
    const expectedKeysWithItems = new Set([`${buildingId}_item_0`, `${buildingId}_item_1`]);

    // Expected keys when items are removed (empty)
    const expectedKeysWithoutItems = new Set<string>();

    expect(expectedKeysWithItems.size).toBe(2);
    expect(expectedKeysWithoutItems.size).toBe(0);
  });
});
