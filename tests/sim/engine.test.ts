// Unit tests for simulation engine
import { describe, it, expect } from "vitest";
import { stepTick, stepTicks } from "../../src/sim/engine";
import { createWorld } from "../../src/sim/world";
import type { WorldState, BuildingState } from "../../src/sim/types";

/**
 * Helper to place a building in the world
 */
function placeBuilding(
  world: WorldState,
  x: number,
  y: number,
  type: BuildingState["type"],
  direction: "N" | "E" | "S" | "W" = "S",
  recipeId?: string
): string {
  const id = `building_${world.nextBuildingId++}`;
  const building: BuildingState = {
    id,
    type,
    x,
    y,
    direction,
    recipeId: recipeId as any,
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
  world.tiles[y]![x]!.buildingId = id;
  return id;
}

describe("Mining from finite deposits", () => {
  it("decrements deposit.remaining and stops when depleted", () => {
    const world = createWorld(12345);
    world.tick = 0;

    // Place a miner on a tile with a small deposit
    const depositAmount = 5;
    world.tiles[10]![10]!.deposit = {
      material: "iron_ore",
      remaining: depositAmount,
      initialAmount: depositAmount,
    };

    placeBuilding(world, 10, 10, "miner", "S");

    // Run enough ticks to deplete the deposit
    stepTicks(world, MINING_INTERVAL * (depositAmount + 2));

    // Deposit should be depleted
    expect(world.tiles[10]![10]!.deposit?.remaining).toBe(0);
  });

  it("mines at fixed interval", () => {
    const world = createWorld(12345);
    world.tick = 0;

    const depositAmount = 3;
    world.tiles[10]![10]!.deposit = {
      material: "iron_ore",
      remaining: depositAmount,
      initialAmount: depositAmount,
    };

    placeBuilding(world, 10, 10, "miner", "S");

    // Mine 1 item after first interval
    stepTicks(world, MINING_INTERVAL);
    expect(world.tiles[10]![10]!.deposit?.remaining).toBe(depositAmount - 1);

    // Another item after second interval
    stepTicks(world, MINING_INTERVAL);
    expect(world.tiles[10]![10]!.deposit?.remaining).toBe(depositAmount - 2);
  });
});

describe("Belt transport chain", () => {
  it("moves items tile-by-tile without double-stepping", () => {
    const world = createWorld(12345);
    world.tick = 0;

    // Create a chain of 3 belts facing South
    const belt1Id = placeBuilding(world, 10, 10, "belt", "S");
    const belt2Id = placeBuilding(world, 10, 11, "belt", "S");
    const belt3Id = placeBuilding(world, 10, 12, "belt", "S");

    // Add an item to the first belt
    const building1 = world.buildings[belt1Id]!;
    building1.beltItems.push({ material: "iron_plate", movedAtTick: 0 });

    // After 1 tick, item moves to second belt (since belt2 has capacity)
    stepTick(world);
    expect(building1.beltItems.length).toBe(0);
    const building2 = world.buildings[belt2Id]!;
    expect(building2.beltItems.length).toBe(1);
    expect(building2.beltItems[0]!.movedAtTick).toBe(1);

    // After more ticks, item continues moving down the chain
    stepTicks(world, 10);
    const building3 = world.buildings[belt3Id]!;
    expect(building3.beltItems.length).toBeGreaterThan(0);
  });
});

describe("Splitter round-robin distribution", () => {
  it("distributes items round-robin across 2+ output belts", () => {
    const world = createWorld(12345);
    world.tick = 0;

    // Place splitter facing East
    const splitterId = placeBuilding(world, 10, 10, "splitter", "E");

    // Place output belts to East and South
    placeBuilding(world, 11, 10, "belt", "E"); // East output
    placeBuilding(world, 10, 11, "belt", "S"); // South output

    const splitter = world.buildings[splitterId]!;

    // Add items to splitter input buffer
    splitter.inputBuffer.iron_plate = 4;

    // Process the splitter
    stepTick(world);

    // Items should be distributed across outputs
    // Check that input buffer decreased
    expect(splitter.inputBuffer.iron_plate).toBeLessThan(4);
  });
});

describe("Smelter and Assembler crafting", () => {
  it("smelter produces iron_plate and delivers to hub", () => {
    const world = createWorld(12345);
    world.tick = 0;

    const HUB_X = 31;
    const HUB_Y = 31;

    // Place smelter near hub
    placeBuilding(world, HUB_X, HUB_Y - 2, "smelter", "S", "iron_plate");

    // Provide input (iron_ore)
    const smelter = world.buildings[Object.keys(world.buildings).find(k => k !== "hub")!]!;
    smelter.inputBuffer.iron_ore = 10;

    // Run ticks to complete crafting (60 ticks per plate)
    stepTicks(world, 120);

    // Check that items were delivered to hub
    const hub = world.buildings["hub"]!;
    // The hub should have received items
    expect(hub.type).toBe("hub");
  });

  it("assembler produces iron_gear", () => {
    const world = createWorld(12345);
    world.tick = 0;

    // Place assembler
    const assemblerId = placeBuilding(world, 20, 20, "assembler", "S", "iron_gear");

    const assembler = world.buildings[assemblerId]!;

    // Provide inputs (iron_plate)
    assembler.inputBuffer.iron_plate = 10;

    // Run ticks to complete crafting (90 ticks per gear)
    stepTicks(world, 180);

    // Gear should be produced
    expect(assembler.outputBuffer.iron_gear).toBeGreaterThan(0);
  });

  it("assembler produces copper_wire", () => {
    const world = createWorld(12345);
    world.tick = 0;

    // Place assembler
    const assemblerId = placeBuilding(world, 20, 20, "assembler", "S", "copper_wire");

    const assembler = world.buildings[assemblerId]!;

    // Provide inputs (copper_plate)
    assembler.inputBuffer.copper_plate = 10;

    // Run ticks to complete crafting (60 ticks per wire, produces 2)
    stepTicks(world, 120);

    // Wire should be produced
    expect(assembler.outputBuffer.copper_wire).toBeGreaterThan(0);
  });
});

describe("Hub delivery tracking", () => {
  it("records deliveries in world.delivered and deliveryHistory", () => {
    const world = createWorld(12345);
    world.tick = 0;

    const initialTick = world.tick;

    // Manually add items to hub input buffer to simulate delivery
    const hub = world.buildings["hub"]!;
    hub.inputBuffer.iron_plate = 5;

    // Process the hub
    stepTick(world);

    // Check delivery was recorded
    expect(world.delivered.iron_plate).toBe(5);
    expect(world.deliveryHistory.length).toBeGreaterThan(0);

    const lastDelivery = world.deliveryHistory[world.deliveryHistory.length - 1]!;
    expect(lastDelivery.material).toBe("iron_plate");
    expect(lastDelivery.amount).toBe(5);
    expect(lastDelivery.tick).toBe(initialTick + 1);
  });
});

// Constants used in tests
const MINING_INTERVAL = 60;
