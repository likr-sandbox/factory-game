// Unit tests for Phaser config and FactoryScene texture/item sync
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class MockScene { constructor(public key: string) {} },
  AUTO: 1,
  GameObjects: { Sprite: class {} },
}));

import { Scene } from "phaser";
import { createPhaserConfig } from "../../src/game/config";
import { FactoryScene, TILE_SIZE } from "../../src/game/FactoryScene";
import { getTerrainTextureKey, getDepositTextureKey } from "../../src/game/sprites/terrain";
import { getBuildingTextureKey } from "../../src/game/sprites/buildings";
import { getItemTextureKey } from "../../src/game/sprites/items";
import type { WorldState, BuildingState, BeltItem } from "../../src/sim/types";
import { createInputState } from "../../src/game/input";

describe("createPhaserConfig", () => {
  it("should set pixelArt, roundPixels, antialias, parent correctly", () => {
    const config = createPhaserConfig();
    expect(config.pixelArt).toBe(true);
    expect(config.roundPixels).toBe(true);
    expect(config.antialias).toBe(false);
    expect(config.parent).toBe("game-container");
    expect(config.backgroundColor).toBe("#1a1a2e");
    expect(config.type).toBe(1);
  });

  it("should register FactoryScene in scene array", () => {
    const config = createPhaserConfig();
    expect(Array.isArray(config.scene)).toBe(true);
    if (Array.isArray(config.scene)) {
      expect(config.scene.includes(FactoryScene)).toBe(true);
    }
  });

  it("should use custom parent and sceneInstance when provided", () => {
    const instance = new FactoryScene();
    const config = createPhaserConfig("custom", instance);
    expect(config.parent).toBe("custom");
    expect(config.scene).toBe(instance);
  });
});

describe("FactoryScene", () => {
  it("should export TILE_SIZE=32 and have setContext method", () => {
    expect(TILE_SIZE).toBe(32);
    const scene = new FactoryScene();
    expect(scene).toBeInstanceOf(Scene);
    expect(typeof scene.setContext).toBe("function");
  });
});

describe("Texture key helpers", () => {
  it("getTerrainTextureKey/getDepositTextureKey should generate deterministic keys", () => {
    expect(getTerrainTextureKey("grass", 0)).toBe("terrain:grass:seed:0");
    expect(getDepositTextureKey("iron_ore", 0)).toBe("deposit:iron_ore:seed:0");
  });

  it("getBuildingTextureKey/getItemTextureKey should generate correct format", () => {
    expect(getBuildingTextureKey("belt", "E", 0)).toBe("belt_E_0");
    expect(getItemTextureKey("iron_ore")).toBe("item_iron_ore");
  });
});

describe("FactoryScene.syncWorld sprite tracking", () => {
  it("should create building sprites with correct texture keys including faulted state", () => {
    const scene = new FactoryScene();
    const spriteCalls: Array<{ texture: string }> = [];
    scene.add = {
      sprite: vi.fn((_: number, __: number, texture: string) => {
        spriteCalls.push({ texture });
        return { setDepth: vi.fn(), setName: vi.fn(), destroy: vi.fn() };
      }),
      image: vi.fn(() => ({ destroy: vi.fn() })),
    } as unknown as typeof scene.add;
    scene.children = { list: [] } as unknown as typeof scene.children;

    const world: WorldState = {
      seed: 1, width: 64, height: 64, tick: 0, rngState: 1, tiles: [],
      buildings: {
        b1: { id: "b1", type: "belt", x: 10, y: 10, direction: "E",
              inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0,
              roundRobinIndex: 0, faulted: false, load: 0, idleTicks: 0, blockedTicks: 0 } as BuildingState,
        b2: { id: "b2", type: "miner", x: 5, y: 5, direction: "N",
              inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0,
              roundRobinIndex: 0, faulted: true, load: 0, idleTicks: 0, blockedTicks: 0 } as BuildingState,
      },
      nextBuildingId: 3, hubOrigin: { x: 31, y: 31 }, delivered: {}, deliveryHistory: [],
      unlockedTechs: [], completedQuests: [],
    };

    scene.syncWorld(world);
    expect(spriteCalls[0]?.texture).toBe("belt_E_0_ok");
    expect(spriteCalls[1]?.texture).toBe("miner_N_0_faulted");
  });

  it("should reset itemIndex inside per-building loop and clean up on resync", () => {
    const scene = new FactoryScene();
    const setNameCalls: string[] = [];
    const destroyCalls: unknown[] = [];
    
    scene.add = {
      sprite: vi.fn((_: number, __: number, texture: string) => ({
        setDepth: vi.fn(),
        setName: (n: string) => { setNameCalls.push(n); },
        destroy: vi.fn(() => { destroyCalls.push(texture); }),
      })),
      image: vi.fn(() => ({ destroy: vi.fn() })),
    } as unknown as typeof scene.add;
    scene.children = { list: [] } as unknown as typeof scene.children;

    const worldWithItems: WorldState = {
      seed: 1, width: 64, height: 64, tick: 0, rngState: 1, tiles: [],
      buildings: {
        b1: { id: "b1", type: "belt", x: 10, y: 10, direction: "E",
              inputBuffer: {}, outputBuffer: {},
              beltItems: [{ material: "iron_ore", movedAtTick: 0 }] as BeltItem[],
              craftProgress: 0, roundRobinIndex: 0, faulted: false,
              load: 0, idleTicks: 0, blockedTicks: 0 } as BuildingState,
        b2: { id: "b2", type: "belt", x: 20, y: 20, direction: "E",
              inputBuffer: {}, outputBuffer: {},
              beltItems: [{ material: "iron_plate", movedAtTick: 0 }, { material: "copper_plate", movedAtTick: 0 }] as BeltItem[],
              craftProgress: 0, roundRobinIndex: 0, faulted: false,
              load: 0, idleTicks: 0, blockedTicks: 0 } as BuildingState,
      },
      nextBuildingId: 3, hubOrigin: { x: 31, y: 31 }, delivered: {}, deliveryHistory: [],
      unlockedTechs: [], completedQuests: [],
    };

    scene.syncWorld(worldWithItems);
    const itemNames = setNameCalls.filter((n) => n.includes("item_"));
    expect(itemNames).toContain("b1_item_0");
    expect(itemNames).toContain("b2_item_0");
    expect(itemNames).toContain("b2_item_1");

    // Resync without items - should destroy all sprites
    const worldNoItems: WorldState = { ...worldWithItems, buildings: {} };
    scene.syncWorld(worldNoItems);
    expect(destroyCalls.length).toBeGreaterThan(0); // Sprites were destroyed
  });
});

describe("FactoryScene.setContext integration", () => {
  it("should bind world and input state via setContext", () => {
    const scene = new FactoryScene();
    const world: WorldState = {
      seed: 1, width: 64, height: 64, tick: 0, rngState: 1, tiles: [],
      buildings: {}, nextBuildingId: 1, hubOrigin: { x: 31, y: 31 },
      delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [],
    };
    const inputState = createInputState();
    scene.setContext(world, inputState);
    expect(() => scene.syncWorld(world)).not.toThrow();
  });
});
