// WebMCP bridge for factory game - composes readTools and buildTools
// Pure TypeScript - ZERO Phaser dependencies

import type { WorldState } from "../sim/types";
import type { ModelContextLike } from "./types";
import type { WebMcpDetectionResult, ToolCallLogEntry, ToolCallLogListener, WebMcpHandle } from "./types";
import { TOOL_SCHEMAS, ALL_TOOL_NAMES } from "./schemas";
import { createReadToolHandlers } from "./readTools";
import { createBuildToolHandlers } from "./buildTools";

// ============================================================================
// Model Context Detection
// ============================================================================

export function detectModelContext(
  env?: { document?: { modelContext?: ModelContextLike }; navigator?: { modelContext?: ModelContextLike } }
): WebMcpDetectionResult {
  // Safe check in Node/Vitest when globalThis.document/navigator are undefined
  const doc = env?.document ?? (globalThis as unknown as { document?: { modelContext?: ModelContextLike } }).document;
  const nav = env?.navigator ?? (globalThis as unknown as { navigator?: { modelContext?: ModelContextLike } }).navigator;

  // Check document.modelContext first
  if (doc && doc.modelContext) {
    return { detected: true, source: "document.modelContext", context: doc.modelContext };
  }

  // Fallback to navigator.modelContext
  if (nav && nav.modelContext) {
    return { detected: true, source: "navigator.modelContext", context: nav.modelContext };
  }

  return { detected: false, source: "none", context: null };
}

// ============================================================================
// Ring Buffer Log History
// ============================================================================

export class RingBufferLogHistory {
  private entries: ToolCallLogEntry[] = [];
  private capacity: number;
  private listeners: Set<ToolCallLogListener> = new Set();

  constructor(capacity: number = 50) {
    this.capacity = capacity;
  }

  push(entry: ToolCallLogEntry): void {
    this.entries.push(entry);
    // Evict oldest entries if over capacity
    while (this.entries.length > this.capacity) {
      this.entries.shift();
    }
    // Notify all subscribers
    for (const listener of this.listeners) {
      listener(entry);
    }
  }

  getEntries(): readonly ToolCallLogEntry[] {
    return [...this.entries];
  }

  subscribe(listener: ToolCallLogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// ============================================================================
// WebMCP Handle Registration
// ============================================================================

export function registerFactoryWebMcpTools(options: {
  getWorld: () => WorldState;
  onWorldMutated?: () => void;
  maxLogEntries?: number;
  env?: { document?: { modelContext?: ModelContextLike }; navigator?: { modelContext?: ModelContextLike } };
}): WebMcpHandle {
  const { getWorld, onWorldMutated, maxLogEntries = 50, env } = options;

  // Detect model context
  const detection = detectModelContext(env);
  const history = new RingBufferLogHistory(maxLogEntries);

  // Create tool handlers
  const readHandlers = createReadToolHandlers(getWorld);
  const buildHandlers = createBuildToolHandlers(getWorld, onWorldMutated);

  // Merge all handlers
  const allHandlers: Record<string, (input: Record<string, unknown>) => unknown> = {
    ...readHandlers,
    ...buildHandlers,
  };

  // Track log ID
  let logId = 0;

  // Register tools with model context if available
  const registeredTools: string[] = [];
  if (detection.detected && detection.context) {
    for (const toolName of ALL_TOOL_NAMES) {
      const schema = TOOL_SCHEMAS[toolName];
      detection.context.registerTool({
        name: schema.name,
        description: schema.description,
        inputSchema: schema.inputSchema,
        execute: async (input: Record<string, unknown>) => {
          const handler = allHandlers[toolName];
          if (!handler) {
            throw new Error(`No handler found for tool: ${toolName}`);
          }
          const start = performance.now();
          try {
            const result = handler(input);
            const durationMs = performance.now() - start;
            
            // Check if result is ActionResult with success: false
            const isSuccess = result && typeof result === "object" && "success" in result 
              ? (result as { success: boolean }).success === true
              : true;
            
            const entry: ToolCallLogEntry = {
              id: logId++,
              timestamp: new Date().toISOString(),
              toolName,
              input,
              success: isSuccess,
              durationMs,
              resultSummary: isSuccess 
                ? JSON.stringify(result).slice(0, 200)
                : JSON.stringify(result).slice(0, 200),
            };
            history.push(entry);
            return result;
          } catch (error) {
            const durationMs = performance.now() - start;
            const entry: ToolCallLogEntry = {
              id: logId++,
              timestamp: new Date().toISOString(),
              toolName,
              input,
              success: false,
              durationMs,
              resultSummary: error instanceof Error ? error.message : String(error),
              error: error instanceof Error ? error.message : String(error),
            };
            history.push(entry);
            throw error;
          }
        },
      });
      registeredTools.push(toolName);
    }
  }

  // Return handle
  return {
    detected: detection.detected,
    source: detection.source,
    registeredTools,
    getLogs: () => history.getEntries(),
    subscribe: (listener: ToolCallLogListener) => history.subscribe(listener),
    invokeTool: async (toolName: string, input: Record<string, unknown> = {}) => {
      if (!allHandlers[toolName]) {
        throw new Error(`Unknown tool: ${toolName}`);
      }
      const start = performance.now();
      try {
        const result = allHandlers[toolName](input);
        const durationMs = performance.now() - start;
        
        // Check if result is ActionResult with success: false
        const isSuccess = result && typeof result === "object" && "success" in result 
          ? (result as { success: boolean }).success === true
          : true;
        
        const entry: ToolCallLogEntry = {
          id: logId++,
          timestamp: new Date().toISOString(),
          toolName,
          input,
          success: isSuccess,
          durationMs,
          resultSummary: isSuccess 
            ? JSON.stringify(result).slice(0, 200)
            : JSON.stringify(result).slice(0, 200),
        };
        history.push(entry);
        return result;
      } catch (error) {
        const durationMs = performance.now() - start;
        const entry: ToolCallLogEntry = {
          id: logId++,
          timestamp: new Date().toISOString(),
          toolName,
          input,
          success: false,
          durationMs,
          resultSummary: error instanceof Error ? error.message : String(error),
          error: error instanceof Error ? error.message : String(error),
        };
        history.push(entry);
        throw error;
      }
    },
  };
}
