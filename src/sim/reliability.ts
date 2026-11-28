// Reliability and specialized logistics mechanics
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { WorldState, BuildingState, Direction, MaterialId, BeltItem } from "./types";
import { directionDelta, inBounds, getTile } from "./world";

const OVERLOAD_THRESHOLD = 100;
const UNDERGROUND_RANGE = 4;
const MAX_OUTPUT_BUFFER = 10;
const RECYCLABLE_MATERIALS: MaterialId[] = ["slag"];
const HARMLESS_DISPOSAL_MATERIALS: MaterialId[] = ["slag"];

/** Process filter splitters: route filterMaterial forward, other items to perpendicular sides round-robin. */
export function processFilterSplitters(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "filter_splitter" || !building.filterMaterial) continue;

    const perpDirs: Direction[] = building.direction === "N" || building.direction === "S" ? ["E", "W"] : ["N", "S"];

    for (const [materialStr, amount] of Object.entries(building.inputBuffer)) {
      if ((amount || 0) <= 0) continue;
      const material = materialStr as MaterialId;
      let remaining = amount!;

      while (remaining > 0) {
        if (material === building.filterMaterial) {
          if (!trySendToBuilding(world, building, material, 1, building.direction)) break;
        } else {
          const sideDir = perpDirs[building.roundRobinIndex % perpDirs.length]!;
          if (trySendToBuilding(world, building, material, 1, sideDir)) {
            building.roundRobinIndex++;
          } else {
            building.roundRobinIndex++;
            if (building.roundRobinIndex >= perpDirs.length * 2) break;
          }
        }
        remaining--;
      }
    }
  }
}

/** Process underground belts: bridge up to 4 tiles to matching underground_belt facing same direction. */
export function processUndergroundBelts(world: WorldState): void {
  for (const building of Object.values(world.buildings).filter(b => b.type === "underground_belt")) {
    const { dx, dy } = directionDelta(building.direction);

    let foundPair = false;
    
    for (let step = 1; step <= UNDERGROUND_RANGE; step++) {
      const targetX = building.x + dx * step;
      const targetY = building.y + dy * step;
      if (!inBounds(world, targetX, targetY)) continue;

      const targetTile = getTile(world, targetX, targetY);
      if (!targetTile?.buildingId) continue;

      const targetBuilding = world.buildings[targetTile.buildingId];
      if (!targetBuilding) continue;

      if (targetBuilding.type === "underground_belt" && targetBuilding.direction === building.direction) {
        transferUndergroundItems(world, building, targetBuilding);
        foundPair = true;
        break;
      }
      if (targetBuilding.type !== "belt") break;
    }
    
    // If no pair found, push items forward to building in front
    if (!foundPair) {
      const forwardX = building.x + dx;
      const forwardY = building.y + dy;
      if (inBounds(world, forwardX, forwardY)) {
        const forwardTile = getTile(world, forwardX, forwardY);
        if (forwardTile?.buildingId) {
          const forwardBuilding = world.buildings[forwardTile.buildingId];
          if (forwardBuilding) {
            // Push outputBuffer items forward
            pushOutputToBuilding(world, building, forwardBuilding);
            // Also transfer inputBuffer items (underground belts skip this in pushOutputToBuilding)
            for (const [materialStr, amount] of Object.entries(building.inputBuffer)) {
              if ((amount || 0) <= 0) continue;
              transferItem(building.inputBuffer, forwardBuilding, materialStr as MaterialId, amount!);
            }
            // Also transfer belt items if the forward building is a belt
            if (forwardBuilding.type === "belt") {
              for (const item of building.beltItems) {
                if (forwardBuilding.beltItems.length < 3) {
                  forwardBuilding.beltItems.push({ ...item });
                }
              }
              building.beltItems = [];
            }
          }
        }
      }
    }
  }
}

function transferUndergroundItems(world: WorldState, source: BuildingState, target: BuildingState): void {
  // Track if this is a successful pair transfer
  let transferred = false;
  
  // Transfer from source.inputBuffer to target's inputBuffer
  for (const [materialStr, amount] of Object.entries(source.inputBuffer)) {
    if ((amount || 0) <= 0) continue;
    const transferredAmount = transferItem(source.inputBuffer, target, materialStr as MaterialId, amount!);
    if (transferredAmount > 0) transferred = true;
  }
  
  // Move belt items from source to target (not copy - remove from source)
  const transferredItems: BeltItem[] = [];
  for (const item of source.beltItems) {
    if (canAcceptBeltItem(target, item.material)) {
      transferredItems.push(item);
    }
  }
  
  // Remove moved items from source and add to target
  for (const item of transferredItems) {
    const idx = source.beltItems.indexOf(item);
    if (idx !== -1) {
      source.beltItems.splice(idx, 1);
      target.beltItems.push({ ...item });
      transferred = true;
    }
  }
  
  // Forward output from target: push items from target's inputBuffer/outputBuffer to buildings in front
  // Only do this if we successfully transferred items
  if (transferred) {
    const { dx, dy } = directionDelta(target.direction);
    const forwardX = target.x + dx;
    const forwardY = target.y + dy;
    if (inBounds(world, forwardX, forwardY)) {
      const forwardTile = getTile(world, forwardX, forwardY);
      if (forwardTile?.buildingId) {
        const forwardBuilding = world.buildings[forwardTile.buildingId];
        if (forwardBuilding && forwardBuilding.type !== "underground_belt") {
          // Push from target's inputBuffer (which just received items) to forward building
          pushOutputToBuilding(world, target, forwardBuilding);
        }
      }
    }
  }
}

/** Process recyclers: convert slag into silica_sand or harmless disposal. */
export function processRecyclers(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "recycler") continue;

    for (const material of RECYCLABLE_MATERIALS) {
      const amount = building.inputBuffer[material] || 0;
      if (amount <= 0) continue;
      const converted = Math.min(amount, MAX_OUTPUT_BUFFER - countBufferItems(building.outputBuffer));
      if (converted > 0) {
        building.inputBuffer[material] = amount - converted;
        addToBuffer(building.outputBuffer, "silica_sand", converted);
      }
    }

    for (const [materialStr, amount] of Object.entries(building.inputBuffer)) {
      if ((amount || 0) <= 0) continue;
      const material = materialStr as MaterialId;
      if (!RECYCLABLE_MATERIALS.includes(material) && !HARMLESS_DISPOSAL_MATERIALS.includes(material)) {
        building.inputBuffer[material] = 0;
      }
    }

    const { dx, dy } = directionDelta(building.direction);
    const forwardX = building.x + dx, forwardY = building.y + dy;
    if (inBounds(world, forwardX, forwardY)) {
      const forwardTile = getTile(world, forwardX, forwardY);
      if (forwardTile?.buildingId) {
        const forwardBuilding = world.buildings[forwardTile.buildingId];
        if (forwardBuilding) pushOutputToBuilding(world, building, forwardBuilding);
      }
    }
  }
}

export interface SensorAlert {
  buildingId: string;
  alertType: "jam" | "overload" | "depleted";
  message: string;
}

/** Process sensors: monitor adjacent tiles for jams, overload faults, and ore depletion. */
export function processSensors(world: WorldState): void {
  // Sensor monitoring is handled by collectSensorAlerts
  // This function exists for API consistency but has no active processing
}

/** Collect sensor alerts from all sensors in the world. */
export function collectSensorAlerts(world: WorldState): SensorAlert[] {
  const alerts: SensorAlert[] = [];
  for (const building of Object.values(world.buildings)) {
    if (building.type !== "sensor") continue;
    for (const dir of ["N", "E", "S", "W"] as Direction[]) {
      const { dx, dy } = directionDelta(dir);
      const adjX = building.x + dx, adjY = building.y + dy;
      if (!inBounds(world, adjX, adjY)) continue;

      const adjTile = getTile(world, adjX, adjY);
      if (!adjTile?.buildingId) continue;
      const adjBuilding = world.buildings[adjTile.buildingId];
      if (!adjBuilding) continue;

      if (adjBuilding.blockedTicks >= 30) {
        alerts.push({ buildingId: adjBuilding.id, alertType: "jam", message: `Building ${adjBuilding.id} is jammed` });
      }
      if (adjBuilding.faulted) {
        alerts.push({ buildingId: adjBuilding.id, alertType: "overload", message: `Building ${adjBuilding.id} is faulted` });
      }
      if (adjBuilding.type === "miner") {
        const tile = getTile(world, adjBuilding.x, adjBuilding.y);
        if (tile?.deposit && tile.deposit.remaining <= 0) {
          alerts.push({ buildingId: adjBuilding.id, alertType: "depleted", message: `Miner ${adjBuilding.id} depleted` });
        }
      }
    }
  }
  return alerts;
}

/** Update reliability metrics: increment blockedTicks/load, set faulted when threshold exceeded. */
export function updateReliabilityAndOverload(world: WorldState): void {
  for (const building of Object.values(world.buildings)) {
    if (building.type === "hub") continue;

    const outputCount = countBufferItems(building.outputBuffer);
    const isOutputFull = outputCount >= MAX_OUTPUT_BUFFER;
    
    // Check if belt item at front is stagnant (movedAtTick same as previous tick)
    const isFirstItemStagnant = building.beltItems.length > 0 && 
      building.beltItems[0]!.movedAtTick === world.tick - 1;
    
    const isBlocked = isOutputFull || isFirstItemStagnant;

    if (isBlocked) {
      building.blockedTicks++;
      building.load++;
    } else {
      // Not blocked: decrement blockedTicks
      if (building.blockedTicks > 0) {
        building.blockedTicks = Math.max(0, building.blockedTicks - 1);
      }
      // Cool down load only if not faulted
      if (!building.faulted && building.load > 0) {
        building.load--;
      }
    }

    // Set faulted when load exceeds threshold
    if (building.load >= OVERLOAD_THRESHOLD) {
      building.faulted = true;
    }
    // Note: faulted is ONLY cleared by repair action, not by low load
  }
}

// Helper functions
function addToBuffer(buffer: Partial<Record<MaterialId, number>>, material: MaterialId, amount: number): void {
  buffer[material] = (buffer[material] || 0) + amount;
}

function countBufferItems(buffer: Partial<Record<MaterialId, number>>): number {
  return Object.values(buffer).reduce((sum, val) => sum + (val || 0), 0);
}

function trySendToBuilding(world: WorldState, source: BuildingState, material: MaterialId, amount: number, dir: Direction): boolean {
  const { dx, dy } = directionDelta(dir);
  const targetX = source.x + dx, targetY = source.y + dy;
  if (!inBounds(world, targetX, targetY)) return false;

  const targetTile = getTile(world, targetX, targetY);
  if (!targetTile?.buildingId) return false;
  const targetBuilding = world.buildings[targetTile.buildingId];
  if (!targetBuilding) return false;

  if (canAcceptItem(targetBuilding, material)) {
    const transferred = transferItem(source.inputBuffer, targetBuilding, material, amount);
    return transferred > 0;
  }
  return false;
}

function canAcceptItem(building: BuildingState, material: MaterialId): boolean {
  switch (building.type) {
    case "belt": return building.beltItems.length < 3;
    case "splitter": case "filter_splitter": case "smelter": case "assembler": case "recycler": case "hub": case "underground_belt":
      return countBufferItems(building.inputBuffer) < MAX_OUTPUT_BUFFER;
    default: return false;
  }
}

function canAcceptBeltItem(building: BuildingState, material: MaterialId): boolean {
  return canAcceptItem(building, material);
}

function transferItem(sourceBuffer: Partial<Record<MaterialId, number>>, targetBuilding: BuildingState, material: MaterialId, maxAmount: number): number {
  const available = sourceBuffer[material] || 0;
  if (available <= 0) return 0;

  let accepted = 0;
  switch (targetBuilding.type) {
    case "belt":
      accepted = Math.min(available, maxAmount, 3 - targetBuilding.beltItems.length);
      for (let i = 0; i < accepted; i++) targetBuilding.beltItems.push({ material, movedAtTick: 0 });
      break;
    case "splitter": case "filter_splitter": case "smelter": case "assembler": case "recycler": case "hub": case "underground_belt":
      const space = MAX_OUTPUT_BUFFER - countBufferItems(targetBuilding.inputBuffer);
      accepted = Math.min(available, maxAmount, space);
      addToBuffer(targetBuilding.inputBuffer, material, accepted);
      break;
    default: return 0;
  }
  sourceBuffer[material] = available - accepted;
  return accepted;
}

function pushOutputToBuilding(world: WorldState, source: BuildingState, target: BuildingState): void {
  // Transfer from outputBuffer
  for (const [materialStr, amount] of Object.entries(source.outputBuffer)) {
    if ((amount || 0) <= 0) continue;
    transferItem(source.outputBuffer, target, materialStr as MaterialId, amount!);
  }
  // Also transfer from inputBuffer (for standalone underground belts and other buildings)
  // But NOT for paired underground belts - they keep items in inputBuffer until processed
  if (source.type !== "underground_belt") {
    for (const [materialStr, amount] of Object.entries(source.inputBuffer)) {
      if ((amount || 0) <= 0) continue;
      transferItem(source.inputBuffer, target, materialStr as MaterialId, amount!);
    }
  }
}
