// Procedural 32x32 CanvasTexture registration for Phaser game
// Uses existing sprite drawers from src/game/sprites/{terrain,buildings,items}.ts

import type { Scene } from "phaser";
import type { TerrainType, MaterialId, BuildingType, Direction } from "../sim/types";
import {
  drawGrassTile,
  drawRockTile,
  drawWaterTile,
  drawIronOreDeposit,
  drawCopperOreDeposit,
  drawCoalDeposit,
  drawSilicaSandDeposit,
  getTerrainTextureKey,
  getDepositTextureKey,
  TERRAIN_VARIANT_COUNTS,
  DEPOSIT_STAGES,
} from "./sprites/terrain";
import {
  drawBuilding,
  getBuildingTextureKey,
} from "./sprites/buildings";
import {
  drawItemSprite,
  getItemTextureKey,
} from "./sprites/items";
import {
  drawWaterEdgeOverlay,
  drawRockEdgeOverlay,
  getWaterEdgeTextureKey,
  getRockEdgeTextureKey,
} from "./sprites/terrainEdges";

// ============================================================================
// Texture Registration
// ============================================================================

/** Register all procedural 32x32 CanvasTextures in the given scene */
export function registerAllTextures(scene: Scene): void {
  const textures = scene.textures;

  // Register terrain textures (grass, rock, water)
  registerTerrainTextures(textures);

  // Register edge overlay textures (water and rock edges for autotiling)
  registerEdgeTextures(textures);

  // Register ore deposit textures (iron_ore, copper_ore, coal, silica_sand)
  registerDepositTextures(textures);

  // Register building textures (all BuildingType × 4 directions × 2 frames × 2 fault states)
  registerBuildingTextures(textures);

  // Register item textures (all 14 MaterialId values)
  registerItemTextures(textures);
}

/** Register terrain base textures with all variants */
function registerTerrainTextures(textures: Phaser.Textures.TextureManager): void {
  const terrains: TerrainType[] = ["grass", "rock", "water"];
  
  for (const terrain of terrains) {
    const variantCount = TERRAIN_VARIANT_COUNTS[terrain];
    for (let v = 0; v < variantCount; v++) {
      const key = getTerrainTextureKey(terrain, v);
      const canvas = textures.createCanvas(key, 32, 32);
      if (!canvas) throw new Error(`Failed to create canvas: ${key}`);
      const ctx = canvas.getContext();
      
      if (terrain === "grass") {
        drawGrassTile(ctx, v);
      } else if (terrain === "rock") {
        drawRockTile(ctx, v);
      } else {
        drawWaterTile(ctx, v);
      }
      
      canvas.refresh();
    }
  }
}

/** Register edge overlay textures for water and rock autotiling */
function registerEdgeTextures(textures: Phaser.Textures.TextureManager): void {
  // Register water edge overlays for masks 1-15
  for (let mask = 1; mask <= 15; mask++) {
    const key = getWaterEdgeTextureKey(mask);
    const canvas = textures.createCanvas(key, 32, 32);
    if (!canvas) throw new Error(`Failed to create canvas: ${key}`);
    const ctx = canvas.getContext();
    drawWaterEdgeOverlay(ctx, mask);
    canvas.refresh();
  }
  
  // Register rock edge overlays for masks 1-15
  for (let mask = 1; mask <= 15; mask++) {
    const key = getRockEdgeTextureKey(mask);
    const canvas = textures.createCanvas(key, 32, 32);
    if (!canvas) throw new Error(`Failed to create canvas: ${key}`);
    const ctx = canvas.getContext();
    drawRockEdgeOverlay(ctx, mask);
    canvas.refresh();
  }
}

/** Register ore deposit textures with all stages */
function registerDepositTextures(textures: Phaser.Textures.TextureManager): void {
  const deposits: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];

  for (const deposit of deposits) {
    for (const stage of DEPOSIT_STAGES) {
      const key = getDepositTextureKey(deposit, 0, stage);
      const canvas = textures.createCanvas(key, 32, 32);
      if (!canvas) throw new Error(`Failed to create canvas: ${key}`);
      const ctx = canvas.getContext();

      switch (deposit) {
        case "iron_ore":
          drawIronOreDeposit(ctx, 0, stage);
          break;
        case "copper_ore":
          drawCopperOreDeposit(ctx, 0, stage);
          break;
        case "coal":
          drawCoalDeposit(ctx, 0, stage);
          break;
        case "silica_sand":
          drawSilicaSandDeposit(ctx, 0, stage);
          break;
      }

      canvas.refresh();
    }
  }
}

/** Register all building textures with directions, frames, and fault states */
function registerBuildingTextures(textures: Phaser.Textures.TextureManager): void {
  const buildingTypes: BuildingType[] = [
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
  const directions: Direction[] = ["N", "E", "S", "W"];
  const frames = [0, 1];
  const faultStates = [false, true];

  for (const type of buildingTypes) {
    const size = type === "hub" ? 64 : 32;
    for (const dir of directions) {
      for (const frame of frames) {
        for (const faulted of faultStates) {
          const baseKey = getBuildingTextureKey(type, dir, frame);
          const key = `${baseKey}_${faulted ? "faulted" : "ok"}`;
          const canvas = textures.createCanvas(key, size, size);
          if (!canvas) throw new Error(`Failed to create canvas: ${key}`);
          const ctx = canvas.getContext();
          drawBuilding(ctx, type, dir, frame, faulted);
          canvas.refresh();
        }
      }
    }
  }
}

/** Register all item textures (14 MaterialId values) */
function registerItemTextures(textures: Phaser.Textures.TextureManager): void {
  const materials: MaterialId[] = [
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

  for (const material of materials) {
    const key = getItemTextureKey(material);
    const canvas = textures.createCanvas(key, 32, 32);
    if (!canvas) throw new Error(`Failed to create canvas: ${key}`);
    const ctx = canvas.getContext();
    drawItemSprite(ctx, material);
    canvas.refresh();
  }
}

// ============================================================================
// Deterministic Key Helpers
// ============================================================================

/** Get all expected terrain texture keys */
export function getExpectedTerrainKeys(): string[] {
  const terrains: TerrainType[] = ["grass", "rock", "water"];
  const keys: string[] = [];
  
  for (const terrain of terrains) {
    const variantCount = TERRAIN_VARIANT_COUNTS[terrain];
    for (let v = 0; v < variantCount; v++) {
      keys.push(getTerrainTextureKey(terrain, v));
    }
  }
  
  return keys;
}

/** Get all expected deposit texture keys */
export function getExpectedDepositKeys(): string[] {
  const deposits: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];
  const keys: string[] = [];
  
  for (const deposit of deposits) {
    for (const stage of DEPOSIT_STAGES) {
      keys.push(getDepositTextureKey(deposit, 0, stage));
    }
  }
  
  return keys;
}

/** Get all expected edge texture keys */
export function getExpectedEdgeKeys(): string[] {
  const keys: string[] = [];
  
  // Water edge keys for masks 1-15
  for (let mask = 1; mask <= 15; mask++) {
    keys.push(getWaterEdgeTextureKey(mask));
  }
  
  // Rock edge keys for masks 1-15
  for (let mask = 1; mask <= 15; mask++) {
    keys.push(getRockEdgeTextureKey(mask));
  }
  
  return keys;
}

/** Get all expected building texture keys */
export function getExpectedBuildingKeys(): string[] {
  const buildingTypes: BuildingType[] = [
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
  const directions: Direction[] = ["N", "E", "S", "W"];
  const frames = [0, 1];
  const faultStates = [false, true];
  const keys: string[] = [];

  for (const type of buildingTypes) {
    for (const dir of directions) {
      for (const frame of frames) {
        for (const faulted of faultStates) {
          const baseKey = getBuildingTextureKey(type, dir, frame);
          keys.push(`${baseKey}_${faulted ? "faulted" : "ok"}`);
        }
      }
    }
  }

  return keys;
}

/** Get all expected item texture keys */
export function getExpectedItemKeys(): string[] {
  const materials: MaterialId[] = [
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
  return materials.map((m) => getItemTextureKey(m));
}

/** Get all expected texture keys combined */
export function getAllExpectedTextureKeys(): string[] {
  return [
    ...getExpectedTerrainKeys(),
    ...getExpectedEdgeKeys(),
    ...getExpectedDepositKeys(),
    ...getExpectedBuildingKeys(),
    ...getExpectedItemKeys(),
  ];
}

/** Count expected textures */
export function getExpectedTextureCount(): number {
  return getAllExpectedTextureKeys().length;
}
