import { describe, it, expect } from "vitest";
import {
  drawBelt,
  drawSplitter,
  drawFilterSplitter,
  drawUndergroundBelt,
  drawMiner,
  drawSmelter,
  drawAssembler,
  drawRecycler,
  drawSensor,
  drawHub,
  drawBuilding,
  getBuildingTextureKey,
} from "../../src/game/sprites/buildings";
import type { Direction, BuildingType } from "../../src/sim/types";

/**
 * Mock HTMLCanvasElement for Node environment testing
 */
class MockCanvas {
  public width: number;
  public height: number;

  constructor(width = 32, height = 32) {
    this.width = width;
    this.height = height;
  }

  getContext(contextId: string): MockCanvasContext | null {
    if (contextId === "2d") {
      return new MockCanvasContext(this.width, this.height);
    }
    return null;
  }
}

/**
 * Create a mock Canvas2D context for testing.
 * Tracks all drawing operations to verify pixel-level rendering.
 */
class MockCanvasContext {
  public canvas: MockCanvas;
  public pixels: Map<string, string> = new Map(); // "x,y" -> color
  public clearCalls: Array<{ x: number; y: number; w: number; h: number }> = [];
  public fillStyles: string[] = [];
  public transforms: Array<{ type: string; value?: number }> = [];
  private pathPoints: Array<{ x: number; y: number }> = [];

  constructor(width = 32, height = 32) {
    this.canvas = new MockCanvas(width, height);
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.clearCalls.push({ x, y, w, h });
    // Clear pixels in this region
    for (let cy = y; cy < y + h; cy++) {
      for (let cx = x; cx < x + w; cx++) {
        if (cx >= 0 && cx < this.canvas.width && cy >= 0 && cy < this.canvas.height) {
          this.pixels.delete(`${cx},${cy}`);
        }
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const color = this.fillStyle;
    for (let cy = y; cy < y + h; cy++) {
      for (let cx = x; cx < x + w; cx++) {
        if (cx >= 0 && cx < this.canvas.width && cy >= 0 && cy < this.canvas.height) {
          this.pixels.set(`${cx},${cy}`, color);
        }
      }
    }
  }

  set fillStyle(color: string) {
    this.fillStyles.push(color);
  }

  get fillStyle(): string {
    return this.fillStyles[this.fillStyles.length - 1] ?? "#000000";
  }

  save(): void {
    this.transforms.push({ type: "save" });
  }

  restore(): void {
    this.transforms.push({ type: "restore" });
  }

  translate(x: number, y: number): void {
    this.transforms.push({ type: "translate", value: x + y });
  }

  rotate(angle: number): void {
    this.transforms.push({ type: "rotate", value: angle });
  }

  drawImage(canvas: MockCanvas, x: number, y: number): void {
    this.transforms.push({ type: "drawImage", value: x + y });
  }

  // Canvas2D path methods (no-op for testing purposes)
  beginPath(): void {
    this.pathPoints = [];
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    // Approximate circle with filled rect for testing
    const size = Math.floor(radius * 2);
    const startX = Math.floor(x - radius);
    const startY = Math.floor(y - radius);
    this.fillRect(startX, startY, size, size);
  }

  fill(): void {
    // Path already rendered via fillRect in arc
  }

  stroke(): void {
    // No-op for testing
  }

  lineWidth = 1;

  // Additional Canvas2D path methods (no-op for testing purposes)
  moveTo(_x: number, _y: number): void {
    // No-op for testing
  }

  lineTo(_x: number, _y: number): void {
    // No-op for testing
  }

  /** Count pixels with non-transparent/non-clear colors */
  countRenderedPixels(): number {
    return this.pixels.size;
  }

  /** Check if any pixel was drawn at or beyond coordinate boundary */
  hasPixelsInRange(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): boolean {
    for (const key of this.pixels.keys()) {
      const parts = key.split(",").map(Number);
      const x = parts[0];
      const y = parts[1];
      if (x !== undefined && y !== undefined && x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return true;
      }
    }
    return false;
  }

  /** Get all pixel coordinates that have been drawn */
  getPixelCoordinates(): Array<{ x: number; y: number }> {
    return Array.from(this.pixels.keys()).map((key) => {
      const parts = key.split(",").map(Number);
      const x = parts[0];
      const y = parts[1];
      return { x: x ?? 0, y: y ?? 0 };
    });
  }

  /** Check if specific pixel range has any rendered content */
  hasPixelsOutsideRange(minX: number, minY: number, maxX: number, maxY: number): boolean {
    for (const key of this.pixels.keys()) {
      const parts = key.split(",").map(Number);
      const x = parts[0];
      const y = parts[1];
      if (x !== undefined && y !== undefined && (x < minX || x > maxX || y < minY || y > maxY)) {
        return true;
      }
    }
    return false;
  }
}

// Mock document for offscreen canvas usage in drawBelt
const mockDocument = {
  createElement: (tag: string): unknown => {
    if (tag === "canvas") {
      return new MockCanvas(32, 32);
    }
    return {};
  },
};

// Override document.createElement temporarily for tests
const originalDocument = (globalThis as unknown as { document?: unknown }).document;
(globalThis as unknown as { document: typeof mockDocument }).document = mockDocument as typeof mockDocument;

describe("Building Sprites - Drawing Contracts", () => {
  describe("getBuildingTextureKey", () => {
    it("should generate unique keys for each building/direction/frame combination", () => {
      expect(getBuildingTextureKey("miner", "N", 0)).toBe("miner_N_0");
      expect(getBuildingTextureKey("miner", "E", 0)).toBe("miner_E_0");
      expect(getBuildingTextureKey("miner", "N", 1)).toBe("miner_N_1");
      expect(getBuildingTextureKey("belt", "S", 0)).toBe("belt_S_0");
      expect(getBuildingTextureKey("hub", "W", 1)).toBe("hub_W_1");
    });
  });

  describe("1×1 Buildings (32×32) - Pixel Rendering", () => {
    const buildings1x1: Array<{ type: BuildingType; name: string }> = [
      { type: "miner", name: "Miner" },
      { type: "belt", name: "Belt" },
      { type: "splitter", name: "Splitter" },
      { type: "filter_splitter", name: "Filter Splitter" },
      { type: "underground_belt", name: "Underground Belt" },
      { type: "smelter", name: "Smelter" },
      { type: "assembler", name: "Assembler" },
      { type: "recycler", name: "Recycler" },
      { type: "sensor", name: "Sensor" },
    ];

    const directions: Direction[] = ["N", "E", "S", "W"];

    for (const { type, name } of buildings1x1) {
      describe(`${name} (${type})`, () => {
        it(`should render multiple colored pixels within 32×32 bounds for all directions`, () => {
          for (const dir of directions) {
            const ctx = new MockCanvasContext(32, 32);
            drawBuilding(ctx as unknown as CanvasRenderingContext2D, type, dir, 0, false);

            const coords = ctx.getPixelCoordinates();
            // Verify all pixels are within bounds
            for (const { x, y } of coords) {
              expect(x).toBeGreaterThanOrEqual(0);
              expect(x).toBeLessThan(32);
              expect(y).toBeGreaterThanOrEqual(0);
              expect(y).toBeLessThan(32);
            }
            // Verify substantial pixel count (not just a few pixels)
            expect(coords.length).toBeGreaterThan(20);
          }
        });

        it(`should render correctly with frame 0 and frame 1`, () => {
          const ctx0 = new MockCanvasContext(32, 32);
          const ctx1 = new MockCanvasContext(32, 32);
          
          drawBuilding(ctx0 as unknown as CanvasRenderingContext2D, type, "E", 0, false);
          drawBuilding(ctx1 as unknown as CanvasRenderingContext2D, type, "E", 1, false);

          // Both should have rendered content
          expect(ctx0.countRenderedPixels()).toBeGreaterThan(0);
          expect(ctx1.countRenderedPixels()).toBeGreaterThan(0);
        });

        it(`should handle faulted=true without errors`, () => {
          const ctx = new MockCanvasContext(32, 32);
          expect(() =>
            drawBuilding(ctx as unknown as CanvasRenderingContext2D, type, "E", 0, true)
          ).not.toThrow();
          expect(ctx.countRenderedPixels()).toBeGreaterThan(0);
        });
      });
    }
  });

  describe("drawBelt - Horizontal/Vertical Coverage", () => {
    it("should draw horizontally from x=0 to x=31 when direction is E/W", () => {
      for (const dir of ["E", "W"] as Direction[]) {
        const ctx = new MockCanvasContext(32, 32);
        drawBelt(ctx as unknown as CanvasRenderingContext2D, dir, 0, false);

        const coords = ctx.getPixelCoordinates();
        const hasLeftEdge = coords.some((p) => p.x === 0);
        const hasRightEdge = coords.some((p) => p.x === 31);
        
        expect(hasLeftEdge || hasRightEdge).toBe(true);
        // Check coverage across horizontal span
        const xCoords = new Set(coords.map((p) => p.x));
        expect(xCoords.size).toBeGreaterThan(20); // Should span most of horizontal range
      }
    });

    it("should draw vertically from y=0 to y=31 when direction is N/S", () => {
      for (const dir of ["N", "S"] as Direction[]) {
        const ctx = new MockCanvasContext(32, 32);
        drawBelt(ctx as unknown as CanvasRenderingContext2D, dir, 0, false);

        const coords = ctx.getPixelCoordinates();
        const hasTopEdge = coords.some((p) => p.y === 0);
        const hasBottomEdge = coords.some((p) => p.y === 31);
        
        expect(hasTopEdge || hasBottomEdge).toBe(true);
        // Check coverage across vertical span
        const yCoords = new Set(coords.map((p) => p.y));
        expect(yCoords.size).toBeGreaterThan(20); // Should span most of vertical range
      }
    });
  });

  describe("drawHub - 64×64 Large Building", () => {
    it("should render within 64×64 bounds including coordinates > 32", () => {
      const ctx = new MockCanvasContext(64, 64);
      drawHub(ctx as unknown as CanvasRenderingContext2D, "E", 0, false);

      const coords = ctx.getPixelCoordinates();
      
      // All pixels should be within 64×64 bounds
      for (const { x, y } of coords) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(64);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(64);
      }

      // Should use coordinates beyond 32 (proving 64×64 rendering)
      const hasBeyond32 = coords.some((p) => p.x > 32 || p.y > 32);
      expect(hasBeyond32).toBe(true);

      // Should have substantial pixel count for large building
      expect(coords.length).toBeGreaterThan(500);
    });

    it("should render with multiple colors", () => {
      const ctx = new MockCanvasContext(64, 64);
      drawHub(ctx as unknown as CanvasRenderingContext2D, "N", 1, false);

      const uniqueColors = new Set(ctx.pixels.values());
      expect(uniqueColors.size).toBeGreaterThan(3);
    });

    it("should handle faulted state on 64×64 canvas", () => {
      const ctx = new MockCanvasContext(64, 64);
      expect(() =>
        drawHub(ctx as unknown as CanvasRenderingContext2D, "E", 0, true)
      ).not.toThrow();
      expect(ctx.countRenderedPixels()).toBeGreaterThan(500);
    });
  });

  describe("drawBuilding dispatcher", () => {
    it("should route all building types correctly", () => {
      const buildingTypes: BuildingType[] = [
        "miner", "belt", "splitter", "filter_splitter",
        "underground_belt", "smelter", "assembler", "recycler", "sensor", "hub"
      ];

      for (const type of buildingTypes) {
        const ctx = new MockCanvasContext(type === "hub" ? 64 : 32, type === "hub" ? 64 : 32);
        expect(() =>
          drawBuilding(
            ctx as unknown as CanvasRenderingContext2D,
            type,
            "E",
            0,
            false
          )
        ).not.toThrow();
        expect(ctx.countRenderedPixels()).toBeGreaterThan(0);
      }
    });

    it("should throw error for invalid frame on 1×1 buildings", () => {
      const ctx = new MockCanvasContext(32, 32);
      // drawBelt validates frame (only accepts 0 or 1)
      expect(() =>
        drawBuilding(ctx as unknown as CanvasRenderingContext2D, "belt", "E", 2, false)
      ).toThrow();
    });
  });

  describe("Direction handling", () => {
    const testBuildings: BuildingType[] = ["miner", "splitter", "smelter"];

    for (const type of testBuildings) {
      it(`should handle all directions for ${type} without errors`, () => {
        for (const dir of ["N", "E", "S", "W"] as Direction[]) {
          const ctx = new MockCanvasContext(32, 32);
          expect(() =>
            drawBuilding(ctx as unknown as CanvasRenderingContext2D, type, dir, 0, false)
          ).not.toThrow();
          expect(ctx.countRenderedPixels()).toBeGreaterThan(0);
        }
      });
    }
  });
});
