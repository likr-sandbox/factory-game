// Unit tests for reliability and specialized logistics mechanics

import { describe, it, expect } from "vitest";
import type { WorldState, BuildingState, Direction, MaterialId } from "../../src/sim/types";
import {
  processFilterSplitters,
  processUndergroundBelts,
  processRecyclers,
  processSensors,
  collectSensorAlerts,
  updateReliabilityAndOverload,
} from "../../src/sim/reliability";
import { createWorld, getTile, directionDelta } from "../../src/sim/world";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestWorld(width = 10, height = 10): WorldState {
  const world = createWorld(42);
  world.width = width;
  world.height = height;
  world.tiles = [];
  for (let y = 0; y < height; y++) {
    world.tiles[y] = [];
    for (let x = 0; x < width; x++) {
      world.tiles[y]![x] = {
        x,
        y,
        terrain: "grass",
        deposit: null,
        buildingId: null,
      };
    }
  }
  world.buildings = {};
  world.rngState = 42;
  world.tick = 0;
  return world;
}

function addBuilding(world: WorldState, type: BuildingState["type"], x: number, y: number, direction: Direction = "N"): BuildingState {
  const id = `building_${x}_${y}`;
  const building: BuildingState = {
    id,
    type: type as BuildingState["type"],
    x,
    y,
    direction,
    inputBuffer: {},
    outputBuffer: {},
    beltItems: [],
    craftProgress: 0,
    roundRobinIndex: 0,
    faulted: false,
    load: 0,
    idleTicks: 0,
    blockedTicks: 0,
  };
  world.buildings[id] = building;
  if (world.tiles[y]?.[x]) {
    world.tiles[y][x].buildingId = id;
  }
  return building;
}

// ============================================================================
// Filter Splitter Tests
// ============================================================================

describe("processFilterSplitters", () => {
  it("routes filterMaterial forward and other items to perpendicular sides", () => {
    const world = createTestWorld(5, 5);

    // Add filter splitter at (2, 2) facing N
    const splitter = addBuilding(world, "filter_splitter", 2, 2, "N");
    splitter.filterMaterial = "iron_plate";

    // Add buildings in all directions
    addBuilding(world, "belt", 2, 1, "S"); // Forward (N)
    addBuilding(world, "belt", 3, 2, "W"); // Right (E)
    addBuilding(world, "belt", 1, 2, "E"); // Left (W)

    // Add items to input buffer
    splitter.inputBuffer = { iron_plate: 3, copper_plate: 2 };

    processFilterSplitters(world);

    // Iron plates should go forward to belt's beltItems
    expect(world.buildings["building_2_1"]!.beltItems.length).toBe(3);
    // Copper plates should go to perpendicular sides (round-robin)
    expect(world.buildings["building_3_2"]!.beltItems.length).toBe(1);
    expect(world.buildings["building_1_2"]!.beltItems.length).toBe(1);
  });

  it("handles round-robin distribution to perpendicular outputs", () => {
    const world = createTestWorld(5, 5);

    const splitter = addBuilding(world, "filter_splitter", 2, 2, "S");
    splitter.filterMaterial = "iron_plate";
    addBuilding(world, "belt", 2, 3, "N"); // Forward
    addBuilding(world, "belt", 3, 2, "W"); // Right
    addBuilding(world, "belt", 1, 2, "E"); // Left

    splitter.inputBuffer = { copper_plate: 4 };

    processFilterSplitters(world);

    // Should distribute evenly between perpendicular sides
    const right = world.buildings["building_3_2"]!.beltItems.length;
    const left = world.buildings["building_1_2"]!.beltItems.length;
    expect(right + left).toBe(4);
  });
});

// ============================================================================
// Underground Belt Tests
// ============================================================================

describe("processUndergroundBelts", () => {
  it("bridges items to matching underground belt within range", () => {
    const world = createTestWorld(10, 5);

    // First underground belt at (1, 2) facing E
    const ub1 = addBuilding(world, "underground_belt", 1, 2, "E");
    ub1.outputBuffer = { iron_plate: 5 };

    // Connect through belts
    addBuilding(world, "belt", 2, 2, "E");
    addBuilding(world, "belt", 3, 2, "E");

    // Second underground belt at (4, 2) facing E (3 tiles away, within range of 4)
    const ub2 = addBuilding(world, "underground_belt", 4, 2, "E");

    processUndergroundBelts(world);

    // Items should be transferred to ub2's input buffer
    expect(ub2.inputBuffer.iron_plate).toBeDefined();
    expect(ub2.inputBuffer.iron_plate!).toBeGreaterThan(0);
  });

  it("stops at max range of 4 tiles", () => {
    const world = createTestWorld(10, 5);

    const ub1 = addBuilding(world, "underground_belt", 1, 2, "E");
    ub1.outputBuffer = { iron_plate: 3 };

    // Fill with belts up to range limit
    for (let x = 2; x <= 5; x++) {
      addBuilding(world, "belt", x, 2, "E");
    }

    // Underground belt beyond range (should not connect)
    const ub2 = addBuilding(world, "underground_belt", 6, 2, "E");

    processUndergroundBelts(world);

    // ub2 should not receive items (beyond range)
    expect(ub2.inputBuffer.iron_plate).toBeUndefined();
  });
});

// ============================================================================
// Recycler Tests
// ============================================================================

describe("processRecyclers", () => {
  it("converts slag to silica_sand", () => {
    const world = createTestWorld(5, 5);

    const recycler = addBuilding(world, "recycler", 2, 2, "N");
    recycler.inputBuffer = { slag: 5 };

    processRecyclers(world);

    expect(recycler.outputBuffer.silica_sand).toBe(5);
    expect(recycler.inputBuffer.slag).toBe(0);
  });

  it("handles harmless disposal of non-recyclable items", () => {
    const world = createTestWorld(5, 5);

    const recycler = addBuilding(world, "recycler", 2, 2, "N");
    recycler.inputBuffer = { iron_plate: 3, slag: 2 };

    processRecyclers(world);

    // Slag converted, iron plate disposed
    expect(recycler.outputBuffer.silica_sand).toBe(2);
    expect(recycler.inputBuffer.iron_plate).toBe(0);
  });
});

// ============================================================================
// Sensor Tests
// ============================================================================

describe("processSensors and collectSensorAlerts", () => {
  it("detects jammed buildings", () => {
    const world = createTestWorld(5, 5);

    const sensor = addBuilding(world, "sensor", 2, 2, "N");
    const adjacent = addBuilding(world, "belt", 2, 1, "S");
    adjacent.blockedTicks = 35;

    processSensors(world);
    const alerts = collectSensorAlerts(world);

    const jamAlert = alerts.find((a: { buildingId: string; alertType: string; message: string }) => a.alertType === "jam");
    expect(jamAlert).toBeDefined();
    expect(jamAlert!.buildingId).toBe(adjacent.id);
  });

  it("detects overloaded/faulted buildings", () => {
    const world = createTestWorld(5, 5);

    addBuilding(world, "sensor", 2, 2, "N");
    const adjacent = addBuilding(world, "belt", 2, 1, "S");
    adjacent.faulted = true;
    adjacent.load = 150;

    const alerts = collectSensorAlerts(world);

    const overloadAlert = alerts.find((a: { buildingId: string; alertType: string; message: string }) => a.alertType === "overload");
    expect(overloadAlert).toBeDefined();
  });

  it("detects depleted ore deposits", () => {
    const world = createTestWorld(5, 5);
    const tile = getTile(world, 2, 1)!;
    tile.deposit = { material: "iron_ore", remaining: 0, initialAmount: 1000 };

    addBuilding(world, "sensor", 2, 2, "N");
    const miner = addBuilding(world, "miner", 2, 1, "N");

    const alerts = collectSensorAlerts(world);

    const depletedAlert = alerts.find((a: { buildingId: string; alertType: string; message: string }) => a.alertType === "depleted");
    expect(depletedAlert).toBeDefined();
    expect(depletedAlert!.buildingId).toBe(miner.id);
  });
});

// ============================================================================
// Reliability and Overload Tests
// ============================================================================

describe("updateReliabilityAndOverload", () => {
  it("increments blockedTicks when output buffer is full", () => {
    const world = createTestWorld(5, 5);
    const building = addBuilding(world, "belt", 2, 2, "N");

    // Fill output buffer to capacity
    building.outputBuffer = { iron_plate: 10 };

    updateReliabilityAndOverload(world);

    expect(building.blockedTicks).toBe(1);
  });

  it("increments load when processing items", () => {
    const world = createTestWorld(5, 5);
    const building = addBuilding(world, "belt", 2, 2, "N");
    building.inputBuffer = { iron_plate: 5 };

    updateReliabilityAndOverload(world);

    expect(building.load).toBe(1);
  });

  it("sets faulted when load exceeds threshold", () => {
    const world = createTestWorld(5, 5);
    const building = addBuilding(world, "belt", 2, 2, "N");
    building.load = 100; // At threshold

    updateReliabilityAndOverload(world);

    expect(building.faulted).toBe(true);
  });

  it("recovers from fault when load drops", () => {
    const world = createTestWorld(5, 5);
    const building = addBuilding(world, "belt", 2, 2, "N");
    building.faulted = true;
    building.load = 30; // Below recovery threshold (50)

    updateReliabilityAndOverload(world);

    expect(building.faulted).toBe(false);
    expect(building.load).toBe(0);
  });

  it("decrements blockedTicks when output has space", () => {
    const world = createTestWorld(5, 5);
    const building = addBuilding(world, "belt", 2, 2, "N");
    building.blockedTicks = 5;
    building.outputBuffer = { iron_plate: 5 }; // Not full

    updateReliabilityAndOverload(world);

    expect(building.blockedTicks).toBeLessThan(5);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Reliability mechanics integration", () => {
  it("processes full simulation tick with all reliability features", () => {
    const world = createTestWorld(8, 8);

    // Set up a small factory with reliability features
    const splitter = addBuilding(world, "filter_splitter", 3, 3, "N");
    splitter.filterMaterial = "iron_plate";
    addBuilding(world, "belt", 3, 2, "S"); // Forward
    addBuilding(world, "belt", 4, 3, "W"); // Side
    addBuilding(world, "belt", 2, 3, "E"); // Side

    const recycler = addBuilding(world, "recycler", 5, 5, "N");
    recycler.inputBuffer = { slag: 3 };

    const sensor = addBuilding(world, "sensor", 1, 1, "S");
    const nearbyBelt = addBuilding(world, "belt", 1, 2, "N");
    nearbyBelt.blockedTicks = 40;

    // Run all reliability processes
    processFilterSplitters(world);
    processRecyclers(world);
    processSensors(world);
    updateReliabilityAndOverload(world);

    // Verify results
    expect(recycler.outputBuffer.silica_sand).toBe(3);
    const alerts = collectSensorAlerts(world);
    expect(alerts.some((a: { buildingId: string; alertType: string; message: string }) => a.alertType === "jam")).toBe(true);
  });
});
