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
} from "./sprites/terrain";
import {
  drawBuilding,
  getBuildingTextureKey,
} from "./sprites/buildings";
import {
  drawItemSprite,
  getItemTextureKey,
} from "./sprites/items";

// ============================================================================
// Texture Registration
// ============================================================================

/** Register all procedural 32x32 CanvasTextures in the given scene */
export function registerAllTextures(scene: Scene): void {
  const textures = scene.textures;

  // Register terrain textures (grass, rock, water)
  registerTerrainTextures(textures);

  // Register ore deposit textures (iron_ore, copper_ore, coal, silica_sand)
  registerDepositTextures(textures);

  // Register building textures (all BuildingType × 4 directions × 2 frames × 2 fault states)
  registerBuildingTextures(textures);

  // Register item textures (all 14 MaterialId values)
  registerItemTextures(textures);
}

/** Register terrain base textures */
function registerTerrainTextures(textures: Phaser.Textures.TextureManager): void {
  // Grass
  const grassKey = getTerrainTextureKey("grass", 0);
  const grassCanvas = textures.createCanvas(grassKey, 32, 32);
  if (!grassCanvas) throw new Error(`Failed to create canvas: ${grassKey}`);
  const grassCtx = grassCanvas.getContext();
  drawGrassTile(grassCtx, 0);
  grassCanvas.refresh();

  // Rock
  const rockKey = getTerrainTextureKey("rock", 0);
  const rockCanvas = textures.createCanvas(rockKey, 32, 32);
  if (!rockCanvas) throw new Error(`Failed to create canvas: ${rockKey}`);
  const rockCtx = rockCanvas.getContext();
  drawRockTile(rockCtx, 0);
  rockCanvas.refresh();

  // Water
  const waterKey = getTerrainTextureKey("water", 0);
  const waterCanvas = textures.createCanvas(waterKey, 32, 32);
  if (!waterCanvas) throw new Error(`Failed to create canvas: ${waterKey}`);
  const waterCtx = waterCanvas.getContext();
  drawWaterTile(waterCtx, 0);
  waterCanvas.refresh();
}

/** Register ore deposit textures */
function registerDepositTextures(textures: Phaser.Textures.TextureManager): void {
  const deposits: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];

  for (const deposit of deposits) {
    const key = getDepositTextureKey(deposit, 0);
    const canvas = textures.createCanvas(key, 32, 32);
    if (!canvas) throw new Error(`Failed to create canvas: ${key}`);
    const ctx = canvas.getContext();

    switch (deposit) {
      case "iron_ore":
        drawIronOreDeposit(ctx, 0);
        break;
      case "copper_ore":
        drawCopperOreDeposit(ctx, 0);
        break;
      case "coal":
        drawCoalDeposit(ctx, 0);
        break;
      case "silica_sand":
        drawSilicaSandDeposit(ctx, 0);
        break;
    }

    canvas.refresh();
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
    for (const dir of directions) {
      for (const frame of frames) {
        for (const faulted of faultStates) {
          const baseKey = getBuildingTextureKey(type, dir, frame);
          const key = `${baseKey}_${faulted ? "faulted" : "ok"}`;
          const canvas = textures.createCanvas(key, 32, 32);
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
  return terrains.map((t) => getTerrainTextureKey(t, 0));
}

/** Get all expected deposit texture keys */
export function getExpectedDepositKeys(): string[] {
  const deposits: MaterialId[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];
  return deposits.map((d) => getDepositTextureKey(d, 0));
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
    ...getExpectedDepositKeys(),
    ...getExpectedBuildingKeys(),
    ...getExpectedItemKeys(),
  ];
}

/** Count expected textures */
export function getExpectedTextureCount(): number {
  return getAllExpectedTextureKeys().length;
}
