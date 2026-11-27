// Simulation engine for fixed-tick processing
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { WorldState, BuildingState, Tile, Direction, MaterialId, RecipeId } from "./types";
import { RECIPE_CATALOG } from "./catalog";
import { directionDelta, oppositeDirection, inBounds, nextRandom } from "./world";
import { processFilterSplitters, processRecyclers, processUndergroundBelts, updateReliabilityAndOverload } from "./reliability";
import { awardResearchPoints, getCurrentTutorialStep, completeTutorialStep, getTutorialStepsForPhase, type TutorialPhase } from "./progression";
import { updateQuestProgress, processQuests } from "./quests";
import { updateSpmStats } from "./stats";

const MINING_INTERVAL = 60; // ticks between mining operations
const MAX_OUTPUT_BUFFER = 10; // max items in output buffer

/**
 * Process miners on tiles with deposits
 */
function processMiners(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "miner") continue;
    if (building.faulted) continue; // Skip faulted buildings

    const tile = world.tiles[building.y]![building.x]!;
    if (!tile.deposit || tile.deposit.remaining <= 0) continue;

    // Mine at fixed interval using craftProgress as a counter
    building.craftProgress++;
    if (building.craftProgress < MINING_INTERVAL) continue;
    building.craftProgress = 0;

    const material = tile.deposit.material;
    tile.deposit.remaining--;

    // Try to push to output buffer or adjacent building
    const { dx, dy } = directionDelta(building.direction);
    const targetX = building.x + dx;
    const targetY = building.y + dy;

    if (inBounds(world, targetX, targetY)) {
      const targetTile = world.tiles[targetY]![targetX]!;
      if (targetTile.buildingId) {
        const targetBuilding = world.buildings[targetTile.buildingId]!;
        // Check if target can accept items (belt, splitter, smelter, assembler, hub)
        if (canAcceptItem(targetBuilding, material)) {
          addItemToBuilding(targetBuilding, material);
        } else {
          // Add to output buffer
          addToBuffer(building.outputBuffer, material, 1);
        }
      } else {
        // Empty space - add to belt if there's one (shouldn't happen for miner placement)
        addToBuffer(building.outputBuffer, material, 1);
      }
    } else {
      addToBuffer(building.outputBuffer, material, 1);
    }
  }
}

/**
 * Process smelters and assemblers
 */
function processCraftingBuildings(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "smelter" && building.type !== "assembler") continue;
    if (building.faulted) continue; // Skip faulted buildings
    if (!building.recipeId) continue;

    const recipe = RECIPE_CATALOG[building.recipeId];
    if (!recipe) continue;

    // Check if output buffer has space
    const outputCount = countBufferItems(building.outputBuffer);
    if (outputCount >= MAX_OUTPUT_BUFFER) continue;

    // Check if we have all required inputs
    const inputs = recipe.inputs;
    let canCraft = true;
    for (const [mat, amount] of Object.entries(inputs)) {
      const matKey = mat as MaterialId;
      const available = building.inputBuffer[matKey] || 0;
      if (available < amount!) {
        canCraft = false;
        break;
      }
    }

    if (!canCraft) continue;

    // Advance craft progress
    building.craftProgress++;

    // Check if craft is complete
    if (building.craftProgress >= recipe.craftTicks) {
      // Consume inputs
      for (const [mat, amount] of Object.entries(inputs)) {
        const matKey = mat as MaterialId;
        building.inputBuffer[matKey] = Math.max(0, (building.inputBuffer[matKey] || 0) - amount!);
      }

      // Add outputs to output buffer
      for (const [mat, amount] of Object.entries(recipe.outputs)) {
        const matKey = mat as MaterialId;
        addToBuffer(building.outputBuffer, matKey, amount!);
      }

      // Emit slag probabilistically if recipe has slagChance
      if (recipe.slagChance !== undefined && recipe.slagChance > 0) {
        const { value, nextState } = nextRandom(world.rngState);
        world.rngState = nextState;
        if (value < recipe.slagChance) {
          addToBuffer(building.outputBuffer, "slag", 1);
        }
      }

      building.craftProgress = 0;
    }
  }

  // Push output buffer items to adjacent buildings
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "smelter" && building.type !== "assembler") continue;

    const { dx, dy } = directionDelta(building.direction);
    const targetX = building.x + dx;
    const targetY = building.y + dy;

    if (!inBounds(world, targetX, targetY)) continue;

    const targetTile = world.tiles[targetY]![targetX]!;
    if (!targetTile.buildingId) continue;

    const targetBuilding = world.buildings[targetTile.buildingId]!;

    // Try to push each item in output buffer
    for (const [material, amount] of Object.entries(building.outputBuffer)) {
      if ((amount || 0) <= 0) continue;
      const matKey = material as MaterialId;

      if (canAcceptItem(targetBuilding, matKey)) {
        const transferred = transferItem(building.outputBuffer, targetBuilding, matKey, amount!);
        if (transferred > 0) {
          // Successfully transferred
        }
      }
    }
  }
}

/**
 * Process splitters - distribute items round-robin
 */
function processSplitters(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "splitter") continue;

    // Get valid output directions (excluding back/input side)
    const outputs = getValidSplitterOutputs(world, building);
    if (outputs.length === 0) continue;

    // Distribute items from input buffer
    for (const [material, amount] of Object.entries(building.inputBuffer)) {
      if ((amount || 0) <= 0) continue;
      const matKey = material as MaterialId;
      let remaining = amount!;

      // Track attempts to prevent infinite loop
      const maxAttempts = remaining * outputs.length;
      let attempts = 0;

      while (remaining > 0 && attempts < maxAttempts) {
        const dir = outputs[building.roundRobinIndex]!;
        if (trySendToDirection(world, building, matKey, 1, dir)) {
          remaining--;
          // Advance roundRobinIndex on successful send for true round-robin
          building.roundRobinIndex = (building.roundRobinIndex + 1) % outputs.length;
        } else {
          // Move to next output if blocked
          building.roundRobinIndex = (building.roundRobinIndex + 1) % outputs.length;
        }
        attempts++;
      }
    }
  }
}

/**
 * Process belts - move items forward
 */
function processBelts(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "belt") continue;

    // Only process once per tick per belt
    if (building.blockedTicks === undefined) building.blockedTicks = 0;

    // Try to move first belt item
    if (building.beltItems.length === 0) continue;

    const item = building.beltItems[0]!;
    if (item.movedAtTick === world.tick) continue;

    const { dx, dy } = directionDelta(building.direction);
    const targetX = building.x + dx;
    const targetY = building.y + dy;

    if (!inBounds(world, targetX, targetY)) continue;

    const targetTile = world.tiles[targetY]![targetX]!;
    if (!targetTile.buildingId) continue;

    const targetBuilding = world.buildings[targetTile.buildingId]!;

    // Check if target can accept the item
    if (canAcceptBeltItem(targetBuilding, item.material)) {
      // Move item to target
      item.movedAtTick = world.tick;
      
      // If target is also a belt, transfer item to it
      if (targetBuilding.type === "belt") {
        // Add to target belt's items and remove from source
        targetBuilding.beltItems.push({ material: item.material, movedAtTick: world.tick });
        building.beltItems.shift();
      } else {
        // Transfer to target building's input buffer or belt items
        addItemToBuilding(targetBuilding, item.material);
        building.beltItems.shift();
      }
    }
  }
}

/**
 * Process hubs - accept delivered items
 */
function processHubs(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "hub") continue;

    // Accept items from input buffer
    for (const [material, amount] of Object.entries(building.inputBuffer)) {
      if ((amount || 0) <= 0) continue;
      const matKey = material as MaterialId;
      const actualAmount = amount!;

      // Record delivery
      world.delivered[matKey] = (world.delivered[matKey] || 0) + actualAmount;
      world.deliveryHistory.push({
        tick: world.tick,
        material: matKey,
        amount: actualAmount,
      });

      // Award research points for delivered materials
      awardResearchPoints(world, matKey, actualAmount);

      // Update quest progress for delivered materials
      updateQuestProgress(world, matKey, actualAmount);

      // Clear the input buffer
      building.inputBuffer[matKey] = 0;

      // Prune old history entries (older than 600 ticks)
      pruneDeliveryHistory(world);
    }
  }
}

/**
 * Helper: check if building can accept an item
 */
function canAcceptItem(building: BuildingState, material: MaterialId): boolean {
  switch (building.type) {
    case "belt":
      return building.beltItems.length < 3;
    case "splitter":
    case "filter_splitter":
      return countBufferItems(building.inputBuffer) < MAX_OUTPUT_BUFFER;
    case "smelter":
    case "assembler":
      // Check if material is a valid input for current recipe
      if (!building.recipeId) return false;
      const recipe = RECIPE_CATALOG[building.recipeId];
      if (!recipe) return false;
      return recipe.inputs.hasOwnProperty(material);
    case "hub":
    case "underground_belt":
    case "recycler":
      return countBufferItems(building.inputBuffer) < MAX_OUTPUT_BUFFER;
    default:
      return false;
  }
}

/**
 * Helper: check if building can accept a belt item
 */
function canAcceptBeltItem(building: BuildingState, material: MaterialId): boolean {
  return canAcceptItem(building, material);
}

/**
 * Helper: add item to building's appropriate buffer
 */
function addItemToBuilding(building: BuildingState, material: MaterialId): void {
  switch (building.type) {
    case "belt":
      building.beltItems.push({ material, movedAtTick: 0 });
      break;
    case "splitter":
    case "filter_splitter":
    case "smelter":
    case "assembler":
    case "hub":
    case "underground_belt":
    case "recycler":
      addToBuffer(building.inputBuffer, material, 1);
      break;
  }
}

/**
 * Helper: add to buffer
 */
function addToBuffer(buffer: Partial<Record<MaterialId, number>>, material: MaterialId, amount: number): void {
  buffer[material] = (buffer[material] || 0) + amount;
}

/**
 * Helper: count total items in buffer
 */
function countBufferItems(buffer: Partial<Record<MaterialId, number>>): number {
  return Object.values(buffer).reduce((sum, val) => sum + (val || 0), 0);
}

/**
 * Helper: transfer item from source buffer to target building
 */
function transferItem(
  sourceBuffer: Partial<Record<MaterialId, number>>,
  targetBuilding: BuildingState,
  material: MaterialId,
  maxAmount: number
): number {
  const available = sourceBuffer[material] || 0;
  if (available <= 0) return 0;

  // Determine how much can be accepted
  let accepted = 0;
  switch (targetBuilding.type) {
    case "belt":
      accepted = Math.min(available, maxAmount, 3 - targetBuilding.beltItems.length);
      for (let i = 0; i < accepted; i++) {
        targetBuilding.beltItems.push({ material, movedAtTick: 0 });
      }
      break;
    case "splitter":
    case "filter_splitter":
    case "smelter":
    case "assembler":
    case "hub":
    case "underground_belt":
    case "recycler":
      const currentCount = countBufferItems(targetBuilding.inputBuffer);
      const space = MAX_OUTPUT_BUFFER - currentCount;
      accepted = Math.min(available, maxAmount, space);
      addToBuffer(targetBuilding.inputBuffer, material, accepted);
      break;
    default:
      return 0;
  }

  sourceBuffer[material] = available - accepted;
  return accepted;
}

/**
 * Helper: get valid output directions for splitter
 */
function getValidSplitterOutputs(world: WorldState, building: BuildingState): Direction[] {
  const outputs: Direction[] = [];
  
  // Primary direction
  const { dx, dy } = directionDelta(building.direction);
  const primaryTargetX = building.x + dx;
  const primaryTargetY = building.y + dy;
  
  if (inBounds(world, primaryTargetX, primaryTargetY)) {
    const targetTile = world.tiles[primaryTargetY]![primaryTargetX]!;
    if (targetTile.buildingId && targetTile.buildingId !== building.id) {
      outputs.push(building.direction);
    }
  }

  // Perpendicular directions (E/W if facing N/S, N/S if facing E/W)
  const perpDirs: Direction[] = building.direction === "N" || building.direction === "S" 
    ? ["E", "W"] 
    : ["N", "S"];

  for (const dir of perpDirs) {
    const { dx: pdx, dy: pdy } = directionDelta(dir);
    const targetX = building.x + pdx;
    const targetY = building.y + pdy;

    if (inBounds(world, targetX, targetY)) {
      const targetTile = world.tiles[targetY]![targetX]!;
      if (targetTile.buildingId && targetTile.buildingId !== building.id) {
        outputs.push(dir);
      }
    }
  }

  return outputs;
}

/**
 * Helper: try to send item in a direction
 */
function trySendToDirection(world: WorldState, building: BuildingState, material: MaterialId, amount: number, dir: Direction): boolean {
  const { dx, dy } = directionDelta(dir);
  const targetX = building.x + dx;
  const targetY = building.y + dy;

  if (!inBounds(world, targetX, targetY)) return false;

  const targetTile = world.tiles[targetY]![targetX]!;
  if (!targetTile.buildingId) return false;

  const targetBuilding = world.buildings[targetTile.buildingId]!;
  
  if (canAcceptItem(targetBuilding, material)) {
    const transferred = transferItem(building.inputBuffer, targetBuilding, material, amount);
    return transferred > 0;
  }

  return false;
}

/**
 * Helper: prune old delivery history entries
 */
function pruneDeliveryHistory(world: WorldState): void {
  const cutoff = world.tick - 600;
  world.deliveryHistory = world.deliveryHistory.filter(entry => entry.tick >= cutoff);
}

/**
 * Step a single tick of the simulation
 */
export function stepTick(world: WorldState): void {
  world.tick++;

  // 1. Process miners
  processMiners(world);

  // 2. Process crafting buildings (smelters/assemblers)
  processCraftingBuildings(world);

  // 3. Push crafting outputs to adjacent buildings
  // (already done in processCraftingBuildings)

  // 4. Process splitters
  processSplitters(world);

  // 5. Process filter splitters
  processFilterSplitters(world);

  // 6. Process belts
  processBelts(world);

  // 7. Process hubs (accept deliveries)
  processHubs(world);

  // 8. Process recyclers
  processRecyclers(world);

  // 9. Process underground belts
  processUndergroundBelts(world);

  // 10. Update reliability and overload
  updateReliabilityAndOverload(world);

  // 11. Process quests (check for completion/expiry and generate new ones)
  processQuests(world);

  // 12. Update SPM stats
  updateSpmStats(world);

  // 13. Auto-advance completed tutorial steps when tutorialPhase > 0
  if ((world.tutorialPhase ?? 0) > 0) {
    const phase = world.tutorialPhase as TutorialPhase;
    const completedSet = new Set(world.completedTutorialSteps || []);
    for (const step of getTutorialStepsForPhase(phase)) {
      if (!completedSet.has(step.id) && step.check(world)) {
        completeTutorialStep(world, step.id);
      }
    }
  }
}

/**
 * Step multiple ticks of the simulation
 */
export function stepTicks(world: WorldState, count: number): void {
  for (let i = 0; i < count; i++) {
    stepTick(world);
  }
}
