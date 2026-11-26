// WebMCP read tool handlers wrapping src/sim/query.ts
// Pure TypeScript - ZERO Phaser dependencies

import type { WorldState } from "../sim/types";
import {
  getFactorySummary,
  inspectRegion,
  findResources,
  listRecipes,
  getMetrics,
} from "../sim/query";
import type { ReadToolName } from "./types";

/**
 * Create read tool handlers that wrap query functions.
 * Returns raw objects/arrays directly (no { success: true } wrapping).
 */
export function createReadToolHandlers(
  getWorld: () => WorldState
): Record<ReadToolName, (input: Record<string, unknown>) => unknown> {
  return {
    get_factory_summary: (input: Record<string, unknown>) => {
      // Validate input is an object
      if (input === null || typeof input !== "object") {
        throw new Error("get_factory_summary: input must be an object");
      }
      const world = getWorld();
      return getFactorySummary(world);
    },

    inspect_region: (input: Record<string, unknown>) => {
      // Validate required parameters
      const { x, y, width, height } = input;

      if (x === undefined || y === undefined || width === undefined || height === undefined) {
        throw new Error(
          "inspect_region: missing required parameters x, y, width, height"
        );
      }

      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof width !== "number" ||
        typeof height !== "number"
      ) {
        throw new Error(
          "inspect_region: parameters x, y, width, height must be finite numbers"
        );
      }

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(
          "inspect_region: parameters x, y, width, height must be finite numbers"
        );
      }

      const world = getWorld();
      return inspectRegion(world, { x, y, width, height });
    },

    find_resources: (input: Record<string, unknown>) => {
      // Validate input is an object or undefined
      if (input !== undefined && (input === null || typeof input !== "object")) {
        throw new Error("find_resources: input must be an object");
      }

      const params = input || {};
      const material = params.material as import("../sim/types").MaterialId | undefined;
      const onlyAvailable = params.onlyAvailable as boolean | undefined;
      const limit = params.limit as number | undefined;

      const world = getWorld();
      return findResources(world, { material, onlyAvailable, limit });
    },

    list_recipes: (input: Record<string, unknown>) => {
      // Validate input is an object or undefined
      if (input !== undefined && (input === null || typeof input !== "object")) {
        throw new Error("list_recipes: input must be an object");
      }

      const params = input || {};
      const onlyUnlocked = params.onlyUnlocked as boolean | undefined;

      const world = getWorld();
      return listRecipes(world, { onlyUnlocked });
    },

    get_metrics: (input: Record<string, unknown>) => {
      // Validate input is an object or undefined
      if (input !== undefined && (input === null || typeof input !== "object")) {
        throw new Error("get_metrics: input must be an object");
      }

      const params = input || {};
      const windowTicks = params.windowTicks as number | undefined;

      const world = getWorld();
      return getMetrics(world, { windowTicks });
    },
  };
}
