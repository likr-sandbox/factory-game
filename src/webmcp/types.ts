// WebMCP type definitions for factory game simulation
// Pure TypeScript - ZERO Phaser dependencies

import type { Direction, BuildingType, MaterialId, RecipeId } from "../sim/types";

// ============================================================================
// Tool Name Types
// ============================================================================

export type ReadToolName =
  | "get_factory_summary"
  | "inspect_region"
  | "find_resources"
  | "list_recipes"
  | "get_metrics";

export type MutateToolName =
  | "place_building"
  | "place_belt_line"
  | "remove_area"
  | "set_recipe"
  | "batch_actions";

export type WebMcpToolName = ReadToolName | MutateToolName;

// ============================================================================
// Model Context Types
// ============================================================================

export interface ModelContextToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

export interface ModelContextLike {
  registerTool: (tool: ModelContextToolDefinition) => void | Promise<void>;
}

// ============================================================================
// Detection Types
// ============================================================================

export interface WebMcpDetectionResult {
  detected: boolean;
  source: "document.modelContext" | "navigator.modelContext" | "none";
  context: ModelContextLike | null;
}

// ============================================================================
// Logging and Handle Types
// ============================================================================

export interface ToolCallLogEntry {
  id: number;
  timestamp: string;
  toolName: string;
  input: Record<string, unknown>;
  success: boolean;
  durationMs: number;
  resultSummary: string;
  error?: string;
}

export type ToolCallLogListener = (entry: ToolCallLogEntry) => void;

export interface WebMcpHandle {
  detected: boolean;
  source: WebMcpDetectionResult["source"];
  registeredTools: string[];
  getLogs: () => readonly ToolCallLogEntry[];
  subscribe: (listener: ToolCallLogListener) => () => void;
  invokeTool: (toolName: string, input?: Record<string, unknown>) => Promise<unknown>;
}
