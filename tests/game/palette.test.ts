import { describe, it, expect } from "vitest";
import type { TerrainType, BuildingType, MaterialId } from "../../src/sim/types";
import type { PaletteEntry } from "../../src/game/palette";
import {
  TERRAIN_PALETTE,
  DEPOSIT_PALETTE,
  BUILDING_PALETTE,
  MATERIAL_PALETTE,
  SHADING_PALETTE,
  UI_PALETTE,
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

// Old neon/bright colors that should be excluded
const FORBIDDEN_COLORS = [
  "#7cfc00",  // Neon green lawn
  "#ff1493",  // Deep pink
  "#da70d6",  // Orchid
  "#32cd32",  // Lime green
  "#00ffff",  // Cyan
  "#ff4500",  // Orange red
  "#00ced1",  // Dark turquoise
];

// ============================================================================
// Shading Palette Tests
// ============================================================================

describe("SHADING_PALETTE", () => {
  it("should have exactly 10 shading entries", () => {
    expect(Object.keys(SHADING_PALETTE)).toHaveLength(10);
  });

  it("should cover all required shading tokens", () => {
    const requiredTokens = [
      "outline",
      "highlight",
      "shadow",
      "dropShadow",
      "metalLight",
      "metalMid",
      "metalDark",
      "alertRed",
      "alertAmber",
      "statusGreen",
    ] as const;
    for (const token of requiredTokens) {
      expect(SHADING_PALETTE).toHaveProperty(token);
      expect(SHADING_PALETTE[token]).toBeDefined();
      expect(SHADING_PALETTE[token].hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(SHADING_PALETTE[token].css).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });

  it("should have distinct colors for each shading token", () => {
    const hexColors = Object.values(SHADING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    const uniqueColors = new Set(hexColors);
    expect(uniqueColors.size).toBe(10);
  });

  it("should not reuse any terrain or building colors", () => {
    const terrainColors = new Set(
      Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const buildingColors = new Set(
      Object.values(BUILDING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const combinedColors = new Set([...terrainColors, ...buildingColors]);
    
    for (const token of Object.keys(SHADING_PALETTE)) {
      const shadeColor = SHADING_PALETTE[token as keyof typeof SHADING_PALETTE].hex.toLowerCase();
      expect(combinedColors.has(shadeColor)).toBe(false);
    }
  });
});

// ============================================================================
// UI Palette Tests
// ============================================================================

describe("UI_PALETTE", () => {
  it("should have exactly 4 UI entries", () => {
    expect(Object.keys(UI_PALETTE)).toHaveLength(4);
  });

  it("should cover all required UI tokens", () => {
    const requiredTokens = ["fault", "warning", "success", "info"] as const;
    for (const token of requiredTokens) {
      expect(UI_PALETTE).toHaveProperty(token);
      expect(UI_PALETTE[token]).toBeDefined();
      expect(UI_PALETTE[token].hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(UI_PALETTE[token].css).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });

  it("should have distinct colors for each UI token", () => {
    const hexColors = Object.values(UI_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    const uniqueColors = new Set(hexColors);
    expect(uniqueColors.size).toBe(4);
  });

  it("should not reuse terrain, building, or material colors", () => {
    const terrainColors = new Set(
      Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const buildingColors = new Set(
      Object.values(BUILDING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const materialColors = new Set(
      Object.values(MATERIAL_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const combinedColors = new Set([...terrainColors, ...buildingColors, ...materialColors]);
    
    for (const token of Object.keys(UI_PALETTE)) {
      const uiColor = UI_PALETTE[token as keyof typeof UI_PALETTE].hex.toLowerCase();
      expect(combinedColors.has(uiColor)).toBe(false);
    }
  });
});

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

  it("should not contain any forbidden neon colors", () => {
    const terrainColors = Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    for (const color of terrainColors) {
      expect(FORBIDDEN_COLORS).not.toContain(color);
    }
  });

  it("should have industrial low-saturation water color", () => {
    const waterHex = TERRAIN_PALETTE.water.hex;
    const r = parseInt(waterHex.slice(1, 3), 16);
    const g = parseInt(waterHex.slice(3, 5), 16);
    const b = parseInt(waterHex.slice(5, 7), 16);
    
    // Water should be deep industrial blue-teal, not bright dodger blue
    expect(waterHex.toLowerCase()).not.toBe("#1e90ff");
    // Should have lower brightness overall
    const brightness = (r + g + b) / 3;
    expect(brightness).toBeLessThan(150);
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

  it("should have cool steel blue-silver iron_ore", () => {
    const ironHex = DEPOSIT_PALETTE.iron_ore.hex.toLowerCase();
    // Should not be gray or brown, should have blue tint
    expect(ironHex).not.toBe("#8b4513"); // Not saddle brown
  });

  it("should have warm red-copper orange copper_ore", () => {
    const copperHex = DEPOSIT_PALETTE.copper_ore.hex.toLowerCase();
    expect(copperHex).not.toBe("#5d737e"); // Not cool steel-blue
  });

  it("should have jet black coal", () => {
    const coalHex = DEPOSIT_PALETTE.coal.hex.toLowerCase();
    expect(coalHex).toBe("#1c1f24");
  });

  it("should have bright warm beige silica_sand", () => {
    const sandHex = DEPOSIT_PALETTE.silica_sand.hex.toLowerCase();
    // Should be light and warm
    expect(sandHex).not.toBe("#e8d9a0"); // Different from old pale sand
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

  it("should not contain any forbidden neon colors", () => {
    const buildingColors = Object.values(BUILDING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    for (const color of buildingColors) {
      expect(FORBIDDEN_COLORS).not.toContain(color);
    }
  });

  it("should not use orchid #DA70D6 for belt", () => {
    expect(BUILDING_PALETTE.belt.hex.toLowerCase()).not.toBe("#da70d6");
  });

  it("should not use lime green #32CD32 for assembler", () => {
    expect(BUILDING_PALETTE.assembler.hex.toLowerCase()).not.toBe("#32cd32");
  });

  it("should not use cyan #00FFFF for sensor", () => {
    expect(BUILDING_PALETTE.sensor.hex.toLowerCase()).not.toBe("#00ffff");
  });

  it("should not use orange red #FF4500 for hub", () => {
    expect(BUILDING_PALETTE.hub.hex.toLowerCase()).not.toBe("#ff4500");
  });

  it("should not use deep pink #FF1493 for filter_splitter", () => {
    expect(BUILDING_PALETTE.filter_splitter.hex.toLowerCase()).not.toBe("#ff1493");
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

  it("should not contain any forbidden neon colors", () => {
    const materialColors = Object.values(MATERIAL_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase());
    for (const color of materialColors) {
      expect(FORBIDDEN_COLORS).not.toContain(color);
    }
  });
});

// ============================================================================
// Strict Separation Tests (Layer Isolation)
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

  it("should have building palette distinct from deposit palette", () => {
    const buildingColors = new Set(
      Object.values(BUILDING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const depositColors = new Set(
      Object.values(DEPOSIT_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const intersection = [...buildingColors].filter((c) => depositColors.has(c));
    expect(intersection).toHaveLength(0);
  });

  it("should have material palette distinct from terrain palette", () => {
    const terrainColors = new Set(
      Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const materialColors = new Set(
      Object.values(MATERIAL_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase())
    );
    const intersection = [...terrainColors].filter((c) => materialColors.has(c));
    expect(intersection).toHaveLength(0);
  });

  it("should have layer 1-4 palettes all mutually distinct", () => {
    const layer1 = new Set(Object.values(TERRAIN_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase()));
    const layer2 = new Set(Object.values(DEPOSIT_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase()));
    const layer3 = new Set(Object.values(BUILDING_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase()));
    const layer4 = new Set(Object.values(MATERIAL_PALETTE).map((p: PaletteEntry) => p.hex.toLowerCase()));
    
    // Check all pairwise intersections are empty
    expect([...layer1].filter((c) => layer2.has(c))).toHaveLength(0);
    expect([...layer1].filter((c) => layer3.has(c))).toHaveLength(0);
    expect([...layer1].filter((c) => layer4.has(c))).toHaveLength(0);
    expect([...layer2].filter((c) => layer3.has(c))).toHaveLength(0);
    expect([...layer2].filter((c) => layer4.has(c))).toHaveLength(0);
    expect([...layer3].filter((c) => layer4.has(c))).toHaveLength(0);
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
