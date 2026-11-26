// Tests for FactoryScene syncWorld overlay rendering
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Scene } from "phaser";
import type { WorldState, BuildingState, ResourceDeposit } from "../../src/sim/types";
import { FactoryScene } from "../../src/game/FactoryScene";

// Mock Phaser GameObjects
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

const mockSprite = {
  setDepth: vi.fn(),
  setName: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("phaser", () => ({
  Scene: class MockScene {
    cameras = { main: { setBounds: vi.fn(), setZoom: vi.fn(), scrollX: 0, scrollY: 0, zoom: 1 } };
    input = {
      on: vi.fn(),
      keyboard: {
        createCursorKeys: vi.fn().mockReturnValue({ left: null, right: null, up: null, down: null }),
        addKey: vi.fn().mockReturnValue({ isDown: false }),
        on: vi.fn(),
      },
    };
    textures = {
      createCanvas: vi.fn(),
    };
    add = {
      sprite: vi.fn().mockReturnValue(mockSprite),
      image: vi.fn(),
      graphics: vi.fn().mockReturnValue(mockGraphics),
    };
    events = {
      on: vi.fn(),
      emit: vi.fn(),
    };

    constructor(name: string) {
      // Mock constructor
    }
  },
}));

function createMockWorld(overrides?: Partial<WorldState>): WorldState {
  return {
    seed: 12345,
    width: 10,
    height: 10,
    tick: 0,
    rngState: 42,
    tiles: Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => ({
        x,
        y,
        terrain: "grass" as const,
        deposit: null as ResourceDeposit | null,
        buildingId: null as string | null,
      }))
    ),
    buildings: {},
    nextBuildingId: 1,
    hubOrigin: { x: 0, y: 0 },
    delivered: {},
    deliveryHistory: [],
    unlockedTechs: [],
    completedQuests: [],
    ...overrides,
  };
}

function createMockBuilding(overrides?: Partial<BuildingState>): BuildingState {
  return {
    id: "building_1",
    type: "belt" as const,
    x: 5,
    y: 5,
    direction: "N" as const,
    inputBuffer: {},
    outputBuffer: {},
    beltItems: [],
    craftProgress: 0,
    roundRobinIndex: 0,
    faulted: false,
    load: 0,
    idleTicks: 0,
    blockedTicks: 0,
    ...overrides,
  };
}

describe("FactoryScene syncWorld overlays", () => {
  let scene: FactoryScene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new FactoryScene();
  });

  describe("faulted building overlays", () => {
    it("should render a fault warning overlay for faulted buildings", () => {
      const world = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ faulted: true, x: 5, y: 5 }),
        },
      });

      scene.syncWorld(world);

      // Should have created a fault overlay
      expect(scene["faultOverlays"].size).toBe(1);
      expect(scene["faultOverlays"].has("building_1")).toBe(true);

      // Verify graphics methods were called for warning indicator
      expect(mockGraphics.fillStyle).toHaveBeenCalled();
      expect(mockGraphics.fillRect).toHaveBeenCalled();
      expect(mockGraphics.fillCircle).toHaveBeenCalled();
    });

    it("should NOT render fault overlay for non-faulted buildings", () => {
      const world = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ faulted: false, x: 5, y: 5 }),
        },
      });

      scene.syncWorld(world);

      expect(scene["faultOverlays"].size).toBe(0);
    });

    it("should destroy old fault overlays on sync", () => {
      const world1 = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ faulted: true, x: 5, y: 5 }),
        },
      });

      scene.syncWorld(world1);
      expect(scene["faultOverlays"].size).toBe(1);

      // First destroy should be called
      expect(mockGraphics.destroy).not.toHaveBeenCalled();

      const world2 = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ faulted: false, x: 5, y: 5 }),
        },
      });

      scene.syncWorld(world2);
      
      // Old overlay should be destroyed
      expect(mockGraphics.destroy).toHaveBeenCalledTimes(1);
      expect(scene["faultOverlays"].size).toBe(0);
    });

    it("should handle multiple faulted buildings", () => {
      const world = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ faulted: true, x: 5, y: 5, id: "building_1" }),
          building_2: createMockBuilding({ faulted: true, x: 10, y: 10, id: "building_2" }),
          building_3: createMockBuilding({ faulted: false, x: 15, y: 15, id: "building_3" }),
        },
      });

      scene.syncWorld(world);

      expect(scene["faultOverlays"].size).toBe(2);
      expect(scene["faultOverlays"].has("building_1")).toBe(true);
      expect(scene["faultOverlays"].has("building_2")).toBe(true);
      expect(scene["faultOverlays"].has("building_3")).toBe(false);
    });
  });

  describe("depleted deposit overlays", () => {
    it("should render a depleted indicator for exhausted deposits", () => {
      const world = createMockWorld({
        tiles: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({
            x,
            y,
            terrain: "grass" as const,
            deposit: x === 5 && y === 5 
              ? ({ material: "iron_ore" as const, remaining: 0, initialAmount: 1000 })
              : null,
            buildingId: null,
          }))
        ),
      });

      scene.syncWorld(world);

      // Should have created a depleted overlay
      expect(scene["depletedOverlays"].size).toBe(1);
      expect(scene["depletedOverlays"].has("depleted_5_5")).toBe(true);

      // Verify graphics methods were called for X indicator
      expect(mockGraphics.lineStyle).toHaveBeenCalled();
      expect(mockGraphics.beginPath).toHaveBeenCalled();
      expect(mockGraphics.moveTo).toHaveBeenCalled();
      expect(mockGraphics.lineTo).toHaveBeenCalled();
      expect(mockGraphics.strokePath).toHaveBeenCalled();
    });

    it("should NOT render depleted overlay for deposits with remaining > 0", () => {
      const world = createMockWorld({
        tiles: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({
            x,
            y,
            terrain: "grass" as const,
            deposit: x === 5 && y === 5 
              ? ({ material: "iron_ore" as const, remaining: 100, initialAmount: 1000 })
              : null,
            buildingId: null,
          }))
        ),
      });

      scene.syncWorld(world);

      expect(scene["depletedOverlays"].size).toBe(0);
    });

    it("should destroy old depleted overlays on sync", () => {
      const world1 = createMockWorld({
        tiles: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({
            x,
            y,
            terrain: "grass" as const,
            deposit: x === 5 && y === 5 
              ? ({ material: "iron_ore" as const, remaining: 0, initialAmount: 1000 })
              : null,
            buildingId: null,
          }))
        ),
      });

      scene.syncWorld(world1);
      expect(scene["depletedOverlays"].size).toBe(1);

      const world2 = createMockWorld({
        tiles: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({
            x,
            y,
            terrain: "grass" as const,
            deposit: x === 5 && y === 5 
              ? ({ material: "iron_ore" as const, remaining: 100, initialAmount: 1000 })
              : null,
            buildingId: null,
          }))
        ),
      });

      scene.syncWorld(world2);
      
      // Old overlay should be destroyed
      expect(mockGraphics.destroy).toHaveBeenCalledTimes(1);
      expect(scene["depletedOverlays"].size).toBe(0);
    });

    it("should handle multiple depleted deposits", () => {
      const tiles = Array.from({ length: 10 }, (_, y) =>
        Array.from({ length: 10 }, (_, x) => ({
          x,
          y,
          terrain: "grass" as const,
          deposit: (x === 5 && y === 5) || (x === 8 && y === 8)
            ? ({ material: "iron_ore" as const, remaining: 0, initialAmount: 1000 })
            : null,
          buildingId: null,
        }))
      );

      const world = createMockWorld({ tiles });

      scene.syncWorld(world);

      expect(scene["depletedOverlays"].size).toBe(2);
      expect(scene["depletedOverlays"].has("depleted_5_5")).toBe(true);
      expect(scene["depletedOverlays"].has("depleted_8_8")).toBe(true);
    });

    it("should not render depleted overlay for tiles without deposits", () => {
      const world = createMockWorld({
        tiles: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({
            x,
            y,
            terrain: "grass" as const,
            deposit: null,
            buildingId: null,
          }))
        ),
      });

      scene.syncWorld(world);

      expect(scene["depletedOverlays"].size).toBe(0);
    });
  });

  describe("overlay cleanup", () => {
    it("should clean up all overlays when world has no faults or depleted deposits", () => {
      const world1 = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ faulted: true, x: 5, y: 5 }),
        },
        tiles: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({
            x,
            y,
            terrain: "grass" as const,
            deposit: x === 3 && y === 3 
              ? ({ material: "copper_ore" as const, remaining: 0, initialAmount: 500 })
              : null,
            buildingId: null,
          }))
        ),
      });

      scene.syncWorld(world1);
      expect(scene["faultOverlays"].size).toBe(1);
      expect(scene["depletedOverlays"].size).toBe(1);

      const world2 = createMockWorld({
        buildings: {},
        tiles: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => ({
            x,
            y,
            terrain: "grass" as const,
            deposit: null,
            buildingId: null,
          }))
        ),
      });

      scene.syncWorld(world2);

      expect(scene["faultOverlays"].size).toBe(0);
      expect(scene["depletedOverlays"].size).toBe(0);
    });
  });
});
