// Manual input controller for gameplay tool state and action dispatchers
import type { WorldState, Direction, BuildingState, RecipeId, MaterialId, ActionResult } from "../sim/types";
import { placeBuilding, placeBeltLine, removeArea, setRecipe } from "../sim/actions";
import { isHubTile, getTile, oppositeDirection, inBounds } from "../sim/world";
import { RECIPE_CATALOG } from "../sim/catalog";
import { isRecipeUnlocked, isBuildingUnlocked } from "../sim/progression";

export type InputMode = "place" | "demolish" | "inspect";

export interface InputState {
  mode: InputMode;
  selectedBuilding: BuildingType | null;
  direction: Direction;
  selectedRecipe: RecipeId | null;
  selectedFilter: MaterialId | null;
  inspectedCoord: { x: number; y: number } | null;
  isDraggingBelt: boolean;
  dragStartX: number | null;
  dragStartY: number | null;
}

type BuildingType = "miner" | "belt" | "splitter" | "filter_splitter" | "underground_belt" | "smelter" | "assembler" | "recycler" | "sensor";

const initialState: InputState = {
  mode: "place",
  selectedBuilding: "belt",
  direction: "E",
  selectedRecipe: "iron_plate",
  selectedFilter: null,
  inspectedCoord: null,
  isDraggingBelt: false,
  dragStartX: null,
  dragStartY: null,
};

export function createInputState(): InputState {
  return { ...initialState };
}

export function rotateDirection(dir: Direction): Direction {
  switch (dir) {
    case "N": return "E";
    case "E": return "S";
    case "S": return "W";
    case "W": return "N";
  }
}

export function rotateBuildingAt(world: WorldState, x: number, y: number): ActionResult {
  if (!isHubTile(world, x, y)) {
    const tile = getTile(world, x, y);
    if (tile?.buildingId) {
      const building = world.buildings[tile.buildingId];
      if (building && building.type !== "hub") {
        building.direction = rotateDirection(building.direction);
        return { success: true, worldTick: world.tick };
      }
    }
  }
  return { success: false, error: { code: "ROTATE_FAILED", message: "Cannot rotate" } };
}

/**
 * Get the default unlocked recipe for a building type
 */
function getDefaultRecipeForBuilding(building: "smelter" | "assembler"): RecipeId {
  return building === "smelter" ? "iron_plate" : "iron_gear";
}

export function handleTileClick(
  world: WorldState,
  state: InputState,
  x: number,
  y: number
): ActionResult {
  if (state.mode === "place" && state.selectedBuilding) {
    let recipe: RecipeId | undefined = undefined;
    if (state.selectedBuilding === "smelter" || state.selectedBuilding === "assembler") {
      // Check if selectedRecipe matches the building type
      const candidateRecipe = state.selectedRecipe;
      if (candidateRecipe) {
        const recipeEntry = RECIPE_CATALOG[candidateRecipe];
        const isMatchingType = recipeEntry?.building === state.selectedBuilding;
        const isUnlocked = isRecipeUnlocked(world, candidateRecipe);
        
        if (isMatchingType && isUnlocked) {
          recipe = candidateRecipe;
        } else {
          // Auto-apply default unlocked recipe for this building type
          recipe = getDefaultRecipeForBuilding(state.selectedBuilding);
        }
      } else {
        recipe = getDefaultRecipeForBuilding(state.selectedBuilding);
      }
    }
    const filter = state.selectedBuilding === "splitter" || state.selectedBuilding === "filter_splitter"
      ? state.selectedFilter ?? undefined
      : undefined;
    return placeBuilding(world, {
      x, y,
      type: state.selectedBuilding,
      direction: state.direction,
      recipeId: recipe,
      filterMaterial: filter,
    });
  } else if (state.mode === "demolish") {
    return removeArea(world, { x, y, width: 1, height: 1 });
  } else if (state.mode === "inspect") {
    state.inspectedCoord = { x, y };
    return { success: true, worldTick: world.tick };
  }
  return { success: false, error: { code: "INVALID_MODE", message: "No action for mode" } };
}

export function startBeltDrag(state: InputState, x: number, y: number): void {
  state.isDraggingBelt = true;
  state.dragStartX = x;
  state.dragStartY = y;
}

export function endBeltDrag(world: WorldState, state: InputState, endX: number, endY: number): ActionResult {
  if (!state.isDraggingBelt || state.dragStartX === null || state.dragStartY === null) {
    return { success: false, error: { code: "NO_DRAG", message: "No active drag" } };
  }
  const result = placeBeltLine(world, {
    startX: state.dragStartX,
    startY: state.dragStartY,
    endX,
    endY,
  });
  state.isDraggingBelt = false;
  state.dragStartX = null;
  state.dragStartY = null;
  return result;
}

export function applyRecipe(world: WorldState, x: number, y: number, recipeId: RecipeId): ActionResult {
  return setRecipe(world, { x, y, recipeId });
}

export function repairBuilding(world: WorldState, x: number, y: number): ActionResult {
  return setRecipe(world, { x, y, repair: true });
}

// ============================================================================
// Placement Helper Functions
// ============================================================================

/**
 * Check if a building can be placed at the given coordinates.
 * Validates: bounds, terrain (grass only), empty tile, not hub, tech unlocked, miner deposit remaining > 0.
 */
export function canPlaceBuildingAt(
  world: WorldState,
  state: InputState,
  x: number,
  y: number
): ActionResult {
  const buildingType = state.selectedBuilding;
  if (!buildingType) {
    return { success: false, error: { code: "NO_BUILDING_SELECTED", message: "No building selected" } };
  }

  // Validate coordinates are integers
  if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y)) {
    return { success: false, error: { code: "INVALID_INPUT", message: `x and y must be integers`, details: { x, y } } };
  }

  // Check bounds
  if (!inBounds(world, x, y)) {
    return { success: false, error: { code: "OUT_OF_BOUNDS", message: `Position (${x},${y}) is out of bounds`, details: { x, y } } };
  }

  const tile = getTile(world, x, y)!;

  // Check terrain (only grass allowed)
  if (tile.terrain === "water" || tile.terrain === "rock") {
    return { success: false, error: { code: "INVALID_TERRAIN", message: `Cannot place on ${tile.terrain}`, details: { x, y, terrain: tile.terrain } } };
  }

  // Check hub type (cannot place on hub tiles) - check BEFORE occupied check
  if (isHubTile(world, x, y)) {
    return { success: false, error: { code: "HUB_PROTECTED", message: `Cannot place on hub tile`, details: { x, y } } };
  }

  // Check if already has a building
  if (tile.buildingId !== null) {
    return { success: false, error: { code: "OCCUPIED", message: `Tile (${x},${y}) already has building ${tile.buildingId}`, details: { x, y, buildingId: tile.buildingId } } };
  }

  // Check if building type is unlocked
  if (!isBuildingUnlocked(world, buildingType)) {
    return { success: false, error: { code: "TECH_LOCKED", message: `Building type ${buildingType} is not unlocked`, details: { x, y, type: buildingType } } };
  }

  // Miner must be placed on deposit with remaining > 0
  if (buildingType === "miner") {
    if (!tile.deposit || tile.deposit.remaining <= 0) {
      return { success: false, error: { code: "NO_DEPOSIT", message: `Miner requires a deposit with remaining > 0`, details: { x, y } } };
    }
  }

  // Smelter/assembler require valid recipeId
  let recipeId: RecipeId | undefined = undefined;
  if (buildingType === "smelter" || buildingType === "assembler") {
    if (state.selectedRecipe) {
      const candidateRecipe = state.selectedRecipe;
      const recipeEntry = RECIPE_CATALOG[candidateRecipe];
      const isMatchingType = recipeEntry?.building === buildingType;
      const isUnlocked = isRecipeUnlocked(world, candidateRecipe);
      
      if (isMatchingType && isUnlocked) {
        recipeId = candidateRecipe;
      } else {
        recipeId = getDefaultRecipeForBuilding(buildingType);
      }
    } else {
      recipeId = getDefaultRecipeForBuilding(buildingType);
    }

    if (!recipeId) {
      return { success: false, error: { code: "MISSING_RECIPE", message: `${buildingType} requires a recipeId`, details: { x, y, type: buildingType } } };
    }

    // Validate recipe belongs to correct building type
    const recipe = RECIPE_CATALOG[recipeId];
    if (recipe && recipe.building !== buildingType) {
      return { success: false, error: { code: "INVALID_RECIPE", message: `Recipe ${recipeId} is for ${recipe.building}, not ${buildingType}`, details: { x, y, recipeId, type: buildingType } } };
    }

    // Check if recipe is unlocked
    if (!isRecipeUnlocked(world, recipeId)) {
      return { success: false, error: { code: "TECH_LOCKED", message: `Recipe ${recipeId} is not unlocked`, details: { x, y, recipeId } } };
    }
  }

  return { success: true, worldTick: world.tick };
}

/**
 * Path tile validity status for belt preview
 */
export interface BeltPathTile {
  x: number;
  y: number;
  valid: boolean;
  error?: { code: string; message: string };
}

/**
 * Compute L-shaped belt path preview from start to end coordinates.
 * Returns the same Manhattan L-shape path as placeBeltLine with per-tile validation.
 * cornerFirst determines which axis to traverse first ("x" or "y").
 */
export function computeBeltPreviewPath(
  world: WorldState,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  cornerFirst: "x" | "y" = "x"
): { path: BeltPathTile[]; valid: boolean } {
  // Validate all coordinates are integers
  if (typeof startX !== "number" || typeof startY !== "number" || typeof endX !== "number" || typeof endY !== "number" ||
      !Number.isInteger(startX) || !Number.isInteger(startY) || !Number.isInteger(endX) || !Number.isInteger(endY)) {
    return { 
      path: [], 
      valid: false 
    };
  }

  // Compute L-shaped path using Manhattan distance (same logic as placeBeltLine)
  const path: { x: number; y: number }[] = [];
  
  let curX = startX;
  let curY = startY;

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

  // Validate each tile in the path
  const tiledPath: BeltPathTile[] = path.map(({ x, y }) => {
    // Check bounds
    if (!inBounds(world, x, y)) {
      return { x, y, valid: false, error: { code: "OUT_OF_BOUNDS", message: `Position (${x},${y}) is out of bounds` } };
    }

    const tile = getTile(world, x, y)!;

    // Check hub type - check BEFORE occupied check
    if (isHubTile(world, x, y)) {
      return { x, y, valid: false, error: { code: "HUB_PROTECTED", message: `Cannot place on hub tile` } };
    }

    // Check terrain
    if (tile.terrain === "water" || tile.terrain === "rock") {
      return { x, y, valid: false, error: { code: "INVALID_TERRAIN", message: `Cannot place on ${tile.terrain}` } };
    }

    // Check if occupied by existing building
    if (tile.buildingId !== null) {
      return { x, y, valid: false, error: { code: "OCCUPIED", message: `Tile (${x},${y}) is occupied by building ${tile.buildingId}` } };
    }

    return { x, y, valid: true };
  });

  const allValid = tiledPath.every(tile => tile.valid);

  return { path: tiledPath, valid: allValid };
}
