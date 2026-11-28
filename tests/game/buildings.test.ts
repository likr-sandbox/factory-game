import { describe, it, expect } from "vitest";
import {
  drawBelt, drawSplitter, drawFilterSplitter, drawUndergroundBelt,
  drawMiner, drawSmelter, drawAssembler, drawRecycler, drawSensor,
  drawHub, drawBuilding, getBuildingTextureKey,
} from "../../src/game/sprites/buildings";
import type { Direction, BuildingType } from "../../src/sim/types";

class MockCanvas {
  public width: number; public height: number;
  constructor(w = 32, h = 32) { this.width = w; this.height = h; }
  getContext(id: string): MockCtx | null { return id === "2d" ? new MockCtx(this.width, this.height) : null; }
}

class MockCtx {
  public canvas: MockCanvas;
  public pixels = new Map<string, string>();
  private styles: string[] = [];
  constructor(w = 32, h = 32) { this.canvas = new MockCanvas(w, h); }
  clearRect(x: number, y: number, w: number, h: number): void {
    for (let cy = y; cy < y + h; cy++) for (let cx = x; cx < x + w; cx++)
      if (cx >= 0 && cx < this.canvas.width && cy >= 0 && cy < this.canvas.height) this.pixels.delete(`${cx},${cy}`);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const c = this.fillStyle;
    for (let cy = y; cy < y + h; cy++) for (let cx = x; cx < x + w; cx++)
      if (cx >= 0 && cx < this.canvas.width && cy >= 0 && cy < this.canvas.height) this.pixels.set(`${cx},${cy}`, c);
  }
  set fillStyle(c: string) { this.styles.push(c); }
  get fillStyle(): string { return this.styles[this.styles.length - 1] ?? "#000"; }
  save() {} restore() {} translate() {} rotate() {} drawImage() {}
  beginPath() {} arc(x: number, y: number, r: number) { this.fillRect(Math.floor(x-r), Math.floor(y-r), Math.floor(r*2), Math.floor(r*2)); }
  fill() {} stroke() {} moveTo() {} lineTo() {} lineWidth = 1;
  getPixelCoords() { return Array.from(this.pixels.keys()).map(k => { const [x,y]=k.split(",").map(Number); return {x:x??0,y:y??0}; }); }
  count() { return this.pixels.size; }
}

const mockDoc = { createElement: (t: string) => t === "canvas" ? new MockCanvas(32, 32) : {} };
(globalThis as unknown as { document?: unknown }).document = mockDoc as typeof mockDoc;

describe("Building Sprites", () => {
  it("getBuildingTextureKey generates unique keys", () => {
    expect(getBuildingTextureKey("miner", "N", 0)).toBe("miner_N_0");
    expect(getBuildingTextureKey("hub", "W", 1)).toBe("hub_W_1");
  });

  const buildings1x1: Array<{type: BuildingType; name: string}> = [
    {type:"miner",name:"Miner"},{type:"belt",name:"Belt"},{type:"splitter",name:"Splitter"},
    {type:"filter_splitter",name:"Filter Splitter"},{type:"underground_belt",name:"Underground Belt"},
    {type:"smelter",name:"Smelter"},{type:"assembler",name:"Assembler"},{type:"recycler",name:"Recycler"},
    {type:"sensor",name:"Sensor"},
  ];
  const dirs: Direction[] = ["N","E","S","W"];

  for (const {type,name} of buildings1x1) {
    describe(`${name} (${type})`, () => {
      it(`renders in 32×32 bounds for all directions`, () => {
        for (const dir of dirs) {
          const ctx = new MockCtx(32, 32);
          drawBuilding(ctx as unknown as CanvasRenderingContext2D, type, dir, 0, false);
          for (const {x,y} of ctx.getPixelCoords()) {
            expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(32);
            expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(32);
          }
          expect(ctx.count()).toBeGreaterThan(20);
        }
      });
      it(`renders with frame 0 and 1`, () => {
        const c0 = new MockCtx(32, 32), c1 = new MockCtx(32, 32);
        drawBuilding(c0 as unknown as CanvasRenderingContext2D, type, "E", 0, false);
        drawBuilding(c1 as unknown as CanvasRenderingContext2D, type, "E", 1, false);
        expect(c0.count()).toBeGreaterThan(0); expect(c1.count()).toBeGreaterThan(0);
      });
      it(`handles faulted=true`, () => {
        const ctx = new MockCtx(32, 32);
        expect(() => drawBuilding(ctx as unknown as CanvasRenderingContext2D, type, "E", 0, true)).not.toThrow();
        expect(ctx.count()).toBeGreaterThan(0);
      });
    });
  }

  describe("drawBelt coverage", () => {
    it("horizontal E/W reaches x=0 or x=31", () => {
      for (const dir of ["E","W"] as Direction[]) {
        const ctx = new MockCtx(32, 32);
        drawBelt(ctx as unknown as CanvasRenderingContext2D, dir, 0, false);
        const coords = ctx.getPixelCoords();
        expect(coords.some(p=>p.x===0) || coords.some(p=>p.x===31)).toBe(true);
        expect(new Set(coords.map(p=>p.x)).size).toBeGreaterThan(20);
      }
    });
    it("vertical N/S reaches y=0 or y=31", () => {
      for (const dir of ["N","S"] as Direction[]) {
        const ctx = new MockCtx(32, 32);
        drawBelt(ctx as unknown as CanvasRenderingContext2D, dir, 0, false);
        const coords = ctx.getPixelCoords();
        expect(coords.some(p=>p.y===0) || coords.some(p=>p.y===31)).toBe(true);
        expect(new Set(coords.map(p=>p.y)).size).toBeGreaterThan(20);
      }
    });
  });

  describe("drawUndergroundBelt direction", () => {
    it("N/S spans vertically", () => {
      for (const dir of ["N","S"] as Direction[]) {
        const ctx = new MockCtx(32, 32);
        drawUndergroundBelt(ctx as unknown as CanvasRenderingContext2D, dir, 0, false);
        const coords = ctx.getPixelCoords();
        expect(new Set(coords.map(p=>p.y)).size).toBeGreaterThan(25);
        expect(coords.some(p=>p.y===0) || coords.some(p=>p.y===31)).toBe(true);
      }
    });
    it("E/W spans horizontally", () => {
      for (const dir of ["E","W"] as Direction[]) {
        const ctx = new MockCtx(32, 32);
        drawUndergroundBelt(ctx as unknown as CanvasRenderingContext2D, dir, 0, false);
        const coords = ctx.getPixelCoords();
        expect(new Set(coords.map(p=>p.x)).size).toBeGreaterThan(25);
        expect(coords.some(p=>p.x===0) || coords.some(p=>p.x===31)).toBe(true);
      }
    });
    it("N vs E have different spans", () => {
      const cN = new MockCtx(32,32), cE = new MockCtx(32,32);
      drawUndergroundBelt(cN as unknown as CanvasRenderingContext2D, "N", 0, false);
      drawUndergroundBelt(cE as unknown as CanvasRenderingContext2D, "E", 0, false);
      const yN = new Set(cN.getPixelCoords().map(p=>p.y)).size;
      const xN = new Set(cN.getPixelCoords().map(p=>p.x)).size;
      const yE = new Set(cE.getPixelCoords().map(p=>p.y)).size;
      const xE = new Set(cE.getPixelCoords().map(p=>p.x)).size;
      expect(yN).toBeGreaterThan(xN); expect(xE).toBeGreaterThan(yE);
    });
  });

  describe("drawHub 64×64", () => {
    it("renders within 64×64 with coords > 32", () => {
      const ctx = new MockCtx(64, 64);
      drawHub(ctx as unknown as CanvasRenderingContext2D, "E", 0, false);
      for (const {x,y} of ctx.getPixelCoords()) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(64);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(64);
      }
      expect(ctx.getPixelCoords().some(p=>p.x>32||p.y>32)).toBe(true);
      expect(ctx.count()).toBeGreaterThan(500);
    });
    it("handles faulted", () => {
      const ctx = new MockCtx(64, 64);
      expect(() => drawHub(ctx as unknown as CanvasRenderingContext2D, "E", 0, true)).not.toThrow();
      expect(ctx.count()).toBeGreaterThan(500);
    });
  });

  describe("drawBuilding dispatcher", () => {
    it("routes all types correctly", () => {
      const types: BuildingType[] = ["miner","belt","splitter","filter_splitter","underground_belt","smelter","assembler","recycler","sensor","hub"];
      for (const t of types) {
        const ctx = new MockCtx(t==="hub"?64:32, t==="hub"?64:32);
        expect(() => drawBuilding(ctx as unknown as CanvasRenderingContext2D, t, "E", 0, false)).not.toThrow();
        expect(ctx.count()).toBeGreaterThan(0);
      }
    });
    it("throws on invalid frame", () => {
      const ctx = new MockCtx(32, 32);
      expect(() => drawBuilding(ctx as unknown as CanvasRenderingContext2D, "belt", "E", 2, false)).toThrow();
    });
  });

  describe("Direction handling", () => {
    for (const t of ["miner","splitter","smelter"] as BuildingType[]) {
      it(`handles all directions for ${t}`, () => {
        for (const d of dirs) {
          const ctx = new MockCtx(32, 32);
          expect(() => drawBuilding(ctx as unknown as CanvasRenderingContext2D, t, d, 0, false)).not.toThrow();
          expect(ctx.count()).toBeGreaterThan(0);
        }
      });
    }
  });
});
