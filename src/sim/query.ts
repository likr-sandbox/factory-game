// Query layer for simulation inspection and analysis
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { WorldState, MaterialId, RecipeId } from "./types";
import { RECIPE_CATALOG, TECH_CATALOG } from "./catalog";
import { HUB_ORIGIN } from "./world";
import { collectSensorAlerts } from "./reliability";
import { isRecipeUnlocked, getTechTreeStatus, getTutorialProgress } from "./progression";
import { getActiveQuests } from "./quests";

// ============================================================================
// Query Function Results
// ============================================================================

export interface FactorySummary {
  width: number;
  height: number;
  tick: number;
  hubOrigin: { x: number; y: number };
  delivered: Partial<Record<MaterialId, number>>;
  spm: number;
  buildingCount: number;
  activeCount: number;
  faultedCount: number;
  depletedMinerCount: number;
  unlockedTechs: string[];
  completedQuests: string[];
  researchPoints: number;
  techTree: ReturnType<typeof getTechTreeStatus>;
  tutorialProgress: ReturnType<typeof getTutorialProgress>;
  activeQuests: ReturnType<typeof getActiveQuests>;
}

export interface TileEntry {
  x: number;
  y: number;
  terrain: string;
  deposit?: { material: MaterialId; remaining: number };
  building?: {
    id: string;
    type: string;
    direction: string;
    recipeId?: RecipeId;
    faulted: boolean;
    inputCount: number;
    outputCount: number;
  };
}

export interface ResourceInfo {
  material: MaterialId;
  x: number;
  y: number;
  remaining: number;
  distanceManhattan: number;
  distanceEuclidean: number;
}

export interface RecipeInfo {
  id: RecipeId;
  nameJa: string;
  building: "smelter" | "assembler";
  inputs: Partial<Record<MaterialId, number>>;
  outputs: Partial<Record<MaterialId, number>>;
  craftTicks: number;
  unlocked: boolean;
}

export interface BottleneckCandidate {
  buildingId: string;
  type: string;
  x: number;
  y: number;
  blockedTicks: number;
  idleTicks: number;
}

export interface Alert {
  type: "faulted" | "depleted";
  buildingId?: string;
  x: number;
  y: number;
  message: string;
}

export interface Metrics {
  spm: number;
  deliveriesPerMinute: Partial<Record<MaterialId, number>>;
  bottlenecks: BottleneckCandidate[];
  alerts: Alert[];
  researchPoints: number;
}

// ============================================================================
// Query Functions
// ============================================================================

const MAX_REGION_DIM = 24;
const TICKS_PER_MINUTE = 600;

/**
 * Get factory summary statistics
 */
export function getFactorySummary(world: WorldState): FactorySummary {
  const buildings = Object.values(world.buildings);
  const activeCount = buildings.filter(b => !b.faulted && b.load > 0).length;
  const faultedCount = buildings.filter(b => b.faulted).length;
  const depletedMinerCount = buildings
    .filter(b => b.type === "miner")
    .filter(b => {
      const tile = world.tiles[b.y]?.[b.x];
      return tile?.deposit?.remaining === undefined || tile.deposit.remaining <= 0;
    }).length;

  // Calculate SPM from delivery history
  const recentHistory = world.deliveryHistory.filter(h => h.tick >= world.tick - TICKS_PER_MINUTE);
  const totalDelivered = recentHistory.reduce((sum, h) => sum + (h.amount || 0), 0);
  const spm = totalDelivered;

  return {
    width: world.width,
    height: world.height,
    tick: world.tick,
    hubOrigin: world.hubOrigin,
    delivered: { ...world.delivered },
    spm,
    buildingCount: buildings.length,
    activeCount,
    faultedCount,
    depletedMinerCount,
    unlockedTechs: [...world.unlockedTechs],
    completedQuests: [...world.completedQuests],
    researchPoints: world.researchPoints ?? 0,
    techTree: getTechTreeStatus(world),
    tutorialProgress: getTutorialProgress(world),
    activeQuests: getActiveQuests(world),
  };
}

/**
 * Inspect a rectangular region of the map
 */
export function inspectRegion(
  world: WorldState,
  params: { x: number; y: number; width: number; height: number }
): TileEntry[] {
  let { x, y, width, height } = params;

  // Clamp to map bounds
  x = Math.max(0, Math.min(x, world.width - 1));
  y = Math.max(0, Math.min(y, world.height - 1));
  width = Math.min(width, MAX_REGION_DIM, world.width - x);
  height = Math.min(height, MAX_REGION_DIM, world.height - y);

  const entries: TileEntry[] = [];

  for (let ty = y; ty < y + height; ty++) {
    for (let tx = x; tx < x + width; tx++) {
      const tile = world.tiles[ty]?.[tx];
      if (!tile) continue;

      const entry: TileEntry = {
        x: tx,
        y: ty,
        terrain: tile.terrain,
      };

      if (tile.deposit && tile.deposit.remaining > 0) {
        entry.deposit = {
          material: tile.deposit.material,
          remaining: tile.deposit.remaining,
        };
      }

      if (tile.buildingId) {
        const building = world.buildings[tile.buildingId];
        if (building) {
          const inputCount = Object.values(building.inputBuffer).reduce((sum, v) => sum + (v || 0), 0);
          const outputCount = Object.values(building.outputBuffer).reduce((sum, v) => sum + (v || 0), 0);
          entry.building = {
            id: building.id,
            type: building.type,
            direction: building.direction,
            recipeId: building.recipeId,
            faulted: building.faulted,
            inputCount,
            outputCount,
          };
        }
      }

      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Find resources matching criteria
 */
export function findResources(
  world: WorldState,
  params?: { material?: MaterialId; onlyAvailable?: boolean; limit?: number }
): ResourceInfo[] {
  const { material, onlyAvailable = true, limit } = params || {};
  const results: ResourceInfo[] = [];

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const tile = world.tiles[y]?.[x];
      if (!tile || !tile.deposit) continue;

      const deposit = tile.deposit;
      if (material && deposit.material !== material) continue;
      if (onlyAvailable && deposit.remaining <= 0) continue;

      const dx = x - world.hubOrigin.x;
      const dy = y - world.hubOrigin.y;
      const distanceManhattan = Math.abs(dx) + Math.abs(dy);
      const distanceEuclidean = Math.sqrt(dx * dx + dy * dy);

      results.push({
        material: deposit.material,
        x,
        y,
        remaining: deposit.remaining,
        distanceManhattan,
        distanceEuclidean,
      });
    }
  }

  // Sort by distance (closest first)
  results.sort((a, b) => a.distanceManhattan - b.distanceManhattan);

  // Apply limit
  if (limit && limit > 0) {
    return results.slice(0, limit);
  }

  return results;
}

/**
 * List recipes from catalog
 */
export function listRecipes(
  world: WorldState,
  params?: { onlyUnlocked?: boolean }
): RecipeInfo[] {
  const { onlyUnlocked = false } = params || {};
  const results: RecipeInfo[] = [];

  for (const [id, recipe] of Object.entries(RECIPE_CATALOG)) {
    const recipeId = id as RecipeId;
    
    // Check if recipe is unlocked using progression module
    const unlocked = isRecipeUnlocked(world, recipeId);

    if (onlyUnlocked && !unlocked) continue;

    results.push({
      id: recipeId,
      nameJa: recipe.nameJa,
      building: recipe.building,
      inputs: { ...recipe.inputs },
      outputs: { ...recipe.outputs },
      craftTicks: recipe.craftTicks,
      unlocked,
    });
  }

  return results;
}

/**
 * Get performance metrics
 */
export function getMetrics(
  world: WorldState,
  params?: { windowTicks?: number }
): Metrics {
  const { windowTicks = TICKS_PER_MINUTE } = params || {};

  // Calculate SPM from delivery history within window
  const cutoffTick = world.tick - windowTicks;
  const recentHistory = world.deliveryHistory.filter(h => h.tick >= cutoffTick);

  // Per-material delivery rates
  const deliveriesByMaterial: Partial<Record<MaterialId, number>> = {};
  for (const entry of recentHistory) {
    deliveriesByMaterial[entry.material] = (deliveriesByMaterial[entry.material] || 0) + entry.amount;
  }

  // Normalize to per-minute (if window is not exactly one minute)
  const scale = TICKS_PER_MINUTE / windowTicks;
  for (const mat of Object.keys(deliveriesByMaterial)) {
    deliveriesByMaterial[mat as MaterialId] = Math.round((deliveriesByMaterial[mat as MaterialId] || 0) * scale);
  }

  const spm = recentHistory.reduce((sum, h) => sum + (h.amount || 0), 0);

  // Find bottleneck candidates
  const bottlenecks: BottleneckCandidate[] = [];
  for (const building of Object.values(world.buildings)) {
    if (building.blockedTicks > 0 || building.idleTicks > 0) {
      bottlenecks.push({
        buildingId: building.id,
        type: building.type,
        x: building.x,
        y: building.y,
        blockedTicks: building.blockedTicks,
        idleTicks: building.idleTicks,
      });
    }
  }

  // Generate alerts
  const alerts: Alert[] = [];

  // Collect sensor alerts from reliability module
  const sensorAlerts = collectSensorAlerts(world);
  for (const sensorAlert of sensorAlerts) {
    alerts.push({
      type: sensorAlert.alertType === "jam" ? "faulted" : sensorAlert.alertType === "depleted" ? "depleted" : "faulted",
      buildingId: sensorAlert.buildingId,
      x: world.buildings[sensorAlert.buildingId]?.x || 0,
      y: world.buildings[sensorAlert.buildingId]?.y || 0,
      message: sensorAlert.message,
    });
  }

  // Also add faulted and depleted alerts from non-sensor buildings
  // Faulted buildings
  for (const building of Object.values(world.buildings)) {
    if (building.faulted && !sensorAlerts.some(sa => sa.buildingId === building.id)) {
      alerts.push({
        type: "faulted",
        buildingId: building.id,
        x: building.x,
        y: building.y,
        message: `Building ${building.id} (${building.type}) is faulted`,
      });
    }
  }

  // Depleted miners
  for (const building of Object.values(world.buildings)) {
    if (building.type === "miner") {
      const tile = world.tiles[building.y]?.[building.x];
      if (tile?.deposit && tile.deposit.remaining <= 0) {
        if (!sensorAlerts.some(sa => sa.buildingId === building.id)) {
          alerts.push({
            type: "depleted",
            buildingId: building.id,
            x: building.x,
            y: building.y,
            message: `Miner ${building.id} has depleted its resource`,
          });
        }
      }
    }
  }

  return {
    spm,
    deliveriesPerMinute: deliveriesByMaterial,
    bottlenecks,
    alerts,
    researchPoints: world.researchPoints ?? 0,
  };
}
