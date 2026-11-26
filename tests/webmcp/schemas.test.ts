// Unit tests for WebMCP tool schemas
import { describe, it, expect } from "vitest";
import {
  ALL_TOOL_NAMES,
  READ_TOOL_NAMES,
  MUTATE_TOOL_NAMES,
  TOOL_SCHEMAS,
} from "../../src/webmcp/schemas";

describe("WebMCP Tool Names", () => {
  it("should have exactly 10 tools in ALL_TOOL_NAMES", () => {
    expect(ALL_TOOL_NAMES).toHaveLength(10);
  });

  it("should have exactly 5 read tools", () => {
    expect(READ_TOOL_NAMES).toHaveLength(5);
    expect(READ_TOOL_NAMES).toEqual(
      expect.arrayContaining([
        "get_factory_summary",
        "inspect_region",
        "find_resources",
        "list_recipes",
        "get_metrics",
      ])
    );
  });

  it("should have exactly 5 mutate tools", () => {
    expect(MUTATE_TOOL_NAMES).toHaveLength(5);
    expect(MUTATE_TOOL_NAMES).toEqual(
      expect.arrayContaining([
        "place_building",
        "place_belt_line",
        "remove_area",
        "set_recipe",
        "batch_actions",
      ])
    );
  });

  it("should not have duplicate tool names", () => {
    const uniqueNames = new Set(ALL_TOOL_NAMES);
    expect(uniqueNames.size).toBe(10);
  });
});

describe("Tool Schema Structure", () => {
  it("should have a schema entry for every tool name", () => {
    for (const toolName of ALL_TOOL_NAMES) {
      expect(TOOL_SCHEMAS[toolName]).toBeDefined();
    }
  });

  it("should have non-empty English descriptions for all tools", () => {
    for (const toolName of ALL_TOOL_NAMES) {
      const schema = TOOL_SCHEMAS[toolName];
      expect(schema.description).toBeDefined();
      expect(typeof schema.description).toBe("string");
      expect(schema.description.length).toBeGreaterThan(0);
      // Verify description is in English (no Japanese characters)
      expect(schema.description).not.toMatch(/[\u3040-\u309F\u30A0-\u30FF]/);
    }
  });

  it("should have valid JSON Schema object structure", () => {
    for (const toolName of ALL_TOOL_NAMES) {
      const schema = TOOL_SCHEMAS[toolName];
      expect(schema.inputSchema).toBeDefined();
      expect(typeof schema.inputSchema).toBe("object");
      expect((schema.inputSchema as Record<string, unknown>).type).toBe("object");
      expect((schema.inputSchema as Record<string, unknown>).properties).toBeDefined();
      expect(typeof (schema.inputSchema as Record<string, unknown>).properties).toBe("object");
    }
  });
});

describe("Read Tool Schemas", () => {
  it("get_factory_summary should have empty properties", () => {
    const schema = TOOL_SCHEMAS.get_factory_summary;
    const props = schema.inputSchema as Record<string, unknown>;
    expect(props.properties).toEqual({});
    expect(Array.isArray(props.required)).toBe(true);
    expect((props.required as string[]).length).toBe(0);
  });

  it("inspect_region should require x, y, width, height", () => {
    const schema = TOOL_SCHEMAS.inspect_region;
    const props = schema.inputSchema as Record<string, unknown>;
    expect(props.required).toEqual(["x", "y", "width", "height"]);
  });

  it("find_resources should have optional material, onlyAvailable, limit properties", () => {
    const schema = TOOL_SCHEMAS.find_resources;
    const props = schema.inputSchema as Record<string, unknown>;
    expect((props.properties as Record<string, unknown>)?.material).toBeDefined();
    expect((props.properties as Record<string, unknown>)?.onlyAvailable).toBeDefined();
    expect((props.properties as Record<string, unknown>)?.limit).toBeDefined();
    expect(Array.isArray(props.required)).toBe(true);
    expect((props.required as string[]).length).toBe(0);
  });

  it("list_recipes should have optional onlyUnlocked property", () => {
    const schema = TOOL_SCHEMAS.list_recipes;
    const props = schema.inputSchema as Record<string, unknown>;
    expect((props.properties as Record<string, unknown>)?.onlyUnlocked).toBeDefined();
  });

  it("get_metrics should have optional windowTicks property", () => {
    const schema = TOOL_SCHEMAS.get_metrics;
    const props = schema.inputSchema as Record<string, unknown>;
    expect((props.properties as Record<string, unknown>)?.windowTicks).toBeDefined();
  });
});

describe("Mutate Tool Schemas", () => {
  it("place_building should require x, y, type, direction", () => {
    const schema = TOOL_SCHEMAS.place_building;
    const props = schema.inputSchema as Record<string, unknown>;
    expect(props.required).toEqual(["x", "y", "type", "direction"]);
  });

  it("place_building type should have all BuildingType values", () => {
    const schema = TOOL_SCHEMAS.place_building;
    const props = schema.inputSchema as Record<string, unknown>;
    const typeEnum = ((props.properties as Record<string, unknown>)?.type as Record<string, unknown>)
      .enum as string[];
    expect(typeEnum).toContain("miner");
    expect(typeEnum).toContain("belt");
    expect(typeEnum).toContain("smelter");
    expect(typeEnum).toContain("assembler");
    expect(typeEnum).toContain("hub");
  });

  it("place_building direction should have N, E, S, W", () => {
    const schema = TOOL_SCHEMAS.place_building;
    const props = schema.inputSchema as Record<string, unknown>;
    const dirEnum = ((props.properties as Record<string, unknown>)?.direction as Record<string, unknown>)
      .enum as string[];
    expect(dirEnum).toEqual(["N", "E", "S", "W"]);
  });

  it("place_belt_line should require startX, startY, endX, endY", () => {
    const schema = TOOL_SCHEMAS.place_belt_line;
    const props = schema.inputSchema as Record<string, unknown>;
    expect(props.required).toEqual(["startX", "startY", "endX", "endY"]);
  });

  it("remove_area should require x, y, width, height", () => {
    const schema = TOOL_SCHEMAS.remove_area;
    const props = schema.inputSchema as Record<string, unknown>;
    expect(props.required).toEqual(["x", "y", "width", "height"]);
  });

  it("set_recipe should require x, y but have optional recipeId and filterMaterial", () => {
    const schema = TOOL_SCHEMAS.set_recipe;
    const props = schema.inputSchema as Record<string, unknown>;
    expect(props.required).toEqual(["x", "y"]);
    expect((props.properties as Record<string, unknown>)?.recipeId).toBeDefined();
    expect((props.properties as Record<string, unknown>)?.filterMaterial).toBeDefined();
  });

  it("batch_actions should require actions array", () => {
    const schema = TOOL_SCHEMAS.batch_actions;
    const props = schema.inputSchema as Record<string, unknown>;
    expect(props.required).toEqual(["actions"]);
    expect((props.properties as Record<string, unknown>)?.atomic).toBeDefined();
  });
});

describe("Schema additionalProperties constraint", () => {
  it("all schemas should have additionalProperties set to false", () => {
    for (const toolName of ALL_TOOL_NAMES) {
      const schema = TOOL_SCHEMAS[toolName];
      const props = schema.inputSchema as Record<string, unknown>;
      expect(props.additionalProperties).toBe(false);
    }
  });
});
