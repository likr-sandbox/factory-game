// Game color palettes for 32x32 pixel-art rendering
// Strictly separated colors for terrain, deposits, buildings, and materials

import type { TerrainType, BuildingType, MaterialId } from "../sim/types";

// ============================================================================
// Palette Type Definitions
// ============================================================================

export interface PaletteEntry {
  hex: string;
  css: string;
}

export type TerrainPalette = Record<TerrainType, PaletteEntry>;
export type DepositPalette = Record<MaterialId, PaletteEntry>;
export type BuildingPalette = Record<BuildingType, PaletteEntry>;
export type MaterialPalette = Record<MaterialId, PaletteEntry>;

// ============================================================================
// Terrain Palettes (grass, rock, water)
// ============================================================================

export const TERRAIN_PALETTE: TerrainPalette = {
  grass: { hex: "#7CFC00", css: "rgb(124, 252, 0)" },     // Lawn green
  rock: { hex: "#808080", css: "rgb(128, 128, 128)" },     // Gray
  water: { hex: "#1E90FF", css: "rgb(30, 144, 255)" },     // Dodger blue
};

// ============================================================================
// Ore Deposit Palettes (distinct from terrain)
// ============================================================================

export const DEPOSIT_PALETTE: DepositPalette = {
  iron_ore: { hex: "#D2691E", css: "rgb(210, 105, 30)" },     // Chocolate
  copper_ore: { hex: "#CD853F", css: "rgb(205, 133, 63)" },   // Peru
  coal: { hex: "#2F4F4F", css: "rgb(47, 79, 79)" },           // Dark slate gray
  silica_sand: { hex: "#F0E68C", css: "rgb(240, 230, 140)" }, // Khaki
  // Processed materials use material palette, not deposit palette
  iron_plate: { hex: "#C0C0C0", css: "rgb(192, 192, 192)" },   // Silver
  copper_plate: { hex: "#B87333", css: "rgb(184, 115, 51)" },  // Copper
  iron_gear: { hex: "#A9A9A9", css: "rgb(169, 169, 169)" },    // Dark gray
  copper_wire: { hex: "#B22222", css: "rgb(178, 34, 34)" },    // Firebrick (red copper)
  steel_plate: { hex: "#708090", css: "rgb(112, 128, 144)" },  // Slate gray
  silicon_wafer: { hex: "#48D1CC", css: "rgb(72, 209, 204)" }, // Medium turquoise
  circuit_board: { hex: "#228B22", css: "rgb(34, 139, 34)" },  // Forest green
  microchip: { hex: "#FFD700", css: "rgb(255, 215, 0)" },      // Gold
  automation_module: { hex: "#9932CC", css: "rgb(153, 50, 204)" }, // Dark orchid
  slag: { hex: "#696969", css: "rgb(105, 105, 105)" },         // Dim gray
};

// ============================================================================
// Building Palettes (strictly distinct from terrain/deposits)
// ============================================================================

export const BUILDING_PALETTE: BuildingPalette = {
  miner: { hex: "#4169E1", css: "rgb(65, 105, 225)" },         // Royal blue
  belt: { hex: "#DA70D6", css: "rgb(218, 112, 214)" },         // Orchid
  splitter: { hex: "#FF6347", css: "rgb(255, 99, 71)" },       // Tomato
  filter_splitter: { hex: "#FF1493", css: "rgb(255, 20, 147)" }, // Deep pink
  underground_belt: { hex: "#00CED1", css: "rgb(0, 206, 209)" }, // Dark cyan
  smelter: { hex: "#DC143C", css: "rgb(220, 20, 60)" },        // Crimson
  assembler: { hex: "#32CD32", css: "rgb(50, 205, 50)" },      // Lime green
  recycler: { hex: "#BA55D3", css: "rgb(186, 85, 211)" },      // Medium orchid
  sensor: { hex: "#00FFFF", css: "rgb(0, 255, 255)" },         // Cyan
  hub: { hex: "#FF4500", css: "rgb(255, 69, 0)" },             // Orange red
};

// ============================================================================
// Material Item Palettes (for belt items, distinct from terrain)
// ============================================================================

export const MATERIAL_PALETTE: MaterialPalette = {
  iron_ore: { hex: "#8B4513", css: "rgb(139, 69, 19)" },       // Saddle brown
  copper_ore: { hex: "#A0522D", css: "rgb(160, 82, 45)" },     // Sienna
  coal: { hex: "#000000", css: "rgb(0, 0, 0)" },               // Black
  silica_sand: { hex: "#FFFACD", css: "rgb(255, 250, 205)" },  // Lemon chiffon
  iron_plate: { hex: "#E8E8E8", css: "rgb(232, 232, 232)" },   // Light gray
  copper_plate: { hex: "#D2691E", css: "rgb(210, 105, 30)" },  // Chocolate
  iron_gear: { hex: "#696969", css: "rgb(105, 105, 105)" },    // Dim gray
  copper_wire: { hex: "#B87333", css: "rgb(184, 115, 51)" },   // Copper
  steel_plate: { hex: "#A9A9A9", css: "rgb(169, 169, 169)" },  // Dark gray
  silicon_wafer: { hex: "#AFEEEE", css: "rgb(175, 238, 238)" }, // Pale turquoise
  circuit_board: { hex: "#006400", css: "rgb(0, 100, 0)" },    // Dark green
  microchip: { hex: "#FFE4C4", css: "rgb(255, 228, 196)" },    // Bisque
  automation_module: { hex: "#8A2BE2", css: "rgb(138, 43, 226)" }, // Blue violet
  slag: { hex: "#555555", css: "rgb(85, 85, 85)" },            // Dark gray
};

// ============================================================================
// UI/Fault Indicators
// ============================================================================

export const UI_PALETTE = {
  fault: { hex: "#FF0000", css: "rgb(255, 0, 0)" },           // Red
  warning: { hex: "#FFA500", css: "rgb(255, 165, 0)" },        // Orange
  success: { hex: "#00FF00", css: "rgb(0, 255, 0)" },          // Green
  info: { hex: "#0000FF", css: "rgb(0, 0, 255)" },             // Blue
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Get terrain color entry */
export function getTerrainColor(terrain: TerrainType): PaletteEntry {
  return TERRAIN_PALETTE[terrain];
}

/** Get deposit color entry */
export function getDepositColor(material: MaterialId): PaletteEntry {
  return DEPOSIT_PALETTE[material];
}

/** Get building color entry */
export function getBuildingColor(type: BuildingType): PaletteEntry {
  return BUILDING_PALETTE[type];
}

/** Get material item color entry */
export function getMaterialColor(material: MaterialId): PaletteEntry {
  return MATERIAL_PALETTE[material];
}
