// Tests for terrain and ore deposit rendering with mock CanvasRenderingContext2D
import { describe, it, expect, vi } from "vitest";
import type { MaterialId } from "../../src/sim/types";
import {
  drawGrassTile,
  drawIronOreDeposit,
  drawCopperOreDeposit,
  drawCoalDeposit,
  drawSilicaSandDeposit,
} from "../../src/game/sprites/terrain";
import { getDepositColor } from "../../src/game/palette";

// ============================================================================
// Mock Canvas Implementation
// ============================================================================

interface FillStyleRecord {
  color: string;
  count: number;
}

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
    for (const call of this.fillRectCalls) {
      counts.set(call.fillStyle, (counts.get(call.fillStyle) || 0) + 1);
    }
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

// ============================================================================
// Test Constants
// ============================================================================

const DEPOSIT_TYPES: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];

// ============================================================================
// Grass Tile Tests
// ============================================================================

describe("drawGrassTile", () => {
  it("should render a 32x32 grass tile deterministically", () => {
    const ctx = createMockContext();
    drawGrassTile(ctx, 42);

    // Should fill entire 32x32 area (1024 pixels minimum)
    expect(ctx.fillRectCalls.length).toBeGreaterThanOrEqual(1024);

    // All calls should be within 32x32 bounds
    for (const call of ctx.fillRectCalls) {
      expect(call.x).toBeGreaterThanOrEqual(0);
      expect(call.y).toBeGreaterThanOrEqual(0);
      expect(call.x + call.w).toBeLessThanOrEqual(32);
      expect(call.y + call.h).toBeLessThanOrEqual(32);
    }
  });

  it("should use multiple shades of green for natural appearance", () => {
    const ctx = createMockContext();
    drawGrassTile(ctx, 42);

    const uniqueStyles = ctx.getUniqueFillStyles();
    // Should have at least 2-3 different green shades (base + accents)
    expect(uniqueStyles.size).toBeGreaterThanOrEqual(2);

    // All colors should be in rgb() format
    for (const style of uniqueStyles) {
      expect(style).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    }
  });

  it("should produce deterministic output for same seed", () => {
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    drawGrassTile(ctx1, 123);
    drawGrassTile(ctx2, 123);

    expect(ctx1.fillRectCalls).toEqual(ctx2.fillRectCalls);
  });

  it("should produce different output for different seeds", () => {
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    drawGrassTile(ctx1, 100);
    drawGrassTile(ctx2, 200);

    expect(ctx1.fillRectCalls).not.toEqual(ctx2.fillRectCalls);
  });
});

// ============================================================================
// Ore Deposit Tests
// ============================================================================

describe("drawIronOreDeposit", () => {
  it("should render iron ore deposit with steel-blue color", () => {
    const ctx = createMockContext();
    drawIronOreDeposit(ctx, 42);

    const uniqueStyles = ctx.getUniqueFillStyles();
    expect(uniqueStyles.size).toBeGreaterThan(1);

    // Should contain steel-blue-ish colors from DEPOSIT_PALETTE
    const expectedColor = getDepositColor("iron_ore").css;
    // Normalize expected color (remove spaces) to match terrain.ts formatting
    const normalizedExpected = expectedColor.replace(/\s+/g, "");
    const stylesArray: string[] = Array.from(uniqueStyles);
    expect(stylesArray.some((s) => s.replace(/\s+/g, "") === normalizedExpected)).toBe(true);
  });

  it("should render larger mineral chunks (2-4px)", () => {
    const ctx = createMockContext();
    drawIronOreDeposit(ctx, 42);

    // Check that some chunks are larger than 1x1
    const hasLargerChunks = ctx.fillRectCalls.some(
      (c: { x: number; y: number; w: number; h: number; fillStyle: string }) => c.w >= 2 || c.h >= 2
    );
    expect(hasLargerChunks).toBe(true);
  });

  it("should have distinct fillStyle colors from copper ore", () => {
    const ctxIron = createMockContext();
    const ctxCopper = createMockContext();

    drawIronOreDeposit(ctxIron, 42);
    drawCopperOreDeposit(ctxCopper, 42);

    const ironStyles = ctxIron.getUniqueFillStyles();
    const copperStyles = ctxCopper.getUniqueFillStyles();

    // Iron uses steel-blue, copper uses copper-orange - should be mostly distinct
    const intersection = [...ironStyles].filter((s) => copperStyles.has(s));
    // Allow some overlap for highlights/shadows but not all colors
    expect(intersection.length).toBeLessThan(ironStyles.size);
  });
});

describe("drawCopperOreDeposit", () => {
  it("should render copper ore deposit with warm orange color", () => {
    const ctx = createMockContext();
    drawCopperOreDeposit(ctx, 42);

    const uniqueStyles = ctx.getUniqueFillStyles();
    expect(uniqueStyles.size).toBeGreaterThan(1);

    // Should contain copper-orange-ish colors from DEPOSIT_PALETTE
    const expectedColor = getDepositColor("copper_ore").css;
    // Normalize expected color (remove spaces) to match terrain.ts formatting
    const normalizedExpected = expectedColor.replace(/\s+/g, "");
    const stylesArray: string[] = Array.from(uniqueStyles);
    expect(stylesArray.some((s) => s.replace(/\s+/g, "") === normalizedExpected)).toBe(true);
  });

  it("should render medium-sized irregular chunks (1-3px)", () => {
    const ctx = createMockContext();
    drawCopperOreDeposit(ctx, 42);

    // Should have varied chunk sizes
    const sizes = new Set(ctx.fillRectCalls.map((c: { x: number; y: number; w: number; h: number; fillStyle: string }) => `${c.w}x${c.h}`));
    expect(sizes.size).toBeGreaterThan(1);
  });
});

describe("drawCoalDeposit", () => {
  it("should render coal deposit with deep charcoal color", () => {
    const ctx = createMockContext();
    drawCoalDeposit(ctx, 42);

    const uniqueStyles = ctx.getUniqueFillStyles();
    expect(uniqueStyles.size).toBeGreaterThan(1);

    // Should contain deep charcoal colors from DEPOSIT_PALETTE
    const expectedColor = getDepositColor("coal").css;
    // Normalize expected color (remove spaces) to match terrain.ts formatting
    const normalizedExpected = expectedColor.replace(/\s+/g, "");
    const stylesArray: string[] = Array.from(uniqueStyles);
    expect(stylesArray.some((s) => s.replace(/\s+/g, "") === normalizedExpected)).toBe(true);
  });

  it("should use predominantly dark colors", () => {
    const ctx = createMockContext();
    drawCoalDeposit(ctx, 42);

    const uniqueStyles = ctx.getUniqueFillStyles();
    for (const style of uniqueStyles) {
      const match = style.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        // All channels should be relatively low (dark color)
        expect(r).toBeLessThan(100);
        expect(g).toBeLessThan(100);
        expect(b).toBeLessThan(100);
      }
    }
  });
});

describe("drawSilicaSandDeposit", () => {
  it("should render silica sand deposit with pale warm sand color", () => {
    const ctx = createMockContext();
    drawSilicaSandDeposit(ctx, 42);

    const uniqueStyles = ctx.getUniqueFillStyles();
    expect(uniqueStyles.size).toBeGreaterThan(1);

    // Should contain pale sand colors from DEPOSIT_PALETTE
    const expectedColor = getDepositColor("silica_sand").css;
    // Normalize expected color (remove spaces) to match terrain.ts formatting
    const normalizedExpected = expectedColor.replace(/\s+/g, "");
    const stylesArray: string[] = Array.from(uniqueStyles);
    expect(stylesArray.some((s) => s.replace(/\s+/g, "") === normalizedExpected)).toBe(true);
  });

  it("should use predominantly light colors", () => {
    const ctx = createMockContext();
    drawSilicaSandDeposit(ctx, 42);

    const uniqueStyles = ctx.getUniqueFillStyles();
    // Filter out outline (near-black) and shadow colors, check base/highlight colors
    const nonOutlineStyles = Array.from(uniqueStyles as Set<string>).filter((style: string) => {
      const match = style.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match || !match[1] || !match[2] || !match[3]) return true;
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      // Exclude near-black outline (all channels < 50)
      return !(r < 50 && g < 50 && b < 50);
    });
    
    // Remaining colors should be light (at least one channel > 150)
    for (const style of nonOutlineStyles as string[]) {
      const match = style.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        // At least one channel should be high (light color)
        expect(r > 150 || g > 150 || b > 150).toBe(true);
      }
    }
  });
});

// ============================================================================
// Cross-Ore Distinction Tests
// ============================================================================

describe("Ore Deposit Color Distinction", () => {
  it("should have all four ore types use distinct primary colors", () => {
    const ctxIron = createMockContext();
    const ctxCopper = createMockContext();
    const ctxCoal = createMockContext();
    const ctxSand = createMockContext();

    drawIronOreDeposit(ctxIron, 42);
    drawCopperOreDeposit(ctxCopper, 42);
    drawCoalDeposit(ctxCoal, 42);
    drawSilicaSandDeposit(ctxSand, 42);

    const contexts = [
      { type: "iron_ore" as const, ctx: ctxIron },
      { type: "copper_ore" as const, ctx: ctxCopper },
      { type: "coal" as const, ctx: ctxCoal },
      { type: "silica_sand" as const, ctx: ctxSand },
    ];

    const primaryColors = new Map<string, string>();
    
    // Get most frequent non-outline color (primary deposit color) for each ore
    for (const { type, ctx } of contexts) {
      const counts = ctx.getFillStyleCounts();
      let maxCount = 0;
      let primaryColor = "";
      for (const [color, count] of counts) {
        // Skip near-black outline color (all channels < 50)
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match && match[1] && match[2] && match[3]) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          if (r < 50 && g < 50 && b < 50) continue; // Skip outline
        }
        if (count > maxCount) {
          maxCount = count;
          primaryColor = color;
        }
      }
      primaryColors.set(type, primaryColor);
    }

    // All primary colors should be distinct
    const uniquePrimaryColors = new Set(primaryColors.values());
    expect(uniquePrimaryColors.size).toBe(4);
  });

  it("should render each ore type with characteristic chunk patterns", () => {
    const ctxIron = createMockContext();
    const ctxCopper = createMockContext();
    const ctxCoal = createMockContext();
    const ctxSand = createMockContext();

    drawIronOreDeposit(ctxIron, 42);
    drawCopperOreDeposit(ctxCopper, 42);
    drawCoalDeposit(ctxCoal, 42);
    drawSilicaSandDeposit(ctxSand, 42);

    // Iron: fewer, larger chunks
    const ironAvgSize = ctxIron.fillRectCalls.reduce(
      (sum: number, c: { x: number; y: number; w: number; h: number; fillStyle: string }) => sum + c.w * c.h, 0
    ) / ctxIron.fillRectCalls.length;
    
    // Coal: more numerous, smaller chunks
    const coalAvgSize = ctxCoal.fillRectCalls.reduce(
      (sum: number, c: { x: number; y: number; w: number; h: number; fillStyle: string }) => sum + c.w * c.h, 0
    ) / ctxCoal.fillRectCalls.length;

    // Iron chunks should be larger on average
    expect(ironAvgSize).toBeGreaterThan(coalAvgSize);
  });
});

// ============================================================================
// Determinism Tests
// ============================================================================

describe("Deterministic Rendering", () => {
  it("should produce identical output for same deposit type and seed", () => {
    for (const depositType of DEPOSIT_TYPES) {
      const ctx1 = createMockContext();
      const ctx2 = createMockContext();

      switch (depositType) {
        case "iron_ore":
          drawIronOreDeposit(ctx1, 999);
          drawIronOreDeposit(ctx2, 999);
          break;
        case "copper_ore":
          drawCopperOreDeposit(ctx1, 999);
          drawCopperOreDeposit(ctx2, 999);
          break;
        case "coal":
          drawCoalDeposit(ctx1, 999);
          drawCoalDeposit(ctx2, 999);
          break;
        case "silica_sand":
          drawSilicaSandDeposit(ctx1, 999);
          drawSilicaSandDeposit(ctx2, 999);
          break;
      }

      expect(ctx1.fillRectCalls).toEqual(ctx2.fillRectCalls);
    }
  });
});
