// Buffer management module for building input/output buffers
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { BuildingState, MaterialId, BuildingType } from "./types";
import type { RecipeId } from "./types";
import { RECIPE_CATALOG, MAX_OUTPUT_BUFFER, MIN_INPUT_BUFFER_PER_MATERIAL, INPUT_BUFFER_MULTIPLIER } from "./catalog";

// ============================================================================
// Buffer Limit Functions
// ============================================================================

/**
 * Get the input buffer limit for a specific material in a building.
 * For smelter/assembler: returns 0 if no recipe or material not in recipe inputs.
 * Otherwise returns Math.max(MIN_INPUT_BUFFER_PER_MATERIAL, requiredAmount * INPUT_BUFFER_MULTIPLIER).
 */
export function getInputBufferLimit(
  building: BuildingState,
  material: MaterialId
): number {
  if (building.type !== "smelter" && building.type !== "assembler") {
    return MAX_OUTPUT_BUFFER;
  }

  // Fail-fast: no recipe means no valid input buffer
  if (!building.recipeId) {
    return 0;
  }

  const recipe = RECIPE_CATALOG[building.recipeId as RecipeId];
  if (!recipe) {
    return 0;
  }

  // Fail-fast: material not in recipe inputs means invalid
  const requiredAmount = recipe.inputs[material];
  if (requiredAmount === undefined || requiredAmount <= 0) {
    return 0;
  }

  return Math.max(MIN_INPUT_BUFFER_PER_MATERIAL, requiredAmount * INPUT_BUFFER_MULTIPLIER);
}

/**
 * Check if a building can accept an item of the given material.
 * - belts (type "belt"): always accepts if beltItems.length < 3
 * - smelter/assembler: checks per-material input buffer limit
 * - other buffer buildings (splitter, filter_splitter, hub, underground_belt, recycler):
 *   checks total buffer items count against MAX_OUTPUT_BUFFER
 */
export function canAcceptItem(building: BuildingState, material: MaterialId): boolean {
  if (building.type === "belt") {
    return building.beltItems.length < 3;
  }

  if (building.type === "smelter" || building.type === "assembler") {
    const limit = getInputBufferLimit(building, material);
    if (limit === 0) {
      return false;
    }
    const current = building.inputBuffer[material] || 0;
    return current < limit;
  }

  // Other buffer buildings check total count
  return countBufferItems(building.inputBuffer) < MAX_OUTPUT_BUFFER;
}

/**
 * Check if a building can accept a belt item (same logic as canAcceptItem but for belt transfers).
 */
export function canAcceptBeltItem(building: BuildingState, material: MaterialId): boolean {
  return canAcceptItem(building, material);
}

/**
 * Add an amount of material to a building's input buffer.
 */
export function addToBuffer(
  buffer: Partial<Record<MaterialId, number>>,
  material: MaterialId,
  amount: number
): void {
  buffer[material] = (buffer[material] || 0) + amount;
}

/**
 * Count total items across all materials in a buffer.
 */
export function countBufferItems(buffer: Partial<Record<MaterialId, number>>): number {
  let count = 0;
  for (const material of Object.keys(buffer)) {
    count += buffer[material as MaterialId] || 0;
  }
  return count;
}

/**
 * Add an item to a building's buffer with optional tick tracking.
 * For belts, uses movedAtTick: tick ?? 0.
 */
export function addItemToBuilding(
  building: BuildingState,
  material: MaterialId,
  tick?: number
): void {
  if (building.type === "belt") {
    building.beltItems.push({ material, movedAtTick: tick ?? 0 });
  } else {
    addToBuffer(building.inputBuffer, material, 1);
  }
}

/**
 * Transfer item from source buffer to target building.
 * Enforces per-material cap via getInputBufferLimit for smelter/assembler.
 * Returns actual amount transferred.
 * Sets movedAtTick: tick ?? 0 for belt items.
 */
export function transferItem(
  sourceBuffer: Partial<Record<MaterialId, number>>,
  targetBuilding: BuildingState,
  material: MaterialId,
  maxAmount: number,
  tick?: number
): number {
  // Fail-fast: for smelter/assembler, reject invalid/non-recipe materials immediately
  if (targetBuilding.type === "smelter" || targetBuilding.type === "assembler") {
    const limit = getInputBufferLimit(targetBuilding, material);
    if (limit === 0) {
      return 0;
    }
    const current = targetBuilding.inputBuffer[material] || 0;
    const availableSpace = limit - current;
    const transferAmount = Math.min(maxAmount, availableSpace);
    if (transferAmount <= 0) {
      return 0;
    }
    const sourceAmount = sourceBuffer[material] || 0;
    const actualTransfer = Math.min(transferAmount, sourceAmount);
    if (actualTransfer > 0) {
      sourceBuffer[material] = sourceAmount - actualTransfer;
      addToBuffer(targetBuilding.inputBuffer, material, actualTransfer);
    }
    return actualTransfer;
  }

  // For belts and other buffer buildings
  if (targetBuilding.type === "belt") {
    const sourceAmount = sourceBuffer[material] || 0;
    const actualTransfer = Math.min(maxAmount, sourceAmount, 3 - targetBuilding.beltItems.length);
    if (actualTransfer <= 0) {
      return 0;
    }
    sourceBuffer[material] = sourceAmount - actualTransfer;
    for (let i = 0; i < actualTransfer; i++) {
      targetBuilding.beltItems.push({ material, movedAtTick: tick ?? 0 });
    }
    return actualTransfer;
  }

  // For splitter, filter_splitter, hub, underground_belt, recycler
  const currentTotal = countBufferItems(targetBuilding.inputBuffer);
  if (currentTotal >= MAX_OUTPUT_BUFFER) {
    return 0;
  }
  const sourceAmount = sourceBuffer[material] || 0;
  const actualTransfer = Math.min(maxAmount, sourceAmount, MAX_OUTPUT_BUFFER - currentTotal);
  if (actualTransfer > 0) {
    sourceBuffer[material] = sourceAmount - actualTransfer;
    addToBuffer(targetBuilding.inputBuffer, material, actualTransfer);
  }
  return actualTransfer;
}
