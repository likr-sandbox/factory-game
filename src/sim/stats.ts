// SPM (Science/Modules Per Minute) statistics module
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { MaterialId, DeliveryRecord, WorldState } from "./types";
import { MATERIAL_CATALOG } from "./catalog";

export const TICKS_PER_MINUTE = 600; // 10 ticks/s * 60s = 600 ticks

interface SpmWindowEntry {
  tick: number;
  deliveries: Partial<Record<MaterialId, number>>;
}

export interface SpmSummary {
  totalSpm: number;
  perMaterial: Partial<Record<MaterialId, number>>;
  windowStartTick: number;
  windowEndTick: number;
}

// Sliding window for delivery tracking
const spmWindow: SpmWindowEntry[] = [];

/**
 * Add a delivery record to the SPM tracking window
 */
export function recordDelivery(tick: number, material: MaterialId, amount: number): void {
  const lastEntry = spmWindow[spmWindow.length - 1];
  
  if (!lastEntry || lastEntry.tick !== tick) {
    spmWindow.push({ tick, deliveries: { [material]: amount } });
  } else {
    lastEntry.deliveries[material] = (lastEntry.deliveries[material] || 0) + amount;
  }
  
  // Prune old entries outside the window
  const cutoffTick = tick - TICKS_PER_MINUTE;
  while (spmWindow.length > 0) {
    const firstEntry = spmWindow[0];
    if (firstEntry && firstEntry.tick < cutoffTick) {
      spmWindow.shift();
    } else {
      break;
    }
  }
}

/**
 * Calculate SPM over the sliding window
 */
export function calculateSpm(currentTick: number): SpmSummary {
  const windowStartTick = Math.max(0, currentTick - TICKS_PER_MINUTE);
  const windowEndTick = currentTick;
  
  // Aggregate deliveries in the window
  const windowDeliveries: Partial<Record<MaterialId, number>> = {};
  
  for (const entry of spmWindow) {
    if (entry.tick >= windowStartTick) {
      for (const [material, amount] of Object.entries(entry.deliveries)) {
        windowDeliveries[material as MaterialId] = 
          (windowDeliveries[material as MaterialId] || 0) + amount;
      }
    }
  }
  
  // Calculate SPM (amount per minute)
  const perMaterial: Partial<Record<MaterialId, number>> = {};
  let totalSpm = 0;
  
  for (const materialStr of Object.keys(windowDeliveries)) {
    const material = materialStr as MaterialId;
    const value = windowDeliveries[material] || 0;
    // Count "final" and "electronic" category materials as science points
    const matInfo = MATERIAL_CATALOG[material];
    if (matInfo && (matInfo.category === "final" || matInfo.category === "electronic")) {
      perMaterial[material] = value;
      totalSpm += value;
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
 * Update world.spm with current SPM stats
 */
export function updateSpmStats(world: WorldState): void {
  const summary = calculateSpm(world.tick);
  world.spm = summary.perMaterial as Partial<Record<string, number>>;
  (world.spm as Record<string, number>).total = summary.totalSpm;
}

/**
 * Get SPM summary for the current state
 */
export function getSpmSummary(world: WorldState): SpmSummary {
  return calculateSpm(world.tick);
}

/**
 * Reset the SPM tracking window (for testing)
 */
export function resetSpmWindow(): void {
  spmWindow.length = 0;
}

/**
 * Process delivery history into SPM window (initialization)
 */
export function initializeFromHistory(history: DeliveryRecord[], currentTick: number): void {
  resetSpmWindow();
  
  const cutoffTick = currentTick - TICKS_PER_MINUTE;
  
  for (const record of history) {
    if (record.tick >= cutoffTick) {
      recordDelivery(record.tick, record.material, record.amount);
    }
  }
}
