// SPM (Science/Modules Per Minute) statistics module
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { MaterialId, DeliveryRecord, WorldState } from "./types";
import { MATERIAL_CATALOG } from "./catalog";
import { TICKS_PER_MINUTE } from "./constants";

// Re-export TICKS_PER_MINUTE for convenience
export { TICKS_PER_MINUTE };

export interface SpmSummary {
  totalSpm: number;
  perMaterial: Partial<Record<MaterialId, number>>;
  windowStartTick: number;
  windowEndTick: number;
}

/**
 * Calculate SPM purely from delivery history without any global state.
 * @param history - The delivery history records
 * @param currentTick - The current simulation tick
 * @param windowTicks - The window size in ticks (defaults to TICKS_PER_MINUTE)
 * @returns SPM summary with per-material and total rates normalized to per-minute
 */
export function calculateSpm(
  history: readonly DeliveryRecord[],
  currentTick: number,
  windowTicks: number = TICKS_PER_MINUTE
): SpmSummary {
  // Validate windowTicks
  if (!Number.isFinite(windowTicks) || windowTicks <= 0) {
    throw new Error(`windowTicks must be a positive finite number, got ${windowTicks}`);
  }

  const windowStartTick = Math.max(0, currentTick - windowTicks);
  const windowEndTick = currentTick;

  // Filter history to entries within the window
  const windowDeliveries: Partial<Record<MaterialId, number>> = {};

  for (const entry of history) {
    if (entry.tick >= windowStartTick && entry.tick <= currentTick) {
      windowDeliveries[entry.material] =
        (windowDeliveries[entry.material] || 0) + entry.amount;
    }
  }

  // Normalize to per-minute rate using scale factor
  const scale = TICKS_PER_MINUTE / windowTicks;
  const perMaterial: Partial<Record<MaterialId, number>> = {};
  let totalSpm = 0;

  for (const materialStr of Object.keys(windowDeliveries)) {
    const material = materialStr as MaterialId;
    const value = windowDeliveries[material] || 0;
    // Count "final" and "electronic" category materials as science points
    const matInfo = MATERIAL_CATALOG[material];
    if (matInfo && (matInfo.category === "final" || matInfo.category === "electronic")) {
      perMaterial[material] = Math.round(value * scale);
      totalSpm += Math.round(value * scale);
    }
  }

  return {
    totalSpm,
    perMaterial,
    windowStartTick,
    windowEndTick,
  };
}

/**
 * Update world.spm with current SPM stats using delivery history.
 */
export function updateSpmStats(world: WorldState, windowTicks?: number): void {
  const summary = calculateSpm(world.deliveryHistory, world.tick, windowTicks);
  world.spm = summary.perMaterial as Partial<Record<string, number>>;
  (world.spm as Record<string, number>).total = summary.totalSpm;
}

/**
 * Get SPM summary for the current world state using delivery history.
 */
export function getSpmSummary(world: WorldState, windowTicks?: number): SpmSummary {
  return calculateSpm(world.deliveryHistory, world.tick, windowTicks);
}
