// Game color palettes for 32x32 pixel-art rendering
// Strictly separated colors for terrain, deposits, buildings, and materials
// 4-layer Figure-Ground visibility hierarchy with industrial color scheme

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
// Shading Palette (common shading tokens)
// ============================================================================

export const SHADING_PALETTE = {
  outline: { hex: "#1A1A1A", css: "rgb(26, 26, 26)" },           // Near-black outline
  highlight: { hex: "#E8E8E8", css: "rgb(232, 232, 232)" },      // Light highlight
  shadow: { hex: "#4A4A4A", css: "rgb(74, 74, 74)" },            // Mid shadow
  dropShadow: { hex: "#2D2D2D", css: "rgb(45, 45, 45)" },        // Drop shadow
  metalLight: { hex: "#C0C0C0", css: "rgb(192, 192, 192)" },     // Light metal
  metalMid: { hex: "#808080", css: "rgb(128, 128, 128)" },       // Mid metal
  metalDark: { hex: "#505050", css: "rgb(80, 80, 80)" },         // Dark metal
  alertRed: { hex: "#C70039", css: "rgb(199, 0, 57)" },          // Industrial alert red
  alertAmber: { hex: "#FF9F1C", css: "rgb(255, 159, 28)" },      // Warning amber
  statusGreen: { hex: "#2EC4B6", css: "rgb(46, 196, 182)" },     // Status green (teal-toned)
};

// ============================================================================
// Terrain Palettes (Layer 1: low saturation, calm industrial tones)
// ============================================================================

export const TERRAIN_PALETTE: TerrainPalette = {
  grass: { hex: "#3F6238", css: "rgb(63, 98, 56)" },             // Olive-moss green (industrial)
  rock: { hex: "#5A6068", css: "rgb(90, 96, 104)" },             // Weathered dark slate
  water: { hex: "#245B7A", css: "rgb(36, 91, 122)" },            // Deep industrial blue-teal
};

// ============================================================================
// Ore Deposit Palettes (Layer 2: distinct mineral colors, clearly visible from terrain)
// ============================================================================

export const DEPOSIT_PALETTE: DepositPalette = {
  iron_ore: { hex: "#4A5F6F", css: "rgb(74, 95, 111)" },         // Cool steel blue-silver
  copper_ore: { hex: "#B85C38", css: "rgb(184, 92, 56)" },       // Warm red-copper orange
  coal: { hex: "#1C1F24", css: "rgb(28, 31, 36)" },              // Jet charcoal black
  silica_sand: { hex: "#E5D4A8", css: "rgb(229, 212, 168)" },    // Bright warm beige
  iron_plate: { hex: "#B5BCC4", css: "rgb(181, 188, 196)" },    // Silver-gray plate
  copper_plate: { hex: "#A0522D", css: "rgb(160, 82, 45)" },     // Rich copper brown
  iron_gear: { hex: "#6B757A", css: "rgb(107, 117, 122)" },      // Gunmetal gray gear
  copper_wire: { hex: "#CD7F32", css: "rgb(205, 127, 50)" },     // Bronze copper wire
  steel_plate: { hex: "#5C6B77", css: "rgb(92, 107, 119)" },     // Slate steel plate
  silicon_wafer: { hex: "#5DADE2", css: "rgb(93, 173, 226)" },   // Silicate blue wafer
  circuit_board: { hex: "#2D5016", css: "rgb(45, 80, 22)" },     // Forest green PCB
  microchip: { hex: "#B8860B", css: "rgb(184, 134, 11)" },       // Dark gold chip
  automation_module: { hex: "#485C7A", css: "rgb(72, 92, 122)" }, // Steel blue module
  slag: { hex: "#3D3D3D", css: "rgb(61, 61, 61)" },              // Dark gray slag
};

// ============================================================================
// Building Palettes (Layer 3: industrial functional accent colors)
// ============================================================================

export const BUILDING_PALETTE: BuildingPalette = {
  miner: { hex: "#3B5998", css: "rgb(59, 89, 152)" },            // Industrial navy blue
  belt: { hex: "#654321", css: "rgb(101, 67, 33)" },             // Dark brown belt
  splitter: { hex: "#800080", css: "rgb(128, 0, 128)" },         // Deep purple splitter
  filter_splitter: { hex: "#D2691E", css: "rgb(210, 105, 30)" }, // Chocolate filter
  underground_belt: { hex: "#4682B4", css: "rgb(70, 130, 180)" }, // Steel blue underbelt
  smelter: { hex: "#B22222", css: "rgb(178, 34, 34)" },          // Firebrick red smelter
  assembler: { hex: "#228B22", css: "rgb(34, 139, 34)" },        // Forest green assembler
  recycler: { hex: "#556B2F", css: "rgb(85, 107, 47)" },         // Dark olive green recycler
  sensor: { hex: "#483D8B", css: "rgb(72, 61, 139)" },           // Dark slate blue sensor
  hub: { hex: "#8B0000", css: "rgb(139, 0, 0)" },                // Dark red hub
};

// ============================================================================
// Material Item Palettes (Layer 4: high contrast for belt items)
// ============================================================================

export const MATERIAL_PALETTE: MaterialPalette = {
  iron_ore: { hex: "#6B5B4F", css: "rgb(107, 91, 79)" },         // Brown-gray iron ore
  copper_ore: { hex: "#8B4513", css: "rgb(139, 69, 19)" },       // Saddle brown copper ore
  coal: { hex: "#2F2F2F", css: "rgb(47, 47, 47)" },              // Charcoal coal
  silica_sand: { hex: "#F5DEB3", css: "rgb(245, 222, 179)" },    // Wheat sand
  iron_plate: { hex: "#D3D3D3", css: "rgb(211, 211, 211)" },     // Light gray plate
  copper_plate: { hex: "#CD853F", css: "rgb(205, 133, 63)" },    // Peru copper plate
  iron_gear: { hex: "#778899", css: "rgb(119, 136, 153)" },      // Light steel blue gear
  copper_wire: { hex: "#B87333", css: "rgb(184, 115, 51)" },     // Copper wire
  steel_plate: { hex: "#708090", css: "rgb(112, 128, 144)" },    // Slate gray steel
  silicon_wafer: { hex: "#AFEEEE", css: "rgb(175, 238, 238)" },  // Pale turquoise wafer
  circuit_board: { hex: "#006400", css: "rgb(0, 100, 0)" },      // Dark green PCB
  microchip: { hex: "#FFD700", css: "rgb(255, 215, 0)" },        // Gold microchip
  automation_module: { hex: "#6A5ACD", css: "rgb(106, 90, 205)" }, // Slate blue module
  slag: { hex: "#696969", css: "rgb(105, 105, 105)" },           // Dim gray slag
};

// ============================================================================
// UI/Fault Indicators (high contrast, non-neon)
// ============================================================================

export const UI_PALETTE = {
  fault: { hex: "#DC143C", css: "rgb(220, 20, 60)" },            // Crimson fault
  warning: { hex: "#FF8C00", css: "rgb(255, 140, 0)" },          // Dark orange warning
  success: { hex: "#2E8B57", css: "rgb(46, 139, 87)" },          // Sea green success
  info: { hex: "#1E90FF", css: "rgb(30, 144, 255)" },            // Dodger blue info
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
