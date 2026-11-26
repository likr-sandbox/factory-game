// Symmetric action engine for manual UI and WebMCP
// Pure headless TypeScript - ZERO imports of Phaser, window, document

import type { WorldState, Tile, BuildingState, ActionResult, ActionError, Direction } from "./types";
import type { PlaceBuildingInput, PlaceBeltLineInput, RemoveAreaInput, SetRecipeInput, BatchActionsInput, BatchActionItem } from "./types";
import { BUILDING_CATALOG } from "./catalog";
import { RECIPE_CATALOG } from "./catalog";
import { inBounds, getTile, isHubTile, directionDelta, oppositeDirection } from "./world";

// ============================================================================
// placeBuilding
// ============================================================================

export function placeBuilding(
  world: WorldState,
  input: PlaceBuildingInput
): ActionResult {
  const { x, y, type, direction, recipeId, filterMaterial } = input;

  // Check bounds
  if (!inBounds(world, x, y)) {
    return { success: false, error: { code: "OUT_OF_BOUNDS", message: `Position (${x},${y}) is out of bounds`, details: { x, y } } };
  }

  const tile = getTile(world, x, y)!;

  // Check terrain (no water/rock)
  if (tile.terrain === "water" || tile.terrain === "rock") {
    return { success: false, error: { code: "INVALID_TERRAIN", message: `Cannot place on ${tile.terrain}`, details: { x, y, terrain: tile.terrain } } };
  }

  // Check if already has a building
  if (tile.buildingId !== null) {
    return { success: false, error: { code: "OCCUPIED", message: `Tile (${x},${y}) already has building ${tile.buildingId}`, details: { x, y, buildingId: tile.buildingId } } };
  }

  // Check hub type (cannot place on hub tiles)
  if (isHubTile(world, x, y)) {
    return { success: false, error: { code: "HUB_PROTECTED", message: `Cannot place on hub tile`, details: { x, y } } };
  }

  // Miner must be placed on deposit with remaining > 0
  if (type === "miner") {
    if (!tile.deposit || tile.deposit.remaining <= 0) {
      return { success: false, error: { code: "NO_DEPOSIT", message: `Miner requires a deposit with remaining > 0`, details: { x, y } } };
    }
  }

  // Smelter/assembler require valid recipeId
  if ((type === "smelter" || type === "assembler") && !recipeId) {
    return { success: false, error: { code: "MISSING_RECIPE", message: `${type} requires a recipeId`, details: { x, y, type } } };
  }

  // Validate recipeId belongs to correct building type
  if (recipeId) {
    const recipe = RECIPE_CATALOG[recipeId];
    if (recipe && recipe.building !== type) {
      return { success: false, error: { code: "INVALID_RECIPE", message: `Recipe ${recipeId} is for ${recipe.building}, not ${type}`, details: { x, y, recipeId, type } } };
    }
  }

  // Create building state
  const buildingId = `b${world.nextBuildingId++}`;
  const building: BuildingState = {
    id: buildingId,
    type,
    x,
    y,
    direction,
    recipeId,
    filterMaterial,
    inputBuffer: {},
    outputBuffer: {},
    beltItems: [],
    craftProgress: 0,
    roundRobinIndex: 0,
    faulted: false,
    load: 0,
    idleTicks: 0,
    blockedTicks: 0,
  };

  world.buildings[buildingId] = building;
  tile.buildingId = buildingId;

  return { success: true, worldTick: world.tick, buildingId };
}

// ============================================================================
// placeBeltLine
// ============================================================================

export function placeBeltLine(
  world: WorldState,
  input: PlaceBeltLineInput
): ActionResult {
  const { startX, startY, endX, endY, cornerFirst = "x" } = input;

  // Compute L-shaped path using Manhattan distance
  const path: { x: number; y: number }[] = [];
  
  let curX = startX;
  let curY = startY;

  // First segment: go along cornerFirst axis to reach target's coordinate
  if (cornerFirst === "x") {
    // Go X first, then Y
    while (curX !== endX) {
      path.push({ x: curX, y: curY });
      curX += curX < endX ? 1 : -1;
    }
    while (curY !== endY) {
      path.push({ x: curX, y: curY });
      curY += curY < endY ? 1 : -1;
    }
  } else {
    // Go Y first, then X
    while (curY !== endY) {
      path.push({ x: curX, y: curY });
      curY += curY < endY ? 1 : -1;
    }
    while (curX !== endX) {
      path.push({ x: curX, y: curY });
      curX += curX < endX ? 1 : -1;
    }
  }
  // Add final tile
  path.push({ x: endX, y: endY });

  // Validate all tiles in path first (before any placement)
  const newBuildings: BuildingState[] = [];
  const placedIds: string[] = [];

  for (let i = 0; i < path.length; i++) {
    const { x, y } = path[i]!;

    // Check bounds
    if (!inBounds(world, x, y)) {
      // Rollback: remove all placed buildings
      for (const id of placedIds) {
        delete world.buildings[id];
      }
      // Reset any modified tiles
      for (const b of newBuildings) {
        const t = getTile(world, b.x, b.y);
        if (t) t.buildingId = null;
      }
      return { success: false, error: { code: "OUT_OF_BOUNDS", message: `Path tile (${x},${y}) is out of bounds`, details: { x, y } } };
    }

    const tile = getTile(world, x, y)!;

    // Check terrain
    if (tile.terrain === "water" || tile.terrain === "rock") {
      for (const id of placedIds) {
        delete world.buildings[id];
      }
      for (const b of newBuildings) {
        const t = getTile(world, b.x, b.y);
        if (t) t.buildingId = null;
      }
      return { success: false, error: { code: "INVALID_TERRAIN", message: `Path tile (${x},${y}) has invalid terrain ${tile.terrain}`, details: { x, y, terrain: tile.terrain } } };
    }

    // Check if occupied by existing building (not one we just placed)
    if (tile.buildingId !== null && !placedIds.includes(tile.buildingId)) {
      for (const id of placedIds) {
        delete world.buildings[id];
      }
      for (const b of newBuildings) {
        const t = getTile(world, b.x, b.y);
        if (t) t.buildingId = null;
      }
      return { success: false, error: { code: "COLLISION", message: `Path tile (${x},${y}) is occupied by building ${tile.buildingId}`, details: { x, y, buildingId: tile.buildingId } } };
    }
  }

  // All validations passed, now place belts with directions
  for (let i = 0; i < path.length; i++) {
    const { x, y } = path[i]!;
    const tile = getTile(world, x, y)!;

    // Determine direction toward next tile in path
    let direction: Direction;
    if (i < path.length - 1) {
      const next = path[i + 1]!;
      const dx = next.x - x;
      const dy = next.y - y;
      if (dx === 1) direction = "E";
      else if (dx === -1) direction = "W";
      else if (dy === 1) direction = "S";
      else direction = "N";
    } else {
      // Last tile keeps previous segment's direction or defaults to E
      if (i > 0) {
        const prev = path[i - 1]!;
        const dx = x - prev.x;
        const dy = y - prev.y;
        if (dx === 1) direction = "E";
        else if (dx === -1) direction = "W";
        else if (dy === 1) direction = "S";
        else direction = "N";
      } else {
        direction = "E";
      }
    }

    const buildingId = `b${world.nextBuildingId++}`;
    const building: BuildingState = {
      id: buildingId,
      type: "belt",
      x,
      y,
      direction,
      inputBuffer: {},
      outputBuffer: {},
      beltItems: [],
      craftProgress: 0,
      roundRobinIndex: 0,
      faulted: false,
      load: 0,
      idleTicks: 0,
      blockedTicks: 0,
    };

    world.buildings[buildingId] = building;
    tile.buildingId = buildingId;
    newBuildings.push(building);
    placedIds.push(buildingId);
  }

  return { success: true, worldTick: world.tick, buildingId: placedIds[0] };
}

// ============================================================================
// removeArea
// ============================================================================

export function removeArea(
  world: WorldState,
  input: RemoveAreaInput
): ActionResult {
  const { x, y, width, height } = input;
  let removedCount = 0;

  for (let ty = y; ty < y + height; ty++) {
    for (let tx = x; tx < x + width; tx++) {
      if (!inBounds(world, tx, ty)) continue;

      const tile = getTile(world, tx, ty)!;
      if (tile.buildingId === null) continue;

      // Protect hub tiles
      if (isHubTile(world, tx, ty)) continue;

      const building = world.buildings[tile.buildingId];
      if (!building) continue;

      // Remove the building
      delete world.buildings[tile.buildingId];
      tile.buildingId = null;
      removedCount++;
    }
  }

  return { success: true, worldTick: world.tick, changes: { removedCount } };
}

// ============================================================================
// setRecipe
// ============================================================================

export function setRecipe(
  world: WorldState,
  input: SetRecipeInput
): ActionResult {
  const { x, y, recipeId, filterMaterial, repair } = input;

  if (!inBounds(world, x, y)) {
    return { success: false, error: { code: "OUT_OF_BOUNDS", message: `Position (${x},${y}) is out of bounds`, details: { x, y } } };
  }

  const tile = getTile(world, x, y)!;
  if (!tile.buildingId) {
    return { success: false, error: { code: "NO_BUILDING", message: `No building at (${x},${y})`, details: { x, y } } };
  }

  const building = world.buildings[tile.buildingId];
  if (!building) {
    return { success: false, error: { code: "BUILDING_NOT_FOUND", message: `Building ${tile.buildingId} not found`, details: { buildingId: tile.buildingId } } };
  }

  const changes: Record<string, unknown> = {};

  // Handle repair
  if (repair === true) {
    if (building.faulted) {
      building.faulted = false;
      changes.repaired = true;
    }
  }

  // Handle recipeId (smelter/assembler only)
  if (recipeId !== undefined) {
    if (building.type !== "smelter" && building.type !== "assembler") {
      return { success: false, error: { code: "INCOMPATIBLE_BUILDING", message: `Building ${building.type} cannot have a recipe`, details: { buildingType: building.type } } };
    }

    const recipe = RECIPE_CATALOG[recipeId];
    if (!recipe) {
      return { success: false, error: { code: "INVALID_RECIPE", message: `Recipe ${recipeId} not found`, details: { recipeId } } };
    }

    if (recipe.building !== building.type) {
      return { success: false, error: { code: "INVALID_RECIPE", message: `Recipe ${recipeId} is for ${recipe.building}, not ${building.type}`, details: { recipeId, buildingType: building.type } } };
    }

    building.recipeId = recipeId;
    changes.recipeId = recipeId;
  }

  // Handle filterMaterial (filter_splitter only)
  if (filterMaterial !== undefined) {
    if (building.type !== "filter_splitter") {
      return { success: false, error: { code: "INCOMPATIBLE_BUILDING", message: `Building ${building.type} cannot have a filter`, details: { buildingType: building.type } } };
    }

    building.filterMaterial = filterMaterial;
    changes.filterMaterial = filterMaterial;
  }

  return { success: true, worldTick: world.tick, changes };
}

// ============================================================================
// batchActions
// ============================================================================

export function batchActions(
  world: WorldState,
  input: BatchActionsInput
): ActionResult {
  const { actions, atomic = false } = input;

  // Snapshot for atomic mode
  let snapshot: { tiles: Tile[][]; buildings: Record<string, BuildingState>; nextBuildingId: number } | null = null;

  if (atomic) {
    // Deep clone tiles (shallow clone each row, but tile objects are references we keep)
    const tilesClone = world.tiles.map(row => row.map(tile => ({ ...tile })));
    const buildingsClone = { ...world.buildings };
    snapshot = {
      tiles: tilesClone,
      buildings: buildingsClone,
      nextBuildingId: world.nextBuildingId,
    };
  }

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    let result: ActionResult;

    switch (action.kind) {
      case "place_building":
        result = placeBuilding(world, action.input);
        break;
      case "place_belt_line":
        result = placeBeltLine(world, action.input);
        break;
      case "remove_area":
        result = removeArea(world, action.input);
        break;
      case "set_recipe":
        result = setRecipe(world, action.input);
        break;
      default:
        result = { success: false, error: { code: "UNKNOWN_ACTION", message: `Unknown action kind ${(action as { kind: string }).kind}` } };
    }

    if (!result.success) {
      if (atomic && snapshot) {
        // Restore snapshot
        world.tiles = snapshot.tiles;
        world.buildings = snapshot.buildings;
        world.nextBuildingId = snapshot.nextBuildingId;
      }
      return {
        success: false,
        error: {
          code: "BATCH_FAILED",
          message: `Action ${i} failed`,
          details: { failedIndex: i, cause: (result as { error: ActionError }).error },
        },
      };
    }
  }

  return { success: true, worldTick: world.tick };
}
