// Tests for procedural texture registration
import { describe, it, expect, vi } from "vitest";
import type { Scene, Textures } from "phaser";
import {
  registerAllTextures,
  getExpectedTerrainKeys,
  getExpectedDepositKeys,
  getExpectedBuildingKeys,
  getExpectedItemKeys,
  getExpectedTextureCount,
} from "../../src/game/textures";

// Simple mock canvas texture
class MockCanvas {
  key: string;
  width: number;
  height: number;
  private ctx: any;

  constructor(key: string, width: number, height: number) {
    this.key = key;
    this.width = width;
    this.height = height;
    // Create context with reference to this canvas - include all common CanvasRenderingContext2D methods
    this.ctx = {
      fillStyle: "",
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      strokeRect: vi.fn(),
      lineWidth: 1,
      font: "",
      fillText: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4 * 32 * 32) }),
      putImageData: vi.fn(),
      canvas: { width, height },
    };
  }

  getContext(): any {
    return this.ctx;
  }

  refresh(): void {}
}

// Mock document.createElement for offscreen canvas usage
vi.stubGlobal("document", {
  createElement: vi.fn().mockReturnValue({
    width: 32,
    height: 32,
    getContext: vi.fn().mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      strokeRect: vi.fn(),
      lineWidth: 1,
      font: "",
      fillText: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4 * 32 * 32) }),
      putImageData: vi.fn(),
      canvas: { width: 32, height: 32 },
    }),
  }),
});

// Mock texture manager that tracks created canvases
class TestTextureManager {
  canvases = new Map<string, MockCanvas>();

  createCanvas(key: string, width: number, height: number): MockCanvas | null {
    const canvas = new MockCanvas(key, width, height);
    this.canvases.set(key, canvas);
    return canvas;
  }

  has(key: string): boolean {
    return this.canvases.has(key);
  }

  get(key: string): MockCanvas | undefined {
    return this.canvases.get(key);
  }
}

function createMockScene(): Scene {
  const texMgr = new TestTextureManager();
  return {
    textures: texMgr as unknown as Textures.TextureManager,
  } as unknown as Scene;
}

function getCreatedCanvases(scene: Scene): Map<string, MockCanvas> {
  return (scene.textures as unknown as TestTextureManager).canvases;
}

describe("Texture Registration", () => {
  it("should register all expected textures", () => {
    const scene = createMockScene();
    registerAllTextures(scene);

    const canvases = getCreatedCanvases(scene);
    const expectedKeys = [
      ...getExpectedTerrainKeys(),
      ...getExpectedDepositKeys(),
      ...getExpectedBuildingKeys(),
      ...getExpectedItemKeys(),
    ];

    expect(canvases.size).toBe(expectedKeys.length);

    for (const key of expectedKeys) {
      expect(canvases.has(key)).toBe(true);
    }
  });

  it("should create 64×64 canvas for hub and 32×32 for other buildings", () => {
    const scene = createMockScene();
    registerAllTextures(scene);

    const canvases = getCreatedCanvases(scene);

    // Hub textures should be 64×64
    for (const [key, canvas] of canvases.entries()) {
      if (key.includes("hub")) {
        expect(canvas.width).toBe(64);
        expect(canvas.height).toBe(64);
      } else {
        expect(canvas.width).toBe(32);
        expect(canvas.height).toBe(32);
      }
    }
  });

  describe("Terrain textures", () => {
    it("should register grass, rock, and water", () => {
      const scene = createMockScene();
      registerAllTextures(scene);

      const canvases = getCreatedCanvases(scene);
      const terrainKeys = getExpectedTerrainKeys();

      expect(terrainKeys).toHaveLength(3);
      expect(terrainKeys).toContain("terrain:grass:seed:0");
      expect(terrainKeys).toContain("terrain:rock:seed:0");
      expect(terrainKeys).toContain("terrain:water:seed:0");

      for (const key of terrainKeys) {
        expect(canvases.has(key)).toBe(true);
      }
    });
  });

  describe("Deposit textures", () => {
    it("should register iron_ore, copper_ore, coal, and silica_sand", () => {
      const scene = createMockScene();
      registerAllTextures(scene);

      const canvases = getCreatedCanvases(scene);
      const depositKeys = getExpectedDepositKeys();

      expect(depositKeys).toHaveLength(4);
      expect(depositKeys).toContain("deposit:iron_ore:seed:0");
      expect(depositKeys).toContain("deposit:copper_ore:seed:0");
      expect(depositKeys).toContain("deposit:coal:seed:0");
      expect(depositKeys).toContain("deposit:silica_sand:seed:0");

      for (const key of depositKeys) {
        expect(canvases.has(key)).toBe(true);
      }
    });
  });

  describe("Building textures", () => {
    it("should register all building types × directions × frames × fault states", () => {
      const scene = createMockScene();
      registerAllTextures(scene);

      const canvases = getCreatedCanvases(scene);
      const buildingKeys = getExpectedBuildingKeys();

      // 10 types × 4 directions × 2 frames × 2 fault states = 160
      expect(buildingKeys).toHaveLength(160);

      // Sample check: miner in all combinations
      for (const dir of ["N", "E", "S", "W"] as const) {
        for (const frame of [0, 1]) {
          for (const faulted of ["ok", "faulted"]) {
            const key = `miner_${dir}_${frame}_${faulted}`;
            expect(canvases.has(key)).toBe(true);
          }
        }
      }
    });
  });

  describe("Item textures", () => {
    it("should register all 14 material items", () => {
      const scene = createMockScene();
      registerAllTextures(scene);

      const canvases = getCreatedCanvases(scene);
      const itemKeys = getExpectedItemKeys();

      expect(itemKeys).toHaveLength(14);

      const expectedItems = [
        "iron_ore",
        "copper_ore",
        "coal",
        "silica_sand",
        "iron_plate",
        "copper_plate",
        "iron_gear",
        "copper_wire",
        "steel_plate",
        "silicon_wafer",
        "circuit_board",
        "microchip",
        "automation_module",
        "slag",
      ];

      for (const material of expectedItems) {
        const key = `item_${material}`;
        expect(itemKeys).toContain(key);
        expect(canvases.has(key)).toBe(true);
      }
    });
  });

  describe("Texture count helpers", () => {
    it("should calculate correct total count", () => {
      const count = getExpectedTextureCount();
      // 3 terrain + 4 deposits + 160 buildings (hub is 64×64, others 32×32) + 14 items = 181
      expect(count).toBe(181);
    });

    it("should return correct counts per category", () => {
      expect(getExpectedTerrainKeys()).toHaveLength(3);
      expect(getExpectedDepositKeys()).toHaveLength(4);
      expect(getExpectedBuildingKeys()).toHaveLength(160);
      expect(getExpectedItemKeys()).toHaveLength(14);
    });
  });
});
