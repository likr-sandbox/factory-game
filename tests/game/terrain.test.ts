// Tests for terrain and ore deposit rendering with mock CanvasRenderingContext2D
import { describe, it, expect, vi } from "vitest";
import type { MaterialId } from "../../src/sim/types";
import {
  drawGrassTile,
  drawIronOreDeposit,
  drawCopperOreDeposit,
  drawCoalDeposit,
  drawSilicaSandDeposit,
  getTerrainVariant,
  getDepositStage,
  getDepositTextureKey,
  TERRAIN_VARIANT_COUNTS,
  DEPOSIT_STAGES,
} from "../../src/game/sprites/terrain";
import { getDepositColor } from "../../src/game/palette";

class MockContext {
  fillStyle: string = "";
  fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = [];

  fillRect(x: number, y: number, w: number, h: number): void {
    this.fillRectCalls.push({ x, y, w, h, fillStyle: this.fillStyle });
  }

  getUniqueFillStyles(): Set<string> {
    return new Set(this.fillRectCalls.map((c) => c.fillStyle));
  }

  getFillStyleCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const call of this.fillRectCalls) counts.set(call.fillStyle, (counts.get(call.fillStyle) || 0) + 1);
    return counts;
  }

  reset(): void {
    this.fillStyle = "";
    this.fillRectCalls = [];
  }
}

function createMockContext(): any {
  return new MockContext();
}

const DEPOSIT_TYPES: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];
const STAGES = ["rich", "medium", "low", "depleted"] as const;

describe("getTerrainVariant", () => {
  it("should return valid variant index within range", () => {
    for (const terrain of ["grass", "rock", "water"] as const) {
      const variant = getTerrainVariant(0, 0, 42, terrain);
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThanOrEqual(TERRAIN_VARIANT_COUNTS[terrain] - 1);
    }
  });

  it("should be deterministic for same inputs", () => {
    expect(getTerrainVariant(5, 10, 123, "grass")).toBe(getTerrainVariant(5, 10, 123, "grass"));
  });

  it("should produce different output for different coordinates", () => {
    expect(getTerrainVariant(0, 0, 42, "grass")).not.toBe(getTerrainVariant(1, 0, 42, "grass"));
  });
});

describe("getDepositStage", () => {
  it("should return depleted when remaining <= 0", () => {
    expect(getDepositStage(0, 100)).toBe("depleted");
    expect(getDepositStage(-10, 100)).toBe("depleted");
  });

  it("should return depleted when initialAmount <= 0", () => {
    expect(getDepositStage(50, 0)).toBe("depleted");
    expect(getDepositStage(50, -10)).toBe("depleted");
  });

  it("should return rich when ratio > 0.66", () => {
    expect(getDepositStage(70, 100)).toBe("rich");
    expect(getDepositStage(100, 100)).toBe("rich");
  });

  it("should return medium when ratio > 0.33", () => {
    expect(getDepositStage(50, 100)).toBe("medium");
    expect(getDepositStage(40, 100)).toBe("medium");
  });

  it("should return low otherwise", () => {
    expect(getDepositStage(30, 100)).toBe("low");
    expect(getDepositStage(10, 100)).toBe("low");
  });
});

describe("getDepositTextureKey", () => {
  it("should include stage in key", () => {
    const key = getDepositTextureKey("iron_ore", 42, "rich");
    expect(key).toContain("stage:rich");
    expect(key).toContain("seed:42");
  });

  it("should default to rich stage", () => {
    const key = getDepositTextureKey("coal", 100);
    expect(key).toContain("stage:rich");
  });
});

describe("DEPOSIT_STAGES", () => {
  it("should contain all four stages", () => {
    expect(DEPOSIT_STAGES).toEqual(["rich", "medium", "low", "depleted"]);
  });
});

describe("drawGrassTile", () => {
  it("should render a 32x32 grass tile deterministically", () => {
    const ctx = createMockContext();
    drawGrassTile(ctx, 42);
    expect(ctx.fillRectCalls.length).toBeGreaterThanOrEqual(1024);
    for (const call of ctx.fillRectCalls) {
      expect(call.x).toBeGreaterThanOrEqual(0);
      expect(call.y).toBeGreaterThanOrEqual(0);
      expect(call.x + call.w).toBeLessThanOrEqual(32);
      expect(call.y + call.h).toBeLessThanOrEqual(32);
    }
  });

  it("should use rgb() format", () => {
    const ctx = createMockContext();
    drawGrassTile(ctx, 42);
    for (const style of ctx.getUniqueFillStyles()) {
      expect(style).toMatch(/^rgb\(|^rgba\(/);
    }
  });

  it("should produce deterministic output for same seed", () => {
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();
    drawGrassTile(ctx1, 123);
    drawGrassTile(ctx2, 123);
    expect(ctx1.fillRectCalls).toEqual(ctx2.fillRectCalls);
  });
});

describe("drawIronOreDeposit", () => {
  for (const stage of STAGES) {
    it(`should render ${stage} stage`, () => {
      const ctx = createMockContext();
      drawIronOreDeposit(ctx, 42, stage);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
      for (const call of ctx.fillRectCalls) {
        expect(call.x).toBeGreaterThanOrEqual(0);
        expect(call.y).toBeGreaterThanOrEqual(0);
        expect(call.x + call.w).toBeLessThanOrEqual(32);
        expect(call.y + call.h).toBeLessThanOrEqual(32);
      }
    });
  }

  it("should have distinct visuals across stages", () => {
    const richCtx = createMockContext();
    const depletedCtx = createMockContext();
    drawIronOreDeposit(richCtx, 42, "rich");
    drawIronOreDeposit(depletedCtx, 42, "depleted");
    expect(richCtx.fillRectCalls.length).toBeGreaterThan(depletedCtx.fillRectCalls.length);
  });
});

describe("drawCopperOreDeposit", () => {
  for (const stage of STAGES) {
    it(`should render ${stage} stage`, () => {
      const ctx = createMockContext();
      drawCopperOreDeposit(ctx, 42, stage);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    });
  }
});

describe("drawCoalDeposit", () => {
  for (const stage of STAGES) {
    it(`should render ${stage} stage`, () => {
      const ctx = createMockContext();
      drawCoalDeposit(ctx, 42, stage);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    });
  }

  it("should keep all non-outline channels < 100 for coal", () => {
    const ctx = createMockContext();
    drawCoalDeposit(ctx, 42, "rich");
    for (const style of ctx.getUniqueFillStyles()) {
      const match = style.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match && match[1]) {
        const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
        if (r >= 50 || g >= 50 || b >= 50) { // Skip outline
          expect(r).toBeLessThan(100);
          expect(g).toBeLessThan(100);
          expect(b).toBeLessThan(100);
        }
      }
    }
  });
});

describe("drawSilicaSandDeposit", () => {
  for (const stage of STAGES) {
    it(`should render ${stage} stage`, () => {
      const ctx = createMockContext();
      drawSilicaSandDeposit(ctx, 42, stage);
      expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
    });
  }

  it("should keep non-outline channels > 150 for silica sand", () => {
    const ctx = createMockContext();
    drawSilicaSandDeposit(ctx, 42, "rich");
    for (const style of ctx.getUniqueFillStyles()) {
      const match = style.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match && match[1]) {
        const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
        if (!(r < 50 && g < 50 && b < 50)) { // Skip outline
          expect(r > 150 || g > 150 || b > 150).toBe(true);
        }
      }
    }
  });
});

describe("Ore Deposit Color Distinction", () => {
  it("should have all four ore types use distinct primary colors", () => {
    const contexts = [
      { type: "iron_ore" as const, ctx: createMockContext() },
      { type: "copper_ore" as const, ctx: createMockContext() },
      { type: "coal" as const, ctx: createMockContext() },
      { type: "silica_sand" as const, ctx: createMockContext() },
    ];

    for (const { type, ctx } of contexts) {
      switch (type) {
        case "iron_ore": drawIronOreDeposit(ctx, 42, "rich"); break;
        case "copper_ore": drawCopperOreDeposit(ctx, 42, "rich"); break;
        case "coal": drawCoalDeposit(ctx, 42, "rich"); break;
        case "silica_sand": drawSilicaSandDeposit(ctx, 42, "rich"); break;
      }
    }

    const primaryColors = new Map<string, string>();
    for (const { type, ctx } of contexts) {
      const counts = ctx.getFillStyleCounts();
      let maxCount = 0, primaryColor = "";
      for (const [color, count] of counts) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match && match[1]) {
          const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
          if (r < 50 && g < 50 && b < 50) continue;
        }
        if (count > maxCount) { maxCount = count; primaryColor = color; }
      }
      primaryColors.set(type, primaryColor);
    }
    expect(new Set(primaryColors.values()).size).toBe(4);
  });

  it("should render iron ore with larger chunks than coal", () => {
    const ctxIron = createMockContext();
    const ctxCoal = createMockContext();
    drawIronOreDeposit(ctxIron, 42, "rich");
    drawCoalDeposit(ctxCoal, 42, "rich");
    const ironAvgSize = ctxIron.fillRectCalls.reduce((sum: number, c: any) => sum + c.w * c.h, 0) / ctxIron.fillRectCalls.length;
    const coalAvgSize = ctxCoal.fillRectCalls.reduce((sum: number, c: any) => sum + c.w * c.h, 0) / ctxCoal.fillRectCalls.length;
    expect(ironAvgSize).toBeGreaterThan(coalAvgSize);
  });
});

describe("Deterministic Rendering", () => {
  it("should produce identical output for same deposit and seed", () => {
    for (const depositType of DEPOSIT_TYPES) {
      const ctx1 = createMockContext();
      const ctx2 = createMockContext();
      switch (depositType) {
        case "iron_ore": drawIronOreDeposit(ctx1, 999, "rich"); drawIronOreDeposit(ctx2, 999, "rich"); break;
        case "copper_ore": drawCopperOreDeposit(ctx1, 999, "rich"); drawCopperOreDeposit(ctx2, 999, "rich"); break;
        case "coal": drawCoalDeposit(ctx1, 999, "rich"); drawCoalDeposit(ctx2, 999, "rich"); break;
        case "silica_sand": drawSilicaSandDeposit(ctx1, 999, "rich"); drawSilicaSandDeposit(ctx2, 999, "rich"); break;
      }
      expect(ctx1.fillRectCalls).toEqual(ctx2.fillRectCalls);
    }
  });
});
