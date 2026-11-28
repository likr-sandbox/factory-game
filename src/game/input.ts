// Manual input controller for gameplay tool state and action dispatchers
import type { WorldState, Direction, BuildingState, RecipeId, MaterialId, ActionResult } from "../sim/types";
import { placeBuilding, placeBeltLine, removeArea, setRecipe } from "../sim/actions";
import { isHubTile, getTile, oppositeDirection } from "../sim/world";
import { RECIPE_CATALOG } from "../sim/catalog";
import { isRecipeUnlocked } from "../sim/progression";

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
