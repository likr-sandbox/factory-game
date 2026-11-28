// Building sprite dispatcher - re-exports from specialized modules
// Slim integration layer maintaining backward-compatible public API

import type { BuildingType, Direction } from "../../sim/types";
import { getBuildingColor } from "../palette";

// Import draw* functions from logistics, machines, and hub modules
import {
  drawBelt,
  drawSplitter,
  drawFilterSplitter,
  drawUndergroundBelt,
} from "./logistics";

import {
  drawMiner,
  drawSmelter,
  drawAssembler,
  drawRecycler,
  drawSensor,
} from "./machines";

import { drawHub } from "./hub";

// Re-export draw* functions for backward compatibility
export {
  drawBelt,
  drawSplitter,
  drawFilterSplitter,
  drawUndergroundBelt,
} from "./logistics";

export {
  drawMiner,
  drawSmelter,
  drawAssembler,
  drawRecycler,
  drawSensor,
} from "./machines";

export { drawHub } from "./hub";

/**
 * Get a unique texture key for a building variant.
 * Used for caching sprites in the game engine.
 */
export function getBuildingTextureKey(
  type: BuildingType,
  direction: Direction,
  frame: number
): string {
  return `${type}_${direction}_${frame}`;
}

/**
 * Generic building drawer dispatcher.
 * Routes to the appropriate draw* function based on building type.
 */
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  type: BuildingType,
  dir: Direction,
  frame: number,
  faulted: boolean
): void {
  switch (type) {
    case "miner":
      return drawMiner(ctx, dir, frame, faulted);
    case "belt":
      return drawBelt(ctx, dir, frame, faulted);
    case "splitter":
      return drawSplitter(ctx, dir, frame, faulted);
    case "filter_splitter":
      return drawFilterSplitter(ctx, dir, frame, faulted);
    case "underground_belt":
      return drawUndergroundBelt(ctx, dir, frame, faulted);
    case "smelter":
      return drawSmelter(ctx, dir, frame, faulted);
    case "assembler":
      return drawAssembler(ctx, dir, frame, faulted);
    case "recycler":
      return drawRecycler(ctx, dir, frame, faulted);
    case "sensor":
      return drawSensor(ctx, dir, frame, faulted);
    case "hub":
      return drawHub(ctx, dir, frame, faulted);
  }
}
