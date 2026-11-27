import { describe, it, expect } from "vitest";
import type { TerrainType, BuildingType, MaterialId } from "../../src/sim/types";
import type { PaletteEntry } from "../../src/game/palette";
import {
  TERRAIN_PALETTE,
  DEPOSIT_PALETTE,
  BUILDING_PALETTE,
  MATERIAL_PALETTE,
  getTerrainColor,
  getDepositColor,
  getBuildingColor,
  getMaterialColor,
} from "../../src/game/palette";

// ============================================================================
// Test Constants
// ============================================================================

const TERRAIN_TYPES: TerrainType[] = ["grass", "rock", "water"];
const BUILDING_TYPES: BuildingType[] = [
  "miner",
  "belt",
  "splitter",
  "filter_splitter",
  "underground_belt",
  "smelter",
  "assembler",
  "recycler",
  "sensor",
  "hub",
];
const MATERIAL_IDS: MaterialId[] = [
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

// ============================================================================
// Terrain Palette Tests
// ============================================================================

describe("TERRAIN_PALETTE", () => {
  it("should have exactly 3 terrain entries", () => {
    expect(Object.keys(TERRAIN_PALETTE)).toHaveLength(3);
  });

  it("should cover all TerrainType keys", () => {
    for (const terrain of TERRAIN_TYPES) {
      expect(TERRAIN_PALETTE).toHaveProperty(terrain);
      expect(TERRAIN_PALETTE[terrain]).toBeDefined();
      expect(TERRAIN_PALETTE[terrain].hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(TERRAIN_PALETTE[terrain].css).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });

  it("should have distinct colors for each terrain type", () => {
    const hexColors = Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    const uniqueColors = new Set(hexColors);
    expect(uniqueColors.size).toBe(3);
  });

  it("should have calm, non-neon grass color (green channel < 180)", () => {
    const grassHex = TERRAIN_PALETTE.grass.hex;
    // Extract RGB values from hex
    const r = parseInt(grassHex.slice(1, 3), 16);
    const g = parseInt(grassHex.slice(3, 5), 16);
    const b = parseInt(grassHex.slice(5, 7), 16);
    
    // Green channel should be muted (< 180) to avoid neon lawn green
    expect(g).toBeLessThan(180);
    
    // Also verify it's not the old neon green #7CFC00
    expect(grassHex.toLowerCase()).not.toBe("#7cfc00");
  });
});

// ============================================================================
// Deposit Palette Tests
// ============================================================================

describe("DEPOSIT_PALETTE", () => {
  it("should have exactly 14 deposit entries", () => {
    expect(Object.keys(DEPOSIT_PALETTE)).toHaveLength(14);
  });

  it("should cover all MaterialId keys", () => {
    for (const material of MATERIAL_IDS) {
      expect(DEPOSIT_PALETTE).toHaveProperty(material);
      expect(DEPOSIT_PALETTE[material]).toBeDefined();
      expect(DEPOSIT_PALETTE[material].hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(DEPOSIT_PALETTE[material].css).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });

  it("should have distinct colors for each deposit", () => {
    const hexColors = Object.values(DEPOSIT_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    const uniqueColors = new Set(hexColors);
    expect(uniqueColors.size).toBe(14);
  });

  it("should have iron_ore, copper_ore, coal, and silica_sand with distinct hex colors", () => {
    const keyOres: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];
    const oreColors = keyOres.map((m) => DEPOSIT_PALETTE[m].hex.toLowerCase());
    const uniqueOreColors = new Set(oreColors);
    expect(uniqueOreColors.size).toBe(4);
  });
});

// ============================================================================
// Building Palette Tests
// ============================================================================

describe("BUILDING_PALETTE", () => {
  it("should have exactly 10 building entries", () => {
    expect(Object.keys(BUILDING_PALETTE)).toHaveLength(10);
  });

  it("should cover all BuildingType keys", () => {
    for (const type of BUILDING_TYPES) {
      expect(BUILDING_PALETTE).toHaveProperty(type);
      expect(BUILDING_PALETTE[type]).toBeDefined();
      expect(BUILDING_PALETTE[type].hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(BUILDING_PALETTE[type].css).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });

  it("should have distinct colors for each building type", () => {
    const hexColors = Object.values(BUILDING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    const uniqueColors = new Set(hexColors);
    expect(uniqueColors.size).toBe(10);
  });
});

// ============================================================================
// Material Palette Tests
// ============================================================================

describe("MATERIAL_PALETTE", () => {
  it("should have exactly 14 material entries", () => {
    expect(Object.keys(MATERIAL_PALETTE)).toHaveLength(14);
  });

  it("should cover all MaterialId keys", () => {
    for (const material of MATERIAL_IDS) {
      expect(MATERIAL_PALETTE).toHaveProperty(material);
      expect(MATERIAL_PALETTE[material]).toBeDefined();
      expect(MATERIAL_PALETTE[material].hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(MATERIAL_PALETTE[material].css).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });

  it("should have distinct colors for each material", () => {
    const hexColors = Object.values(MATERIAL_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    const uniqueColors = new Set(hexColors);
    expect(uniqueColors.size).toBe(14);
  });
});

// ============================================================================
// Strict Separation Tests
// ============================================================================

describe("Palette Separation", () => {
  it("should not reuse terrain grass colors for buildings", () => {
    const grassColor = TERRAIN_PALETTE.grass.hex.toLowerCase();
    for (const building of BUILDING_TYPES) {
      expect(BUILDING_PALETTE[building].hex.toLowerCase()).not.toBe(grassColor);
    }
  });

  it("should not reuse terrain colors for materials", () => {
    const terrainColors = new Set(
      Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    for (const material of MATERIAL_IDS) {
      expect(terrainColors.has(MATERIAL_PALETTE[material].hex.toLowerCase())).toBe(false);
    }
  });

  it("should have terrain palette distinct from building palette", () => {
    const terrainColors = new Set(
      Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const buildingColors = new Set(
      Object.values(BUILDING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const intersection = [...terrainColors].filter((c) => buildingColors.has(c));
    expect(intersection).toHaveLength(0);
  });

  it("should have deposit palette distinct from terrain palette", () => {
    const terrainColors = new Set(
      Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const depositColors = new Set(
      Object.values(DEPOSIT_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const intersection = [...terrainColors].filter((c) => depositColors.has(c));
    expect(intersection).toHaveLength(0);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe("Helper Functions", () => {
  it("getTerrainColor should return valid entry for all terrain types", () => {
    for (const terrain of TERRAIN_TYPES) {
      const result = getTerrainColor(terrain);
      expect(result.hex).toBeDefined();
      expect(result.css).toBeDefined();
    }
  });

  it("getDepositColor should return valid entry for all material ids", () => {
    for (const material of MATERIAL_IDS) {
      const result = getDepositColor(material);
      expect(result.hex).toBeDefined();
      expect(result.css).toBeDefined();
    }
  });

  it("getBuildingColor should return valid entry for all building types", () => {
    for (const type of BUILDING_TYPES) {
      const result = getBuildingColor(type);
      expect(result.hex).toBeDefined();
      expect(result.css).toBeDefined();
    }
  });

  it("getMaterialColor should return valid entry for all material ids", () => {
    for (const material of MATERIAL_IDS) {
      const result = getMaterialColor(material);
      expect(result.hex).toBeDefined();
      expect(result.css).toBeDefined();
    }
  });
});
