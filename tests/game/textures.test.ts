// Tests for procedural texture registration
import { describe, it, expect, vi } from "vitest";
import type { Scene, Textures } from "phaser";
import type { MaterialId } from "../../src/sim/types";
import {
  registerAllTextures,
  getExpectedTerrainKeys,
  getExpectedEdgeKeys,
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
      ...getExpectedEdgeKeys(),
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
    it("should register all terrain variants", () => {
      const scene = createMockScene();
      registerAllTextures(scene);

      const canvases = getCreatedCanvases(scene);
      const terrainKeys = getExpectedTerrainKeys();

      // 5 grass + 4 rock + 3 water = 12
      expect(terrainKeys).toHaveLength(12);
      
      // Check all grass variants (0-4)
      for (let v = 0; v < 5; v++) {
        expect(terrainKeys).toContain(`terrain:grass:seed:${v}`);
        expect(canvases.has(`terrain:grass:seed:${v}`)).toBe(true);
      }
      
      // Check all rock variants (0-3)
      for (let v = 0; v < 4; v++) {
        expect(terrainKeys).toContain(`terrain:rock:seed:${v}`);
        expect(canvases.has(`terrain:rock:seed:${v}`)).toBe(true);
      }
      
      // Check all water variants (0-2)
      for (let v = 0; v < 3; v++) {
        expect(terrainKeys).toContain(`terrain:water:seed:${v}`);
        expect(canvases.has(`terrain:water:seed:${v}`)).toBe(true);
      }
    });
  });

  describe("Edge textures", () => {
    it("should register all edge overlay masks for water and rock", () => {
      const scene = createMockScene();
      registerAllTextures(scene);

      const canvases = getCreatedCanvases(scene);
      const edgeKeys = getExpectedEdgeKeys();

      // 15 water edges + 15 rock edges = 30
      expect(edgeKeys).toHaveLength(30);

      // Check all water edge masks (1-15)
      for (let mask = 1; mask <= 15; mask++) {
        const key = `edge:water:mask:${mask}`;
        expect(edgeKeys).toContain(key);
        expect(canvases.has(key)).toBe(true);
      }

      // Check all rock edge masks (1-15)
      for (let mask = 1; mask <= 15; mask++) {
        const key = `edge:rock:mask:${mask}`;
        expect(edgeKeys).toContain(key);
        expect(canvases.has(key)).toBe(true);
      }
    });
  });

  describe("Deposit textures", () => {
    it("should register all 4 stages for each deposit type", () => {
      const scene = createMockScene();
      registerAllTextures(scene);

      const canvases = getCreatedCanvases(scene);
      const depositKeys = getExpectedDepositKeys();

      // 4 deposits × 4 stages = 16
      expect(depositKeys).toHaveLength(16);

      const deposits: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];
      const stages = ["rich", "medium", "low", "depleted"];

      for (const deposit of deposits) {
        for (const stage of stages) {
          const key = `deposit:${deposit}:seed:0:stage:${stage}`;
          expect(depositKeys).toContain(key);
          expect(canvases.has(key)).toBe(true);
        }
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
      // 12 terrain (5+4+3) + 30 edge (15+15) + 16 deposit (4×4) + 160 building + 14 item = 232
      expect(count).toBe(232);
    });

    it("should return correct counts per category", () => {
      expect(getExpectedTerrainKeys()).toHaveLength(12);
      expect(getExpectedEdgeKeys()).toHaveLength(30);
      expect(getExpectedDepositKeys()).toHaveLength(16);
      expect(getExpectedBuildingKeys()).toHaveLength(160);
      expect(getExpectedItemKeys()).toHaveLength(14);
    });
  });
});
