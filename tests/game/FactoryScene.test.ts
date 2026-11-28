// Tests for FactoryScene syncWorld overlay rendering
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorldState, BuildingState, ResourceDeposit, BuildingType, Direction } from "../../src/sim/types";
import { FactoryScene } from "../../src/game/FactoryScene";
import { PlacementGhost } from "../../src/game/overlays";
import { Scene } from "phaser";

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
  clear: vi.fn(),
  setVisible: vi.fn(),
  destroy: vi.fn(),
};

const mockSprite = {
  setDepth: vi.fn(),
  setName: vi.fn(),
  destroy: vi.fn(),
  setDisplaySize: vi.fn(),
  setAlpha: vi.fn(),
  setPosition: vi.fn(),
  setVisible: vi.fn(),
  setTexture: vi.fn(),
};

vi.mock("phaser", () => {
  const MockScene = class {
    cameras = { 
      main: { 
        setBounds: vi.fn(), 
        setZoom: vi.fn(), 
        scrollX: 0, 
        scrollY: 0, 
        zoom: 1,
        centerOn: vi.fn(),
      } 
    };
    input = {
      on: vi.fn(),
      keyboard: {
        createCursorKeys: vi.fn().mockReturnValue({ left: null, right: null, up: null, down: null }),
        addKey: vi.fn().mockReturnValue({ isDown: false }),
        on: vi.fn(),
      },
    };
    textures = {
      createCanvas: vi.fn().mockReturnValue({
        getContext: vi.fn().mockReturnValue({
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 1,
          font: "",
          fillRect: vi.fn(),
          fillCircle: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          closePath: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          arc: vi.fn(),
          rect: vi.fn(),
          quadraticCurveTo: vi.fn(),
          bezierCurveTo: vi.fn(),
          ellipse: vi.fn(),
          strokeRect: vi.fn(),
          fillText: vi.fn(),
          clearRect: vi.fn(),
          measureText: vi.fn().mockReturnValue({ width: 0 }),
        }),
        refresh: vi.fn(),
      }),
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
  };

  const PhaserMock = {
    Scene: MockScene,
    GameObjects: {},
    Input: {
      Keyboard: {
        KeyCodes: {
          W: "W",
          A: "A",
          S: "S",
          D: "D",
        },
      },
    },
    AUTO: "auto",
  };

  // Export both named and default exports, including Phaser namespace
  return {
    ...PhaserMock,
    Scene: MockScene,
    default: PhaserMock,
    Phaser: PhaserMock, // Export Phaser as named export for namespace access
  };
});

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

describe("FactoryScene", () => {
  let scene: FactoryScene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new FactoryScene();
  });

  describe("centerCameraOnHub", () => {
    it("should call camera.centerOn with hub center position", () => {
      const world = createMockWorld({ hubOrigin: { x: 31, y: 31 } });
      scene.setContext(world, {
        mode: "place",
        selectedBuilding: null,
        direction: "N",
        selectedRecipe: null,
        selectedFilter: null,
        inspectedCoord: null,
        isDraggingBelt: false,
        dragStartX: null,
        dragStartY: null,
      });

      scene.centerCameraOnHub();

      // Should call centerOn with (32 * 32, 32 * 32) = (1024, 1024)
      expect(scene.cameras.main.centerOn).toHaveBeenCalledWith(1024, 1024);
    });

    it("should use custom hubOrigin position", () => {
      const world = createMockWorld({ hubOrigin: { x: 20, y: 20 } });
      scene.setContext(world, {
        mode: "place",
        selectedBuilding: null,
        direction: "N",
        selectedRecipe: null,
        selectedFilter: null,
        inspectedCoord: null,
        isDraggingBelt: false,
        dragStartX: null,
        dragStartY: null,
      });

      scene.centerCameraOnHub();

      // Should call centerOn with (21 * 32, 21 * 32) = (672, 672)
      expect(scene.cameras.main.centerOn).toHaveBeenCalledWith(672, 672);
    });

    it("should handle undefined world gracefully", () => {
      scene.centerCameraOnHub();
      // Should use default hubOrigin { x: 31, y: 31 }
      expect(scene.cameras.main.centerOn).toHaveBeenCalledWith(1024, 1024);
    });
  });

  describe("isInputFocused", () => {
    it("should return true when INPUT element is focused", () => {
      const mockInputElement = { tagName: "INPUT" };
      const originalDocument = globalThis.document;
      globalThis.document = { activeElement: mockInputElement as unknown as Element } as unknown as Document;
      
      expect((scene as any).isInputFocused()).toBe(true);
      
      globalThis.document = originalDocument;
    });

    it("should return true when TEXTAREA element is focused", () => {
      const mockTextareaElement = { tagName: "TEXTAREA" };
      const originalDocument = globalThis.document;
      globalThis.document = { activeElement: mockTextareaElement as unknown as Element } as unknown as Document;
      
      expect((scene as any).isInputFocused()).toBe(true);
      
      globalThis.document = originalDocument;
    });

    it("should return true when SELECT element is focused", () => {
      const mockSelectElement = { tagName: "SELECT" };
      const originalDocument = globalThis.document;
      globalThis.document = { activeElement: mockSelectElement as unknown as Element } as unknown as Document;
      
      expect((scene as any).isInputFocused()).toBe(true);
      
      globalThis.document = originalDocument;
    });

    it("should return false when DIV element is focused", () => {
      const mockDivElement = { tagName: "DIV" };
      const originalDocument = globalThis.document;
      globalThis.document = { activeElement: mockDivElement as unknown as Element } as unknown as Document;
      
      expect((scene as any).isInputFocused()).toBe(false);
      
      globalThis.document = originalDocument;
    });

    it("should return false when no element is focused", () => {
      const originalDocument = globalThis.document;
      globalThis.document = { activeElement: null } as unknown as Document;
      
      expect((scene as any).isInputFocused()).toBe(false);
      
      globalThis.document = originalDocument;
    });
  });

  describe("startup crash fix (syncWorld before create)", () => {
    it("should NOT throw when syncWorld is called before create() (this.add is undefined)", () => {
      // This simulates the bug where requestAnimationFrame calls syncWorld before Phaser boots create()
      const world = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ faulted: true, x: 5, y: 5 }),
        },
      });

      // Explicitly set add to undefined to test the guard branch
      (scene as unknown as { add: unknown }).add = undefined;
      
      // Should not throw - early return when this.add is undefined
      expect(() => scene.syncWorld(world)).not.toThrow();
      expect(scene["buildingSprites"].size).toBe(0);
    });

    it("should handle empty world without errors", () => {
      const world = createMockWorld({ buildings: {} });
      scene.syncWorld(world);
      // Should complete without errors
      expect(scene["buildingSprites"].size).toBe(0);
    });

    it("should handle building removal on sync", () => {
      const world1 = createMockWorld({
        buildings: {
          building_1: createMockBuilding({ id: "building_1", x: 5, y: 5 }),
        },
      });
      scene.syncWorld(world1);
      expect(scene["buildingSprites"].size).toBe(1);

      const world2 = createMockWorld({ buildings: {} });
      scene.syncWorld(world2);
      expect(scene["buildingSprites"].size).toBe(0);
    });
  });

  describe("camera centering and hub rendering", () => {
    it("should center camera on hub origin (1024, 1024) for hubOrigin (31, 31)", () => {
      const world = createMockWorld({ hubOrigin: { x: 31, y: 31 } });
      scene.setContext(world, {
        mode: "place",
        selectedBuilding: null,
        direction: "N",
        selectedRecipe: null,
        selectedFilter: null,
        inspectedCoord: null,
        isDraggingBelt: false,
        dragStartX: null,
        dragStartY: null,
      });

      // Call create() which will set up camera controls
      scene.create();

      // Verify camera.centerOn was called with (32 * 32, 32 * 32) = (1024, 1024)
      expect(scene.cameras.main.centerOn).toHaveBeenCalledWith(1024, 1024);
    });

    it("should render hub sprite centered at (32 * 32, 32 * 32) with display size 64x64", () => {
      const world = createMockWorld({
        hubOrigin: { x: 31, y: 31 },
        buildings: {
          hub_1: {
            id: "hub_1",
            type: "hub" as const,
            x: 31,
            y: 31,
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
          },
        },
      });
      scene.syncWorld(world);

      // Hub should be at center of 2x2 tiles: (31 + 1) * 32 = 1024
      const hubSpriteCalls = (scene.add.sprite as ReturnType<typeof vi.fn>).mock.calls;
      const hubCall = hubSpriteCalls.find((call: unknown[]) => {
        const textureArg = call[2] as string | undefined;
        return textureArg?.includes("hub") ?? false;
      });
      expect(hubCall).toBeDefined();
      
      // Position should be (1024, 1024)
      expect(hubCall![0]).toBe(1024);
      expect(hubCall![1]).toBe(1024);

      // setDisplaySize should be called with (64, 64) for hub
      expect(mockSprite.setDisplaySize).toHaveBeenCalledWith(64, 64);
    });
  });

  describe("mouse wheel zoom", () => {
    let wheelHandler: ((pointer: unknown, gameObjects: unknown, deltaX: number, deltaY: number) => void) | null = null;

    beforeEach(() => {
      // Capture the wheel handler that was registered
      (scene.input.on as ReturnType<typeof vi.fn>).mock.calls.forEach((call: unknown[]) => {
        if (call[0] === "wheel" && typeof call[1] === "function") {
          wheelHandler = call[1] as typeof wheelHandler;
        }
      });
    });

    it("should zoom in by 0.1 on wheel up (deltaY = -100)", () => {
      scene.create();
      
      // Re-capture handler after create() registers it
      (scene.input.on as ReturnType<typeof vi.fn>).mock.calls.forEach((call: unknown[]) => {
        if (call[0] === "wheel" && typeof call[1] === "function") {
          wheelHandler = call[1] as typeof wheelHandler;
        }
      });

      expect(wheelHandler).toBeDefined();
      
      const initialZoom = scene.cameras.main.zoom;
      // Call the handler with deltaY = -100 (realistic wheel up event)
      wheelHandler!(null as unknown, null as unknown, 0, -100);
      
      // Zoom should increase by exactly ZOOM_SENSITIVITY (0.1)
      expect(scene.cameras.main.zoom).toBe(initialZoom + 0.1);
      expect(scene.cameras.main.zoom).toBe(1.1);
    });

    it("should zoom out by 0.1 on wheel down (deltaY = 100)", () => {
      scene.create();
      
      // Re-capture handler after create() registers it
      (scene.input.on as ReturnType<typeof vi.fn>).mock.calls.forEach((call: unknown[]) => {
        if (call[0] === "wheel" && typeof call[1] === "function") {
          wheelHandler = call[1] as typeof wheelHandler;
        }
      });

      expect(wheelHandler).toBeDefined();
      
      const initialZoom = scene.cameras.main.zoom;
      // Call the handler with deltaY = 100 (realistic wheel down event)
      wheelHandler!(null as unknown, null as unknown, 0, 100);
      
      // Zoom should decrease by exactly ZOOM_SENSITIVITY (0.1)
      expect(scene.cameras.main.zoom).toBe(initialZoom - 0.1);
      expect(scene.cameras.main.zoom).toBe(0.9);
    });

    it("should clamp zoom to [ZOOM_MIN, ZOOM_MAX]", () => {
      scene.create();
      
      // Re-capture handler after create() registers it
      (scene.input.on as ReturnType<typeof vi.fn>).mock.calls.forEach((call: unknown[]) => {
        if (call[0] === "wheel" && typeof call[1] === "function") {
          wheelHandler = call[1] as typeof wheelHandler;
        }
      });

      expect(wheelHandler).toBeDefined();
      
      // Set zoom to minimum
      scene.cameras.main.zoom = 0.5;
      // Wheel up multiple times with realistic deltaY
      for (let i = 0; i < 20; i++) {
        wheelHandler!(null as unknown, null as unknown, 0, -100);
      }
      
      // Should be clamped at ZOOM_MAX (2.5)
      expect(scene.cameras.main.zoom).toBe(2.5);
    });
  });

  describe("camera pan (1:1 natural follow)", () => {
    let pointerMoveHandler: ((pointer: unknown) => void) | null = null;

    it("should move camera by -dx / zoom, -dy / zoom for 1:1 natural follow", () => {
      scene.create();
      
      // Capture the pointermove handler after create()
      (scene.input.on as ReturnType<typeof vi.fn>).mock.calls.forEach((call: unknown[]) => {
        if (call[0] === "pointermove" && typeof call[1] === "function") {
          pointerMoveHandler = call[1] as typeof pointerMoveHandler;
        }
      });
      
      expect(pointerMoveHandler).toBeDefined();
      
      // Set up camera pan start state
      (scene as any).cameraPanStart = { x: 100, y: 100 };
      (scene as any).lastMousePos = { x: 100, y: 100 };
      scene.cameras.main.scrollX = 0;
      scene.cameras.main.scrollY = 0;
      scene.cameras.main.zoom = 1;

      // Simulate pointer move with dx=50, dy=30
      const mockPointer = { x: 150, y: 130 };
      pointerMoveHandler!(mockPointer);
      
      // scrollX should be -50/1 = -50, scrollY should be -30/1 = -30
      expect(scene.cameras.main.scrollX).toBe(-50);
      expect(scene.cameras.main.scrollY).toBe(-30);
    });

    it("should account for zoom level in pan calculation", () => {
      scene.create();
      
      // Capture the pointermove handler after create()
      (scene.input.on as ReturnType<typeof vi.fn>).mock.calls.forEach((call: unknown[]) => {
        if (call[0] === "pointermove" && typeof call[1] === "function") {
          pointerMoveHandler = call[1] as typeof pointerMoveHandler;
        }
      });
      
      expect(pointerMoveHandler).toBeDefined();
      
      // Set up camera pan start state with zoom = 2
      (scene as any).cameraPanStart = { x: 100, y: 100 };
      (scene as any).lastMousePos = { x: 100, y: 100 };
      scene.cameras.main.scrollX = 0;
      scene.cameras.main.scrollY = 0;
      scene.cameras.main.zoom = 2;

      // Simulate pointer move with dx=50, dy=30
      const mockPointer = { x: 150, y: 130 };
      pointerMoveHandler!(mockPointer);
      
      // scrollX should be -50/2 = -25, scrollY should be -30/2 = -15
      expect(scene.cameras.main.scrollX).toBe(-25);
      expect(scene.cameras.main.scrollY).toBe(-15);
    });
  });

  describe("centerCameraOnTile", () => {
    it("should call camera.centerOn with tile center position", () => {
      scene.setContext(createMockWorld(), {
        mode: "place",
        selectedBuilding: null,
        direction: "N",
        selectedRecipe: null,
        selectedFilter: null,
        inspectedCoord: null,
        isDraggingBelt: false,
        dragStartX: null,
        dragStartY: null,
      });

      scene.centerCameraOnTile(10, 20);

      // Should call centerOn with (10 * 32 + 16, 20 * 32 + 16) = (336, 656)
      expect(scene.cameras.main.centerOn).toHaveBeenCalledWith(336, 656);
    });

    it("should handle different tile coordinates", () => {
      scene.setContext(createMockWorld(), {
        mode: "place",
        selectedBuilding: null,
        direction: "N",
        selectedRecipe: null,
        selectedFilter: null,
        inspectedCoord: null,
        isDraggingBelt: false,
        dragStartX: null,
        dragStartY: null,
      });

      scene.centerCameraOnTile(0, 0);

      // Should call centerOn with (0 * 32 + 16, 0 * 32 + 16) = (16, 16)
      expect(scene.cameras.main.centerOn).toHaveBeenCalledWith(16, 16);
    });
  });

  describe("getCameraViewport", () => {
    it("should return correct viewport bounds", () => {
      scene.create();
      
      // Set camera position and size
      scene.cameras.main.scrollX = 320; // 10 tiles * 32
      scene.cameras.main.scrollY = 640; // 20 tiles * 32
      scene.cameras.main.width = 960;   // 30 tiles * 32
      scene.cameras.main.height = 544;  // 17 tiles * 32

      const viewport = scene.getCameraViewport();
      
      expect(viewport.left).toBe(10);
      expect(viewport.top).toBe(20);
      expect(viewport.right).toBe(40); // 10 + 30
      expect(viewport.bottom).toBe(37); // 20 + 17
      expect(viewport.width).toBe(30);
      expect(viewport.height).toBe(17);
    });

    it("should return zeros when camera is not initialized", () => {
      // Don't call create(), so camera is not set up
      const viewport = scene.getCameraViewport();
      
      expect(viewport.left).toBe(0);
      expect(viewport.right).toBe(0);
      expect(viewport.top).toBe(0);
      expect(viewport.bottom).toBe(0);
      expect(viewport.width).toBe(0);
      expect(viewport.height).toBe(0);
    });
  });

  describe("H key shortcut", () => {
    let hKeyHandler: (() => void) | null = null;

    beforeEach(() => {
      scene.create();
      // Capture the H key handler
      (scene.input.keyboard?.on as ReturnType<typeof vi.fn>).mock.calls.forEach((call: unknown[]) => {
        if (call[0] === "keydown-H" && typeof call[1] === "function") {
          hKeyHandler = call[1] as typeof hKeyHandler;
        }
      });
    });

    it("should call centerCameraOnHub when H key is pressed", () => {
      const world = createMockWorld({ hubOrigin: { x: 31, y: 31 } });
      scene.setContext(world, {
        mode: "place",
        selectedBuilding: null,
        direction: "N",
        selectedRecipe: null,
        selectedFilter: null,
        inspectedCoord: null,
        isDraggingBelt: false,
        dragStartX: null,
        dragStartY: null,
      });

      // Mock isInputFocused to return false
      (scene as any).isInputFocused = () => false;

      hKeyHandler!();

      expect(scene.cameras.main.centerOn).toHaveBeenCalledWith(1024, 1024);
    });

    it("should NOT call centerCameraOnHub when input is focused", () => {
      // Mock isInputFocused to return true
      (scene as any).isInputFocused = () => true;

      hKeyHandler!();

      // centerOn should not be called again (only from setup)
      expect(scene.cameras.main.centerOn).toHaveBeenCalledTimes(1);
    });
  });
});

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

describe("PlacementGhost", () => {
  let mockScene: { add: { sprite: ReturnType<typeof vi.fn>; graphics: ReturnType<typeof vi.fn> }; textures: { createCanvas: ReturnType<typeof vi.fn> } };
  let ghostSprite: {
    setAlpha: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setTexture: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  let mockGraphics: {
    setDepth: ReturnType<typeof vi.fn>;
    lineStyle: ReturnType<typeof vi.fn>;
    fillStyle: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    strokeRect: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    strokePath: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ghostSprite = {
      setAlpha: vi.fn(),
      setDepth: vi.fn(),
      setPosition: vi.fn(),
      setVisible: vi.fn(),
      setTexture: vi.fn(),
      destroy: vi.fn(),
    };
    
    mockGraphics = {
      setDepth: vi.fn(),
      lineStyle: vi.fn(),
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      beginPath: vi.fn(),
      strokePath: vi.fn(),
      clear: vi.fn(),
      setVisible: vi.fn(),
      destroy: vi.fn(),
    };
    
    mockScene = {
      add: {
        sprite: vi.fn().mockReturnValue(ghostSprite),
        graphics: vi.fn().mockReturnValue(mockGraphics),
      },
      textures: {
        createCanvas: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            fillCircle: vi.fn(),
          }),
        }),
      },
    };
  });

  it("should create a ghost sprite with alpha 0.5 on first show", () => {
    const ghost = new PlacementGhost(mockScene as unknown as Scene);
    ghost.show(5, 5, "belt", "E");

    // Should create sprite and set alpha to 0.5
    expect(mockScene.add.sprite).toHaveBeenCalledWith(0, 0, expect.stringContaining("belt"));
    expect(ghostSprite.setAlpha).toHaveBeenCalledWith(0.5);
  });

  it("should position ghost at center of tile (tileX + 0.5) * TILE_SIZE", () => {
    const ghost = new PlacementGhost(mockScene as unknown as Scene);
    ghost.show(5, 5, "belt", "E");

    // Position should be (5 + 0.5) * 32 = 176
    expect(ghostSprite.setPosition).toHaveBeenCalledWith(176, 176);
  });

  it("should update texture on subsequent show calls with different building/direction", () => {
    const ghost = new PlacementGhost(mockScene as unknown as Scene);
    ghost.show(5, 5, "belt", "E");
    
    // Second call should not create new sprite but update texture
    ghost.show(5, 5, "miner", "N");
    
    expect(mockScene.add.sprite).toHaveBeenCalledTimes(1); // Only once
    expect(ghostSprite.setTexture).toHaveBeenCalled(); // Texture updated
  });

  it("should hide ghost when hide() is called", () => {
    const ghost = new PlacementGhost(mockScene as unknown as Scene);
    ghost.show(5, 5, "belt", "E");
    ghost.hide();

    expect(ghostSprite.setVisible).toHaveBeenCalledWith(false);
  });

  it("should update position and texture on update()", () => {
    const ghost = new PlacementGhost(mockScene as unknown as Scene);
    ghost.update(5, 5, "belt", "E");

    expect(ghostSprite.setPosition).toHaveBeenCalledWith(176, 176);
    expect(ghostSprite.setVisible).toHaveBeenCalledWith(true);
  });

  it("should destroy sprite on destroy()", () => {
    const ghost = new PlacementGhost(mockScene as unknown as Scene);
    ghost.show(5, 5, "belt", "E");
    ghost.destroy();

    expect(ghostSprite.destroy).toHaveBeenCalled();
  });
});
