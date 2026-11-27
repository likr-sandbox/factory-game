import { describe, it, expect, beforeEach } from "vitest";
import { createWorld } from "../../src/sim/world";
import { placeBuilding, placeBeltLine, removeArea, setRecipe, batchActions, unlockTechAction } from "../../src/sim/actions";
import { isBuildingUnlocked, isRecipeUnlocked, unlockTech } from "../../src/sim/progression";
import type { WorldState, Direction, BatchActionItem, ActionResult, ActionResultSuccess, ActionResultFailure } from "../../src/sim/types";

interface RemoveAreaChanges { removedCount: number; }
interface BatchFailedDetails { failedIndex: number; cause: unknown; }

function getSuccessResult(result: ActionResult): ActionResultSuccess {
  if (result.success) return result;
  throw new Error("Expected success");
}

function getFailureResult(result: ActionResult): ActionResultFailure {
  if (!result.success) return result;
  throw new Error("Expected failure");
}

describe("placeBuilding", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  it("should successfully place a miner on a deposit", () => {
    let depositX = 0, depositY = 0;
    for (let y = 0; y < world.height && !depositY; y++) {
      for (let x = 0; x < world.width && !depositY; x++) {
        if (world.tiles[y]![x]!.deposit && world.tiles[y]![x]!.terrain === "grass") { depositX = x; depositY = y; }
      }
    }
    const result = placeBuilding(world, { x: depositX, y: depositY, type: "miner", direction: "N" });
    expect(result.success).toBe(true);
    expect(getSuccessResult(result).buildingId).toBeDefined();
  });

  it("should fail when placing out of bounds / on water / on rock", () => {
    let r = placeBuilding(world, { x: 100, y: 100, type: "miner", direction: "N" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("OUT_OF_BOUNDS");
    let wx = 0, wy = 0;
    for (let y = 0; y < world.height && !wy; y++) for (let x = 0; x < world.width && !wy; x++)
      if (world.tiles[y]![x]!.terrain === "water") { wx = x; wy = y; }
    r = placeBuilding(world, { x: wx, y: wy, type: "belt", direction: "E" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("INVALID_TERRAIN");
    let rx = 0, ry = 0;
    for (let y = 0; y < world.height && !ry; y++) for (let x = 0; x < world.width && !ry; x++)
      if (world.tiles[y]![x]!.terrain === "rock") { rx = x; ry = y; }
    r = placeBuilding(world, { x: rx, y: ry, type: "belt", direction: "E" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("INVALID_TERRAIN");
  });

  it("should fail when tile is occupied / miner off deposit / smelter no recipe", () => {
    const p1 = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" });
    expect(p1.success).toBe(true);
    const p2 = placeBuilding(world, { x: 10, y: 10, type: "assembler", direction: "N", recipeId: "iron_gear" });
    expect(p2.success).toBe(false); expect(getFailureResult(p2).error.code).toBe("OCCUPIED");
    const p3 = placeBuilding(world, { x: 15, y: 15, type: "smelter", direction: "N" });
    expect(p3.success).toBe(false); expect(getFailureResult(p3).error.code).toBe("MISSING_RECIPE");
  });

  it("should fail when recipe doesn't match building type", () => {
    const r = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_gear" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("INVALID_RECIPE");
  });

  it("should fail when placing locked building type (assembler)", () => {
    // assembler requires electronics tech
    const r = placeBuilding(world, { x: 10, y: 10, type: "assembler", direction: "N", recipeId: "iron_gear" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("TECH_LOCKED");
  });

  it("should succeed when placing locked building after unlocking tech", () => {
    // Unlock electronics tech first
    world.researchPoints = 300;
    const unlockResult = unlockTech(world, "electronics");
    expect(unlockResult).toBe(true);
    
    // Now should be able to place assembler
    const r = placeBuilding(world, { x: 10, y: 10, type: "assembler", direction: "N", recipeId: "iron_gear" });
    expect(r.success).toBe(true);
  });

  it("should fail when placing smelter with locked recipe", () => {
    // steel_plate requires advanced_smelting tech
    let r = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "steel_plate" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("TECH_LOCKED");
  });

  it("should succeed when placing smelter with unlocked recipe after tech unlock", () => {
    // Unlock advanced_smelting tech
    world.researchPoints = 200;
    const unlockResult = unlockTech(world, "advanced_smelting");
    expect(unlockResult).toBe(true);
    
    // Now should be able to place smelter with steel_plate recipe
    const r = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "steel_plate" });
    expect(r.success).toBe(true);
    expect(world.buildings[getSuccessResult(r).buildingId!]!.recipeId).toBe("steel_plate");
  });
});

describe("placeBeltLine", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  it("should create L-shaped path with correct directions", () => {
    const result = placeBeltLine(world, { startX: 10, startY: 10, endX: 15, endY: 12, cornerFirst: "x" });
    expect(result.success).toBe(true);
    const b1 = world.buildings[getSuccessResult(result).buildingId!];
    expect(b1!.direction).toBe("E");
    let lastDir: Direction | undefined;
    for (const [, b] of Object.entries(world.buildings)) if (b.x === 15 && b.y === 12) lastDir = b.direction;
    expect(lastDir).toBe("S");
  });

  it("should rollback on mid-path collision", () => {
    const obs = placeBuilding(world, { x: 12, y: 10, type: "splitter", direction: "N" });
    expect(obs.success).toBe(true);
    const r = placeBeltLine(world, { startX: 10, startY: 10, endX: 15, endY: 12, cornerFirst: "x" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("COLLISION");
    const newBuildings = Object.keys(world.buildings).filter(id => id !== getSuccessResult(obs).buildingId && id !== "hub");
    expect(newBuildings.length).toBe(0);
  });

  it("should fail and rollback on out-of-bounds / water path", () => {
    let r = placeBeltLine(world, { startX: 60, startY: 60, endX: 70, endY: 65 });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("OUT_OF_BOUNDS");
    let wx = 0, wy = 0;
    for (let y = 0; y < world.height && !wy; y++) for (let x = 0; x < world.width && !wy; x++)
      if (world.tiles[y]![x]!.terrain === "water") { wx = x; wy = y; }
    r = placeBeltLine(world, { startX: wx - 2, startY: wy, endX: wx + 2, endY: wy });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("INVALID_TERRAIN");
  });
});

describe("removeArea", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  it("should remove buildings in the specified area", () => {
    placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" });
    placeBuilding(world, { x: 11, y: 10, type: "splitter", direction: "N" });
    placeBuilding(world, { x: 12, y: 10, type: "belt", direction: "E" });
    const r = removeArea(world, { x: 10, y: 10, width: 3, height: 1 });
    expect(r.success).toBe(true);
    expect((getSuccessResult(r).changes as RemoveAreaChanges | undefined)?.removedCount).toBe(3);
    for (let x = 10; x < 13; x++) expect(world.tiles[10]![x]!.buildingId).toBeNull();
  });

  it("should protect hub buildings", () => {
    expect(world.buildings["hub"]).toBeDefined();
    const r = removeArea(world, { x: world.hubOrigin.x - 1, y: world.hubOrigin.y - 1, width: 4, height: 4 });
    expect(r.success).toBe(true); expect(world.buildings["hub"]).toBeDefined();
  });
});

describe("setRecipe", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  it("should update recipe on smelter / filter on filter_splitter", () => {
    const p1 = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" });
    const s1 = getSuccessResult(p1);
    let r = setRecipe(world, { x: 10, y: 10, recipeId: "copper_plate" });
    expect(r.success).toBe(true); expect(world.buildings[s1.buildingId!]!.recipeId).toBe("copper_plate");
    // Unlock filter_splitter tech first
    world.researchPoints = 100;
    unlockTech(world, "filter_splitter");
    const p2 = placeBuilding(world, { x: 20, y: 10, type: "filter_splitter", direction: "N" });
    const s2 = getSuccessResult(p2);
    r = setRecipe(world, { x: 20, y: 10, filterMaterial: "iron_plate" });
    expect(r.success).toBe(true); expect(world.buildings[s2.buildingId!]!.filterMaterial).toBe("iron_plate");
  });

  it("should clear faulted state when repair is true", () => {
    const p = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" });
    const s = getSuccessResult(p);
    world.buildings[s.buildingId!]!.faulted = true;
    const r = setRecipe(world, { x: 10, y: 10, repair: true });
    expect(r.success).toBe(true); expect(world.buildings[s.buildingId!]!.faulted).toBe(false);
  });

  it("should reject recipe on incompatible building / no building", () => {
    const p = placeBuilding(world, { x: 10, y: 10, type: "belt", direction: "E" });
    expect(p.success).toBe(true);
    let r = setRecipe(world, { x: 10, y: 10, recipeId: "iron_plate" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("INCOMPATIBLE_BUILDING");
    r = setRecipe(world, { x: 50, y: 50, recipeId: "iron_plate" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("NO_BUILDING");
  });

  it("should fail when setting locked recipe (steel_plate without advanced_smelting)", () => {
    const p = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" });
    expect(p.success).toBe(true);
    const s = getSuccessResult(p);
    
    // steel_plate requires advanced_smelting tech
    let r = setRecipe(world, { x: 10, y: 10, recipeId: "steel_plate" });
    expect(r.success).toBe(false); expect(getFailureResult(r).error.code).toBe("TECH_LOCKED");
  });

  it("should succeed when setting unlocked recipe after tech unlock", () => {
    // Unlock advanced_smelting first
    world.researchPoints = 200;
    const unlockResult = unlockTech(world, "advanced_smelting");
    expect(unlockResult).toBe(true);
    
    const p = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" });
    expect(p.success).toBe(true);
    const s = getSuccessResult(p);
    
    // Now should be able to set steel_plate
    let r = setRecipe(world, { x: 10, y: 10, recipeId: "steel_plate" });
    expect(r.success).toBe(true);
    expect(world.buildings[s.buildingId!]!.recipeId).toBe("steel_plate");
  });
});

describe("batchActions", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  it("should execute multiple actions sequentially", () => {
    const actions: BatchActionItem[] = [
      { kind: "place_building", input: { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" } },
      { kind: "place_building", input: { x: 11, y: 10, type: "splitter", direction: "N" } },
    ];
    const r = batchActions(world, { actions, atomic: true });
    expect(r.success).toBe(true); expect(Object.keys(world.buildings).length).toBe(3);
  });

  it("should rollback all actions when one fails in atomic mode", () => {
    const initialCount = Object.keys(world.buildings).length;
    const actions: BatchActionItem[] = [
      { kind: "place_building", input: { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" } },
      { kind: "place_building", input: { x: 11, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" } },
      { kind: "place_building", input: { x: 10, y: 10, type: "assembler", direction: "N", recipeId: "iron_gear" } },
    ];
    const r = batchActions(world, { actions, atomic: true });
    expect(r.success).toBe(false);
    const f = getFailureResult(r);
    expect(f.error.code).toBe("BATCH_FAILED");
    expect((f.error.details as BatchFailedDetails | undefined)?.failedIndex).toBe(2);
    expect(Object.keys(world.buildings).length).toBe(initialCount);
  });

  it("should not rollback in non-atomic mode", () => {
    const actions: BatchActionItem[] = [
      { kind: "place_building", input: { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" } },
      { kind: "place_building", input: { x: 10, y: 10, type: "assembler", direction: "N", recipeId: "iron_gear" } },
    ];
    const r = batchActions(world, { actions, atomic: false });
    expect(r.success).toBe(false);
    const nonHub = Object.keys(world.buildings).filter(id => id !== "hub");
    expect(nonHub.length).toBe(1);
  });

  it("should rollback set_recipe mutations when later action fails in atomic mode", () => {
    // Place a smelter first
    const p = placeBuilding(world, { x: 10, y: 10, type: "smelter", direction: "N", recipeId: "iron_plate" });
    expect(p.success).toBe(true);
    const successP = getSuccessResult(p);
    
    // Verify initial recipe
    expect(world.buildings[successP.buildingId!]!.recipeId).toBe("iron_plate");
    
    // Create batch: set recipe to copper_plate, then try to place on same tile (will fail)
    const actions: BatchActionItem[] = [
      { kind: "set_recipe", input: { x: 10, y: 10, recipeId: "copper_plate" } },
      { kind: "place_building", input: { x: 10, y: 10, type: "assembler", direction: "N", recipeId: "iron_gear" } },
    ];
    const r = batchActions(world, { actions, atomic: true });
    
    expect(r.success).toBe(false);
    const failure = getFailureResult(r);
    expect(failure.error.code).toBe("BATCH_FAILED");
    
    // Recipe should be rolled back to iron_plate
    expect(world.buildings[successP.buildingId!]!.recipeId).toBe("iron_plate");
  });
});

describe("unlockTechAction", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  it("should successfully unlock a tech with sufficient points", () => {
    world.researchPoints = 300;
    const result = unlockTechAction(world, "electronics");
    expect(result.success).toBe(true);
    const success = getSuccessResult(result);
    expect(success.changes).toEqual({ unlockedTech: "electronics" });
    expect(world.unlockedTechs).toContain("electronics");
    expect(world.researchPoints).toBe(0); // 300 - 300 cost
  });

  it("should fail with INSUFFICIENT_POINTS when not enough research points", () => {
    world.researchPoints = 100;
    const result = unlockTechAction(world, "electronics"); // costs 300
    expect(result.success).toBe(false);
    expect(getFailureResult(result).error.code).toBe("INSUFFICIENT_POINTS");
  });

  it("should allow placing building after unlocking via unlockTechAction", () => {
    world.researchPoints = 300;
    
    // Unlock electronics via action
    const unlockResult = unlockTechAction(world, "electronics");
    expect(unlockResult.success).toBe(true);
    
    // Now should be able to place assembler
    const placeResult = placeBuilding(world, { x: 10, y: 10, type: "assembler", direction: "N", recipeId: "iron_gear" });
    expect(placeResult.success).toBe(true);
  });

  it("should deduct correct cost for different techs", () => {
    // underground_belt costs 150
    world.researchPoints = 200;
    let result = unlockTechAction(world, "underground_belt");
    expect(result.success).toBe(true);
    expect(world.researchPoints).toBe(50);
    
    // filter_splitter costs 100
    world.researchPoints = 150;
    result = unlockTechAction(world, "filter_splitter");
    expect(result.success).toBe(true);
    expect(world.researchPoints).toBe(50);
  });
});
