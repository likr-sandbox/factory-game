// WebMCP bridge tests
import { describe, it, expect, vi } from "vitest";
import { detectModelContext, RingBufferLogHistory, registerFactoryWebMcpTools } from "../../src/webmcp/bridge";
import { ALL_TOOL_NAMES } from "../../src/webmcp/schemas";
import { createWorld } from "../../src/sim/world";

describe("detectModelContext", () => {
  it("should detect document.modelContext", () => {
    const mockContext = { registerTool: vi.fn() };
    const env = { document: { modelContext: mockContext } };
    const result = detectModelContext(env);
    expect(result).toEqual({ detected: true, source: "document.modelContext", context: mockContext });
  });

  it("should fallback to navigator.modelContext when document is absent", () => {
    const mockContext = { registerTool: vi.fn() };
    const env = { navigator: { modelContext: mockContext } };
    const result = detectModelContext(env);
    expect(result).toEqual({ detected: true, source: "navigator.modelContext", context: mockContext });
  });

  it("should prefer document over navigator", () => {
    const docContext = { registerTool: vi.fn() };
    const navContext = { registerTool: vi.fn() };
    const env = { document: { modelContext: docContext }, navigator: { modelContext: navContext } };
    const result = detectModelContext(env);
    expect(result.source).toBe("document.modelContext");
    expect(result.context).toBe(docContext);
  });

  it("should return safe no-op when context is absent", () => {
    const result = detectModelContext();
    expect(result).toEqual({ detected: false, source: "none", context: null });
  });

  it("should handle undefined env gracefully", () => {
    const result = detectModelContext(undefined);
    expect(result.detected).toBe(false);
    expect(result.source).toBe("none");
  });
});

describe("RingBufferLogHistory", () => {
  it("should push and retrieve entries", () => {
    const buffer = new RingBufferLogHistory(50);
    const entry: Parameters<typeof buffer.push>[0] = {
      id: 1,
      timestamp: "2024-01-01T00:00:00Z",
      toolName: "get_factory_summary",
      input: {},
      success: true,
      durationMs: 10,
      resultSummary: "test",
    };
    buffer.push(entry);
    expect(buffer.getEntries()).toHaveLength(1);
    expect(buffer.getEntries()[0]).toBe(entry);
  });

  it("should evict oldest entries past capacity", () => {
    const buffer = new RingBufferLogHistory(3);
    for (let i = 0; i < 5; i++) {
      buffer.push({
        id: i,
        timestamp: `2024-01-01T00:00:${i}Z`,
        toolName: "test",
        input: {},
        success: true,
        durationMs: 1,
        resultSummary: `entry ${i}`,
      });
    }
    const entries = buffer.getEntries();
    expect(entries.length).toBe(3);
    expect(entries[0]?.id).toBe(2); // Oldest remaining
    expect(entries[2]?.id).toBe(4); // Newest
  });

  it("should notify subscribers on push", () => {
    const buffer = new RingBufferLogHistory(50);
    const listener = vi.fn();
    const unsubscribe = buffer.subscribe(listener);
    
    const entry: Parameters<typeof buffer.push>[0] = {
      id: 1,
      timestamp: "2024-01-01T00:00:00Z",
      toolName: "test",
      input: {},
      success: true,
      durationMs: 1,
      resultSummary: "test",
    };
    buffer.push(entry);
    
    expect(listener).toHaveBeenCalledWith(entry);
    
    unsubscribe();
    const listener2 = vi.fn();
    buffer.subscribe(listener2);
    buffer.push({ ...entry, id: 2 });
    expect(listener).toHaveBeenCalledTimes(1); // listener should still only have been called once
    expect(listener2).toHaveBeenCalledTimes(1); // listener2 should have been called for the second push
  });
});

describe("registerFactoryWebMcpTools", () => {
  const getWorld = () => createWorld(42);

  it("should register all 10 tools when detection.context exists", () => {
    const mockContext = { registerTool: vi.fn() };
    const env = { document: { modelContext: mockContext } };
    const handle = registerFactoryWebMcpTools({ getWorld, env });
    
    expect(handle.detected).toBe(true);
    expect(handle.registeredTools).toHaveLength(10);
    expect(handle.registeredTools).toEqual(ALL_TOOL_NAMES);
    expect(mockContext.registerTool).toHaveBeenCalledTimes(10);
  });

  it("should be a safe no-op when detection.context is absent", () => {
    const handle = registerFactoryWebMcpTools({ getWorld });
    expect(handle.detected).toBe(false);
    expect(handle.registeredTools).toHaveLength(0);
  });

  it("should invokeTool record logs and notify subscribers", async () => {
    const handle = registerFactoryWebMcpTools({ getWorld, maxLogEntries: 50 });
    const listener = vi.fn();
    handle.subscribe(listener);
    
    const summary = await handle.invokeTool("get_factory_summary", {});
    expect(summary).toBeDefined();
    
    const logs = handle.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.toolName).toBe("get_factory_summary");
    expect(logs[0]?.success).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it("should log failed calls with success: false", async () => {
    const handle = registerFactoryWebMcpTools({ getWorld });
    
    // place_building on hub (31, 31) should fail but not throw
    const result = await handle.invokeTool("place_building", {
      x: 31,
      y: 31,
      type: "miner",
      direction: "N",
    });
    
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "OCCUPIED" }) });
    
    const logs = handle.getLogs();
    const failedLog = logs.find((l) => l.toolName === "place_building");
    expect(failedLog).toBeDefined();
    expect(failedLog?.success).toBe(false);
  });

  it("should track timing for each tool execution", async () => {
    const handle = registerFactoryWebMcpTools({ getWorld });
    await handle.invokeTool("get_metrics", {});
    
    const logs = handle.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
