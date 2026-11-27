// Unit tests for Phaser config and FactoryScene texture/item sync
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class MockScene { constructor(public key: string) {} },
  AUTO: 1,
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
  it("should set correct config values", () => {
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

describe("FactoryScene basics", () => {
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
    const mockGraphics = {
      x: 0,
      y: 0,
      setDepth: vi.fn(),
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      destroy: vi.fn(),
    };
    scene.add = {
      sprite: vi.fn((_: number, __: number, texture: string) => {
        spriteCalls.push({ texture });
        return { setDepth: vi.fn(), setName: vi.fn(), destroy: vi.fn() };
      }),
      image: vi.fn(() => ({ destroy: vi.fn() })),
      graphics: vi.fn(() => mockGraphics),
    } as unknown as typeof scene.add;
    scene.children = { list: [] } as unknown as typeof scene.children;

    scene.syncWorld({
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
    });

    expect(spriteCalls[0]?.texture).toBe("belt_E_0_ok");
    expect(spriteCalls[1]?.texture).toBe("miner_N_0_faulted");
  });

  it("should reset itemIndex inside per-building loop and clean up on resync", () => {
    const scene = new FactoryScene();
    const setNameCalls: string[] = [];
    const destroyCount = { value: 0 };
    
    const mockGraphics = {
      x: 0,
      y: 0,
      setDepth: vi.fn(),
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      destroy: vi.fn(),
    };
    scene.add = {
      sprite: vi.fn(() => ({
        setDepth: vi.fn(),
        setName: (n: string) => { setNameCalls.push(n); },
        destroy: vi.fn(() => { destroyCount.value++; }),
      })),
      image: vi.fn(() => ({ destroy: vi.fn() })),
      graphics: vi.fn(() => mockGraphics),
    } as unknown as typeof scene.add;
    scene.children = { list: [] } as unknown as typeof scene.children;

    const worldWithItems: WorldState = {
      seed: 1, width: 64, height: 64, tick: 0, rngState: 1, tiles: [],
      buildings: {
        b1: { id: "b1", type: "belt", x: 10, y: 10, direction: "E",
              inputBuffer: {}, outputBuffer: {},
              beltItems: [{ material: "iron_ore", movedAtTick: 0 }] as BeltItem[],
              craftProgress: 0, roundRobinIndex: 0, faulted: false, load: 0, idleTicks: 0, blockedTicks: 0 } as BuildingState,
        b2: { id: "b2", type: "belt", x: 20, y: 20, direction: "E",
              inputBuffer: {}, outputBuffer: {},
              beltItems: [{ material: "iron_plate", movedAtTick: 0 }, { material: "copper_plate", movedAtTick: 0 }] as BeltItem[],
              craftProgress: 0, roundRobinIndex: 0, faulted: false, load: 0, idleTicks: 0, blockedTicks: 0 } as BuildingState,
      },
      nextBuildingId: 3, hubOrigin: { x: 31, y: 31 }, delivered: {}, deliveryHistory: [],
      unlockedTechs: [], completedQuests: [],
    };

    scene.syncWorld(worldWithItems);
    const itemNames = setNameCalls.filter((n) => n.includes("item_"));
    expect(itemNames).toEqual(expect.arrayContaining(["b1_item_0", "b2_item_0", "b2_item_1"]));

    scene.syncWorld({ ...worldWithItems, buildings: {} });
    expect(destroyCount.value).toBeGreaterThan(0);
  });
});

describe("FactoryScene.renderTerrainTilemap", () => {
  it("should render terrain and ore deposits from world.tiles using correct texture keys", () => {
    const scene = new FactoryScene();
    const imagesCreated: string[] = [];
    const spritesCreated: string[] = [];
    const setDepthCalls: number[] = [];

    const mockGraphics = {
      x: 0,
      y: 0,
      setDepth: vi.fn(),
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      destroy: vi.fn(),
    };
    scene.add = {
      image: vi.fn((_: number, __: number, texture: string) => {
        imagesCreated.push(texture);
        return { destroy: vi.fn() };
      }),
      sprite: vi.fn((_: number, __: number, texture: string) => {
        spritesCreated.push(texture);
        return { setDepth: vi.fn((d: number) => { setDepthCalls.push(d); }), destroy: vi.fn() };
      }),
      graphics: vi.fn(() => mockGraphics),
    } as unknown as typeof scene.add;
    scene.children = { list: [] } as unknown as typeof scene.children;

    scene.setContext({
      seed: 1, width: 4, height: 4, tick: 0, rngState: 1,
      tiles: [
        [{ x: 0, y: 0, terrain: "grass", deposit: null, buildingId: null },
         { x: 1, y: 0, terrain: "rock", deposit: null, buildingId: null },
         { x: 2, y: 0, terrain: "grass", deposit: { material: "iron_ore", remaining: 1000, initialAmount: 1000 }, buildingId: null },
         { x: 3, y: 0, terrain: "water", deposit: null, buildingId: null }],
        [{ x: 0, y: 1, terrain: "grass", deposit: { material: "coal", remaining: 800, initialAmount: 800 }, buildingId: null },
         { x: 1, y: 1, terrain: "rock", deposit: null, buildingId: null },
         { x: 2, y: 1, terrain: "grass", deposit: null, buildingId: null },
         { x: 3, y: 1, terrain: "grass", deposit: { material: "copper_ore", remaining: 1200, initialAmount: 1200 }, buildingId: null }],
        [{ x: 0, y: 2, terrain: "grass", deposit: null, buildingId: null }, { x: 1, y: 2, terrain: "grass", deposit: null, buildingId: null }, { x: 2, y: 2, terrain: "grass", deposit: null, buildingId: null }, { x: 3, y: 2, terrain: "grass", deposit: null, buildingId: null }],
        [{ x: 0, y: 3, terrain: "grass", deposit: null, buildingId: null }, { x: 1, y: 3, terrain: "grass", deposit: null, buildingId: null }, { x: 2, y: 3, terrain: "grass", deposit: null, buildingId: null }, { x: 3, y: 3, terrain: "grass", deposit: null, buildingId: null }],
      ],
      buildings: {}, nextBuildingId: 1, hubOrigin: { x: 31, y: 31 },
      delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [],
    }, createInputState());
    scene.renderTerrainTilemap();

    expect(imagesCreated).toEqual(expect.arrayContaining(["terrain:grass:seed:0", "terrain:rock:seed:0", "terrain:water:seed:0"]));
    expect(spritesCreated).toEqual(expect.arrayContaining(["deposit:iron_ore:seed:0", "deposit:coal:seed:0", "deposit:copper_ore:seed:0"]));
    expect(setDepthCalls.filter((d) => d === 0.5).length).toBe(3);
  });

  it("should fallback to grass-only grid when world is not bound", () => {
    const scene = new FactoryScene();
    const imagesCreated: string[] = [];
    const mockGraphics = {
      x: 0,
      y: 0,
      setDepth: vi.fn(),
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      destroy: vi.fn(),
    };
    scene.add = {
      image: vi.fn((_: number, __: number, texture: string) => { imagesCreated.push(texture); return { destroy: vi.fn() }; }),
      sprite: vi.fn(() => ({ setDepth: vi.fn(), destroy: vi.fn() })),
      graphics: vi.fn(() => mockGraphics),
    } as unknown as typeof scene.add;
    scene.children = { list: [] } as unknown as typeof scene.children;
    scene.renderTerrainTilemap();
    expect(imagesCreated.every((t) => t === "terrain:grass:seed:0")).toBe(true);
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
    scene.setContext(world, createInputState());
    expect(() => scene.syncWorld(world)).not.toThrow();
  });
});
