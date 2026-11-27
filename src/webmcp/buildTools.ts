// WebMCP mutate tool handlers wrapping src/sim/actions.ts
// Pure TypeScript - ZERO Phaser dependencies

import type { WorldState, ActionResult } from "../sim/types";
import type { MutateToolName } from "./types";
import { placeBuilding, placeBeltLine, removeArea, setRecipe, batchActions, unlockTechAction } from "../sim/actions";

/**
 * Create build tool handlers for WebMCP mutate tools.
 * Wraps actions from src/sim/actions.ts with input validation and optional mutation callback.
 */
export function createBuildToolHandlers(
  getWorld: () => WorldState,
  onWorldMutated?: () => void
): Record<MutateToolName, (input: Record<string, unknown>) => ActionResult> {
  
  const handlePlaceBuilding = (input: Record<string, unknown>): ActionResult => {
    const x = input.x;
    const y = input.y;
    const type = input.type;
    const direction = input.direction;
    const recipeId = input.recipeId as string | undefined;
    const filterMaterial = input.filterMaterial as string | undefined;

    if (typeof x !== "number" || typeof y !== "number") {
      return { success: false, error: { code: "INVALID_INPUT", message: "x and y must be numbers" } };
    }
    if (typeof type !== "string") {
      return { success: false, error: { code: "INVALID_INPUT", message: "type must be a string" } };
    }
    if (typeof direction !== "string" || !["N", "E", "S", "W"].includes(direction)) {
      return { success: false, error: { code: "INVALID_INPUT", message: "direction must be N, E, S, or W" } };
    }

    const result = placeBuilding(getWorld(), { x, y, type: type as any, direction: direction as any, recipeId: recipeId as any, filterMaterial: filterMaterial as any });
    
    if (result.success && onWorldMutated) {
      onWorldMutated();
    }
    return result;
  };

  const handlePlaceBeltLine = (input: Record<string, unknown>): ActionResult => {
    const startX = input.startX;
    const startY = input.startY;
    const endX = input.endX;
    const endY = input.endY;
    const cornerFirst = input.cornerFirst as "x" | "y" | undefined;

    if (typeof startX !== "number" || typeof startY !== "number" || typeof endX !== "number" || typeof endY !== "number") {
      return { success: false, error: { code: "INVALID_INPUT", message: "startX, startY, endX, endY must be numbers" } };
    }

    const result = placeBeltLine(getWorld(), { startX, startY, endX, endY, cornerFirst });
    
    if (result.success && onWorldMutated) {
      onWorldMutated();
    }
    return result;
  };

  const handleRemoveArea = (input: Record<string, unknown>): ActionResult => {
    const x = input.x;
    const y = input.y;
    const width = input.width;
    const height = input.height;

    if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") {
      return { success: false, error: { code: "INVALID_INPUT", message: "x, y, width, height must be numbers" } };
    }

    const result = removeArea(getWorld(), { x, y, width, height });
    
    if (result.success && onWorldMutated) {
      onWorldMutated();
    }
    return result;
  };

  const handleSetRecipe = (input: Record<string, unknown>): ActionResult => {
    const x = input.x;
    const y = input.y;
    const recipeId = input.recipeId as string | undefined;
    const filterMaterial = input.filterMaterial as string | undefined;
    const repair = input.repair as boolean | undefined;

    if (typeof x !== "number" || typeof y !== "number") {
      return { success: false, error: { code: "INVALID_INPUT", message: "x and y must be numbers" } };
    }

    const result = setRecipe(getWorld(), { x, y, recipeId: recipeId as any, filterMaterial: filterMaterial as any, repair });
    
    if (result.success && onWorldMutated) {
      onWorldMutated();
    }
    return result;
  };

  const handleUnlockTech = (input: Record<string, unknown>): ActionResult => {
    const techId = input.techId as string | undefined;

    if (typeof techId !== "string") {
      return { success: false, error: { code: "INVALID_INPUT", message: "techId must be a string" } };
    }

    const validTechIds: string[] = [
      "underground_belt", "filter_splitter", "high_efficiency",
      "sensor", "recycler", "advanced_smelting", "electronics", "automation"
    ];

    if (!validTechIds.includes(techId)) {
      return { success: false, error: { code: "INVALID_TECH", message: `Unknown tech ID: ${techId}`, details: { techId } } };
    }

    const result = unlockTechAction(getWorld(), techId as any);
    
    if (result.success && onWorldMutated) {
      onWorldMutated();
    }
    return result;
  };

  const handleBatchActions = (input: Record<string, unknown>): ActionResult => {
    const actions = input.actions;
    const atomic = input.atomic as boolean | undefined;

    if (!Array.isArray(actions)) {
      return { success: false, error: { code: "INVALID_INPUT", message: "actions must be an array" } };
    }

    // Validate each action item structure
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (action === null || typeof action !== "object") {
        return { success: false, error: { code: "INVALID_INPUT", message: `Action ${i} must be an object` } };
      }
      const typedAction = action as Record<string, unknown>;
      if (typeof typedAction.kind !== "string") {
        return { success: false, error: { code: "INVALID_INPUT", message: `Action ${i} missing kind` } };
      }
      if (!typedAction.input || typeof typedAction.input !== "object") {
        return { success: false, error: { code: "INVALID_INPUT", message: `Action ${i} missing input` } };
      }
    }

    const result = batchActions(getWorld(), { actions: actions as any, atomic });
    
    if (result.success && onWorldMutated) {
      onWorldMutated();
    }
    return result;
  };

  return {
    place_building: handlePlaceBuilding,
    place_belt_line: handlePlaceBeltLine,
    remove_area: handleRemoveArea,
    set_recipe: handleSetRecipe,
    batch_actions: handleBatchActions,
    unlock_tech: handleUnlockTech,
  };
}
