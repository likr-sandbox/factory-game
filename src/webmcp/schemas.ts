// WebMCP JSON Schemas for factory game tools
// Pure TypeScript - ZERO Phaser dependencies

import type { WebMcpToolName, ReadToolName, MutateToolName } from "./types";
import type { Direction, BuildingType, MaterialId, RecipeId } from "../sim/types";

export const READ_TOOL_NAMES: readonly ReadToolName[] = [
  "get_factory_summary",
  "inspect_region",
  "find_resources",
  "list_recipes",
  "get_metrics",
] as const;

export const MUTATE_TOOL_NAMES: readonly MutateToolName[] = [
  "place_building",
  "place_belt_line",
  "remove_area",
  "set_recipe",
  "batch_actions",
  "unlock_tech",
] as const;

export const ALL_TOOL_NAMES: readonly WebMcpToolName[] = [
  ...READ_TOOL_NAMES,
  ...MUTATE_TOOL_NAMES,
] as const;

// ============================================================================
// Tool Schema Definitions
// ============================================================================

export interface ToolSchema {
  name: WebMcpToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOL_SCHEMAS: Record<WebMcpToolName, ToolSchema> = {
  // --- Read Tools ---
  get_factory_summary: {
    name: "get_factory_summary",
    description:
      "Get a comprehensive summary of the current factory state including buildings, resources, and production metrics.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  inspect_region: {
    name: "inspect_region",
    description:
      "Inspect a rectangular region of the world, returning terrain, buildings, and resources within the bounds. Parameters x, y, width, height must be integers. Maximum region size is 24×24.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Top-left X coordinate (integer)" },
        y: { type: "number", description: "Top-left Y coordinate (integer)" },
        width: { type: "number", description: "Width of the region (integer, <= 24)" },
        height: { type: "number", description: "Height of the region (integer, <= 24)" },
      },
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
    },
  },
  find_resources: {
    name: "find_resources",
    description:
      "Find all resource deposits, optionally filtered by material type, availability, and result limit. limit must be a positive integer if provided.",
    inputSchema: {
      type: "object",
      properties: {
        material: { type: "string", enum: ["iron_ore", "copper_ore", "coal", "silica_sand", "iron_plate", "copper_plate", "iron_gear", "copper_wire", "steel_plate", "silicon_wafer", "circuit_board", "microchip", "automation_module", "slag"], description: "Filter by material type" },
        onlyAvailable: { type: "boolean", description: "Only return deposits with remaining > 0 (default: true)" },
        limit: { type: "number", description: "Maximum number of results to return (positive integer)" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  list_recipes: {
    name: "list_recipes",
    description:
      "List all available recipes, optionally filtered to only unlocked recipes.",
    inputSchema: {
      type: "object",
      properties: {
        onlyUnlocked: { type: "boolean", description: "Only return unlocked recipes" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  get_metrics: {
    name: "get_metrics",
    description:
      "Get production and efficiency metrics for the factory, including SPM and delivery statistics. windowTicks must be a positive integer if provided.",
    inputSchema: {
      type: "object",
      properties: {
        windowTicks: { type: "number", description: "Number of ticks to aggregate metrics over (positive integer, default: 3600)" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  // --- Mutate Tools ---
  place_building: {
    name: "place_building",
    description:
      "Place a building at the specified coordinates with the given orientation and configuration.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate where to place the building" },
        y: { type: "number", description: "Y coordinate where to place the building" },
        type: { type: "string", enum: ["miner", "belt", "splitter", "filter_splitter", "underground_belt", "smelter", "assembler", "recycler", "sensor", "hub"], description: "Type of building to place" },
        direction: { type: "string", enum: ["N", "E", "S", "W"], description: "Direction the building faces" },
        recipeId: { type: "string", enum: ["iron_plate", "copper_plate", "iron_plate_high", "copper_plate_high", "iron_gear", "copper_wire", "steel_plate", "silicon_wafer", "circuit_board", "microchip", "automation_module"], description: "Recipe ID for buildings that support recipes" },
        filterMaterial: { type: "string", enum: ["iron_ore", "copper_ore", "coal", "silica_sand", "iron_plate", "copper_plate", "iron_gear", "copper_wire", "steel_plate", "silicon_wafer", "circuit_board", "microchip", "automation_module", "slag"], description: "Filter material for filter-capable buildings" },
      },
      required: ["x", "y", "type", "direction"],
      additionalProperties: false,
    },
  },
  place_belt_line: {
    name: "place_belt_line",
    description:
      "Place a line of conveyor belts between two points, automatically creating corners as needed.",
    inputSchema: {
      type: "object",
      properties: {
        startX: { type: "number", description: "Starting X coordinate" },
        startY: { type: "number", description: "Starting Y coordinate" },
        endX: { type: "number", description: "Ending X coordinate" },
        endY: { type: "number", description: "Ending Y coordinate" },
        cornerFirst: { type: "string", enum: ["x", "y"], description: "Which axis to turn first when creating corners" },
      },
      required: ["startX", "startY", "endX", "endY"],
      additionalProperties: false,
    },
  },
  remove_area: {
    name: "remove_area",
    description:
      "Remove all buildings within a rectangular area, returning them to inventory.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Top-left X coordinate of the area" },
        y: { type: "number", description: "Top-left Y coordinate of the area" },
        width: { type: "number", description: "Width of the area" },
        height: { type: "number", description: "Height of the area" },
      },
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
    },
  },
  set_recipe: {
    name: "set_recipe",
    description:
      "Set the recipe or filter material for a building at the specified location.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate of the target building" },
        y: { type: "number", description: "Y coordinate of the target building" },
        recipeId: { type: "string", enum: ["iron_plate", "copper_plate", "iron_plate_high", "copper_plate_high", "iron_gear", "copper_wire", "steel_plate", "silicon_wafer", "circuit_board", "microchip", "automation_module"], description: "Recipe ID to set" },
        filterMaterial: { type: "string", enum: ["iron_ore", "copper_ore", "coal", "silica_sand", "iron_plate", "copper_plate", "iron_gear", "copper_wire", "steel_plate", "silicon_wafer", "circuit_board", "microchip", "automation_module", "slag"], description: "Filter material to set" },
        repair: { type: "boolean", description: "Repair the building if it is faulted" },
      },
      required: ["x", "y"],
      additionalProperties: false,
    },
  },
  batch_actions: {
    name: "batch_actions",
    description:
      "Execute multiple actions atomically. If atomic is true, all actions succeed or none do.",
    inputSchema: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["place_building", "place_belt_line", "remove_area", "set_recipe"] },
              input: { type: "object" },
            },
            required: ["kind", "input"],
          },
          description: "List of actions to execute",
        },
        atomic: { type: "boolean", description: "Execute all actions atomically" },
      },
      required: ["actions"],
      additionalProperties: false,
    },
  },
  unlock_tech: {
    name: "unlock_tech",
    description:
      "Unlock a technology using available research points. Returns success if unlocked, or error if insufficient points or invalid tech ID.",
    inputSchema: {
      type: "object",
      properties: {
        techId: {
          type: "string",
          enum: ["underground_belt", "filter_splitter", "high_efficiency", "sensor", "recycler", "advanced_smelting", "electronics", "automation"],
          description: "The technology ID to unlock",
        },
      },
      required: ["techId"],
      additionalProperties: false,
    },
  },
};
