import { describe, it, expect, beforeEach } from "vitest";
import { createWorld } from "../../src/sim/world";
import { isHubTile } from "../../src/sim/world";
import type { WorldState } from "../../src/sim/types";
import {
  createInputState, rotateDirection, rotateBuildingAt, handleTileClick,
  startBeltDrag, endBeltDrag, applyRecipe, repairBuilding,
  canPlaceBuildingAt, computeBeltPreviewPath,
} from "../../src/game/input";

describe("Input Controller", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  describe("createInputState", () => {
    it("should create default input state", () => {
      const s = createInputState();
      expect(s).toMatchObject({ mode: "place", selectedBuilding: "belt", direction: "E", selectedRecipe: "iron_plate", isDraggingBelt: false });
    });
  });

  describe("rotateDirection", () => {
    it("should rotate N->E->S->W->N", () => {
      expect(rotateDirection("N")).toBe("E");
      expect(rotateDirection("E")).toBe("S");
      expect(rotateDirection("S")).toBe("W");
      expect(rotateDirection("W")).toBe("N");
    });
  });

  describe("handleTileClick - placement", () => {
    it("should place a belt on grass tile", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt"; s.direction = "E";
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      expect(t.buildingId).toBeDefined();
      expect(world.buildings[t.buildingId!]!.type).toBe("belt");
    });

    it("should place a miner on deposit tile", () => {
      let dx = -1, dy = -1;
      for (let y = 0; y < world.height && dx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.deposit?.material === "iron_ore" && !isHubTile(world, x, y)) { dx = x; dy = y; break; }
        }
      }
      if (dx >= 0) {
        const s = createInputState(); s.mode = "place"; s.selectedBuilding = "miner";
        const r = handleTileClick(world, s, dx, dy);
        expect(r.success).toBe(true);
        expect(world.buildings[world.tiles[dy]![dx]!.buildingId!]!.type).toBe("miner");
      }
    });

    it("should fail to place on hub tile", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
      const r = handleTileClick(world, s, world.hubOrigin.x, world.hubOrigin.y);
      expect(r.success).toBe(false);
    });

    it("should place a filter_splitter with filterMaterial when selectedFilter is set", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "filter_splitter"; s.direction = "E";
      s.selectedFilter = "iron_plate";
      world.unlockedTechs.push("filter_splitter");
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      expect(t.buildingId).toBeDefined();
      const building = world.buildings[t.buildingId!]!;
      expect(building.type).toBe("filter_splitter");
      expect(building.filterMaterial).toBe("iron_plate");
    });

    it("should place a filter_splitter without filterMaterial when selectedFilter is null", () => {
      const freshWorld = createWorld(123);
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "filter_splitter"; s.direction = "E";
      s.selectedFilter = null;
      freshWorld.unlockedTechs.push("filter_splitter");
      const r = handleTileClick(freshWorld, s, 10, 10);
      expect(r.success).toBe(true);
      const t = freshWorld.tiles[10]![10]!;
      expect(t.buildingId).toBeDefined();
      const building = freshWorld.buildings[t.buildingId!]!;
      expect(building.type).toBe("filter_splitter");
      expect(building.filterMaterial).toBeUndefined();
    });

    it("should place underground_belt, recycler, and sensor buildings", () => {
      world.unlockedTechs.push("underground_belt", "recycler", "sensor");
      const s1 = createInputState(); s1.mode = "place"; s1.selectedBuilding = "underground_belt";
      const r1 = handleTileClick(world, s1, 12, 12);
      expect(r1.success).toBe(true);
      expect(world.buildings[world.tiles[12]![12]!.buildingId!]!.type).toBe("underground_belt");

      const s2 = createInputState(); s2.mode = "place"; s2.selectedBuilding = "recycler";
      const r2 = handleTileClick(world, s2, 13, 13);
      expect(r2.success).toBe(true);
      expect(world.buildings[world.tiles[13]![13]!.buildingId!]!.type).toBe("recycler");

      const s3 = createInputState(); s3.mode = "place"; s3.selectedBuilding = "sensor";
      const r3 = handleTileClick(world, s3, 14, 14);
      expect(r3.success).toBe(true);
      expect(world.buildings[world.tiles[14]![14]!.buildingId!]!.type).toBe("sensor");
    });

    it("should return TECH_LOCKED error when placing filter_splitter without unlocked tech", () => {
      const freshWorld = createWorld(456);
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "filter_splitter"; s.direction = "E";
      const r = handleTileClick(freshWorld, s, 10, 10);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.code).toBe("TECH_LOCKED");
      }
    });
  });

  describe("handleTileClick - demolition", () => {
    it("should remove building in demolish mode", () => {
      world = createWorld(42);
      const ps = createInputState(); ps.mode = "place"; ps.selectedBuilding = "belt";
      handleTileClick(world, ps, 5, 5);
      expect(world.tiles[5]![5]!.buildingId).toBeDefined();
      const ds = createInputState(); ds.mode = "demolish";
      const r = handleTileClick(world, ds, 5, 5);
      expect(r.success).toBe(true);
      expect(world.tiles[5]![5]!.buildingId).toBeNull();
    });
  });

  describe("handleTileClick - inspection", () => {
    it("should set inspected coordinate in inspect mode", () => {
      const s = createInputState(); s.mode = "inspect";
      handleTileClick(world, s, 15, 20);
      expect(s.inspectedCoord).toEqual({ x: 15, y: 20 });
    });
  });

  describe("Belt drag (L-shaped line)", () => {
    it("should place L-shaped belt line from drag", () => {
      world = createWorld(42);
      const s = createInputState();
      startBeltDrag(s, 10, 10);
      const r = endBeltDrag(world, s, 10, 15);
      expect(r.success).toBe(true);
      for (let y = 10; y <= 15; y++) {
        const t = world.tiles[y]![10]!;
        expect(t.buildingId).toBeDefined();
        expect(world.buildings[t.buildingId!]!.type).toBe("belt");
      }
    });

    it("should place horizontal then vertical L-shape", () => {
      world = createWorld(42);
      const s = createInputState();
      startBeltDrag(s, 5, 5);
      const r = endBeltDrag(world, s, 10, 5);
      expect(r.success).toBe(true);
      for (let x = 5; x <= 10; x++) {
        const t = world.tiles[5]![x]!;
        expect(t.buildingId).toBeDefined();
        expect(world.buildings[t.buildingId!]!.type).toBe("belt");
      }
    });
  });

  describe("rotateBuildingAt - hub guard", () => {
    it("should not rotate building on hub tile", () => {
      const r = rotateBuildingAt(world, world.hubOrigin.x, world.hubOrigin.y);
      expect(r.success).toBe(false);
    });

    it("should rotate a placed building", () => {
      world = createWorld(42);
      const ps = createInputState(); ps.mode = "place"; ps.selectedBuilding = "belt"; ps.direction = "N";
      handleTileClick(world, ps, 8, 8);
      const b = world.buildings[world.tiles[8]![8]!.buildingId!]!;
      const initialDir = b.direction;
      const r = rotateBuildingAt(world, 8, 8);
      expect(r.success).toBe(true);
      expect(b.direction).toBe(rotateDirection(initialDir));
    });

    it("should not rotate hub building", () => {
      const r = rotateBuildingAt(world, world.hubOrigin.x, world.hubOrigin.y);
      expect(r.success).toBe(false);
    });
  });

  describe("applyRecipe", () => {
    it("should set recipe on smelter", () => {
      world = createWorld(42);
      const ps = createInputState(); ps.mode = "place"; ps.selectedBuilding = "smelter"; ps.selectedRecipe = "iron_plate";
      handleTileClick(world, ps, 12, 12);
      const b = world.buildings[world.tiles[12]![12]!.buildingId!]!;
      expect(b.recipeId).toBe("iron_plate");
      const r = applyRecipe(world, 12, 12, "copper_plate");
      expect(r.success).toBe(true);
      expect(b.recipeId).toBe("copper_plate");
    });
  });

  describe("repairBuilding", () => {
    it("should repair a faulted building", () => {
      world = createWorld(42);
      const ps = createInputState(); ps.mode = "place"; ps.selectedBuilding = "smelter"; ps.selectedRecipe = "iron_plate";
      handleTileClick(world, ps, 14, 14);
      const b = world.buildings[world.tiles[14]![14]!.buildingId!]!;
      b.faulted = true;
      const r = repairBuilding(world, 14, 14);
      expect(r.success).toBe(true);
      expect(b.faulted).toBe(false);
    });
  });

  describe("handleTileClick - auto recipe application", () => {
    it("should auto-apply iron_plate default recipe when placing smelter with null selectedRecipe", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "smelter"; s.selectedRecipe = null;
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      const building = world.buildings[t.buildingId!]!;
      expect(building.type).toBe("smelter");
      expect(building.recipeId).toBe("iron_plate");
    });

    it("should auto-apply iron_gear default recipe when placing assembler with null selectedRecipe", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "assembler"; s.selectedRecipe = null;
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      const building = world.buildings[t.buildingId!]!;
      expect(building.type).toBe("assembler");
      expect(building.recipeId).toBe("iron_gear");
    });

    it("should auto-apply iron_plate when placing smelter with mismatched assembler recipe selected", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "smelter"; s.selectedRecipe = "iron_gear";
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      const building = world.buildings[t.buildingId!]!;
      expect(building.type).toBe("smelter");
      expect(building.recipeId).toBe("iron_plate"); // Auto-corrected to smelter default
    });

    it("should auto-apply iron_gear when placing assembler with mismatched smelter recipe selected", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "assembler"; s.selectedRecipe = "iron_plate";
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      const building = world.buildings[t.buildingId!]!;
      expect(building.type).toBe("assembler");
      expect(building.recipeId).toBe("iron_gear"); // Auto-corrected to assembler default
    });

    it("should use matching unlocked recipe when selectedRecipe matches building type", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "smelter"; s.selectedRecipe = "copper_plate";
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      const building = world.buildings[t.buildingId!]!;
      expect(building.type).toBe("smelter");
      expect(building.recipeId).toBe("copper_plate"); // Used selected recipe since it matches
    });

    it("should auto-apply default when selectedRecipe is for wrong building type even if unlocked", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "assembler"; s.selectedRecipe = "copper_plate";
      const r = handleTileClick(world, s, 10, 10);
      expect(r.success).toBe(true);
      const t = world.tiles[10]![10]!;
      const building = world.buildings[t.buildingId!]!;
      expect(building.type).toBe("assembler");
      expect(building.recipeId).toBe("iron_gear"); // Auto-corrected since copper_plate is for smelter
    });
  });
});

describe("canPlaceBuildingAt", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  describe("bounds validation", () => {
    it("should reject placement out of bounds", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
      const r = canPlaceBuildingAt(world, s, -1, 10);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe("OUT_OF_BOUNDS");
    });

    it("should accept valid in-bounds coordinates", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
      const r = canPlaceBuildingAt(world, s, 10, 10);
      expect(r.success).toBe(true);
    });
  });

  describe("terrain validation", () => {
    it("should reject placement on water", () => {
      // Find a water tile
      let wx = -1, wy = -1;
      for (let y = 0; y < world.height && wx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.terrain === "water" && !isHubTile(world, x, y)) { wx = x; wy = y; break; }
        }
      }
      if (wx >= 0) {
        const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
        const r = canPlaceBuildingAt(world, s, wx, wy);
        expect(r.success).toBe(false);
        if (!r.success) expect(r.error.code).toBe("INVALID_TERRAIN");
      }
    });

    it("should reject placement on rock", () => {
      // Find a rock tile
      let rx = -1, ry = -1;
      for (let y = 0; y < world.height && rx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.terrain === "rock" && !isHubTile(world, x, y)) { rx = x; ry = y; break; }
        }
      }
      if (rx >= 0) {
        const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
        const r = canPlaceBuildingAt(world, s, rx, ry);
        expect(r.success).toBe(false);
        if (!r.success) expect(r.error.code).toBe("INVALID_TERRAIN");
      }
    });

    it("should accept placement on grass", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
      const r = canPlaceBuildingAt(world, s, 10, 10);
      expect(r.success).toBe(true);
    });
  });

  describe("occupied tile validation", () => {
    it("should reject placement on tile with existing building", () => {
      world = createWorld(42);
      const ps = createInputState(); ps.mode = "place"; ps.selectedBuilding = "belt";
      handleTileClick(world, ps, 10, 10);
      
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "smelter";
      const r = canPlaceBuildingAt(world, s, 10, 10);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe("OCCUPIED");
    });

    it("should accept placement on empty tile", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
      const r = canPlaceBuildingAt(world, s, 10, 10);
      expect(r.success).toBe(true);
    });
  });

  describe("hub protection", () => {
    it("should reject placement on hub tile", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "belt";
      const r = canPlaceBuildingAt(world, s, world.hubOrigin.x, world.hubOrigin.y);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe("HUB_PROTECTED");
    });
  });

  describe("tech unlock validation", () => {
    it("should reject placement when building type is not unlocked", () => {
      const freshWorld = createWorld(42);
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "filter_splitter";
      const r = canPlaceBuildingAt(freshWorld, s, 10, 10);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe("TECH_LOCKED");
    });

    it("should accept placement when building type is unlocked", () => {
      const freshWorld = createWorld(42);
      freshWorld.unlockedTechs.push("filter_splitter");
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "filter_splitter";
      const r = canPlaceBuildingAt(freshWorld, s, 10, 10);
      expect(r.success).toBe(true);
    });
  });

  describe("miner deposit validation", () => {
    it("should reject miner placement on non-deposit tile", () => {
      // Find a grass tile without deposit
      let nx = -1, ny = -1;
      for (let y = 0; y < world.height && nx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.terrain === "grass" && !row[x]!.deposit && !isHubTile(world, x, y)) { nx = x; ny = y; break; }
        }
      }
      if (nx >= 0) {
        const s = createInputState(); s.mode = "place"; s.selectedBuilding = "miner";
        const r = canPlaceBuildingAt(world, s, nx, ny);
        expect(r.success).toBe(false);
        if (!r.success) expect(r.error.code).toBe("NO_DEPOSIT");
      }
    });

    it("should accept miner placement on deposit tile", () => {
      // Find a deposit tile
      let dx = -1, dy = -1;
      for (let y = 0; y < world.height && dx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.deposit && !isHubTile(world, x, y)) { dx = x; dy = y; break; }
        }
      }
      if (dx >= 0) {
        const s = createInputState(); s.mode = "place"; s.selectedBuilding = "miner";
        const r = canPlaceBuildingAt(world, s, dx, dy);
        expect(r.success).toBe(true);
      }
    });

    it("should reject miner placement when deposit remaining is 0", () => {
      // Find a deposit tile and exhaust it
      let dx = -1, dy = -1;
      for (let y = 0; y < world.height && dx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.deposit && !isHubTile(world, x, y)) { dx = x; dy = y; break; }
        }
      }
      if (dx >= 0) {
        world.tiles[dy]![dx]!.deposit!.remaining = 0;
        const s = createInputState(); s.mode = "place"; s.selectedBuilding = "miner";
        const r = canPlaceBuildingAt(world, s, dx, dy);
        expect(r.success).toBe(false);
        if (!r.success) expect(r.error.code).toBe("NO_DEPOSIT");
      }
    });
  });

  describe("smelter/assembler recipe validation", () => {
    it("should accept smelter placement with default recipe", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "smelter"; s.selectedRecipe = null;
      const r = canPlaceBuildingAt(world, s, 10, 10);
      expect(r.success).toBe(true);
    });

    it("should accept assembler placement with default recipe", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "assembler"; s.selectedRecipe = null;
      const r = canPlaceBuildingAt(world, s, 10, 10);
      expect(r.success).toBe(true);
    });

    it("should accept smelter placement with matching unlocked recipe", () => {
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "smelter"; s.selectedRecipe = "copper_plate";
      const r = canPlaceBuildingAt(world, s, 10, 10);
      expect(r.success).toBe(true);
    });

    it("should accept smelter/assembler placement with locked recipe (auto-corrects to default)", () => {
      const freshWorld = createWorld(42);
      // circuit_board is locked but assembler is unlocked by default
      // The function should auto-correct to default recipe iron_gear
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "assembler"; s.selectedRecipe = "circuit_board";
      const r = canPlaceBuildingAt(freshWorld, s, 10, 10);
      expect(r.success).toBe(true);
    });

    it("should reject assembler placement when building type itself is locked", () => {
      // This tests a scenario where even the default recipe's building is locked
      // In current catalog, assembler is unlocked by default, so this is hard to test
      // Instead, test filter_splitter which requires tech unlock
      const freshWorld = createWorld(42);
      const s = createInputState(); s.mode = "place"; s.selectedBuilding = "filter_splitter";
      const r = canPlaceBuildingAt(freshWorld, s, 10, 10);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe("TECH_LOCKED");
    });
  });
});

describe("computeBeltPreviewPath", () => {
  let world: WorldState;
  beforeEach(() => { world = createWorld(42); });

  describe("L-shape path computation", () => {
    it("should compute vertical L-shape path (same X)", () => {
      const result = computeBeltPreviewPath(world, 10, 10, 10, 15);
      expect(result.valid).toBe(true);
      expect(result.path.length).toBe(6); // 10,10 to 10,15 inclusive
      expect(result.path[0]!.x).toBe(10); expect(result.path[0]!.y).toBe(10);
      expect(result.path[5]!.x).toBe(10); expect(result.path[5]!.y).toBe(15);
      result.path.forEach(tile => {
        expect(tile.valid).toBe(true);
      });
    });

    it("should compute horizontal L-shape path (same Y)", () => {
      const result = computeBeltPreviewPath(world, 5, 5, 10, 5);
      expect(result.valid).toBe(true);
      expect(result.path.length).toBe(6); // 5,5 to 10,5 inclusive
      expect(result.path[0]!.x).toBe(5); expect(result.path[0]!.y).toBe(5);
      expect(result.path[5]!.x).toBe(10); expect(result.path[5]!.y).toBe(5);
      result.path.forEach(tile => {
        expect(tile.valid).toBe(true);
      });
    });

    it("should compute diagonal L-shape path going right and down", () => {
      const result = computeBeltPreviewPath(world, 5, 5, 10, 10, "x");
      expect(result.valid).toBe(true);
      // Path: (5,5),(6,5),(7,5),(8,5),(9,5),(10,5),(10,6),(10,7),(10,8),(10,9),(10,10)
      expect(result.path.length).toBe(11);
      expect(result.path[0]!.x).toBe(5); expect(result.path[0]!.y).toBe(5);
      expect(result.path[5]!.x).toBe(10); expect(result.path[5]!.y).toBe(5);
      expect(result.path[10]!.x).toBe(10); expect(result.path[10]!.y).toBe(10);
    });

    it("should compute diagonal L-shape path going down then right with cornerFirst=y", () => {
      const result = computeBeltPreviewPath(world, 5, 5, 10, 10, "y");
      expect(result.valid).toBe(true);
      // Path: (5,5),(5,6),(5,7),(5,8),(5,9),(5,10),(6,10),(7,10),(8,10),(9,10),(10,10)
      expect(result.path.length).toBe(11);
      expect(result.path[0]!.x).toBe(5); expect(result.path[0]!.y).toBe(5);
      expect(result.path[5]!.x).toBe(5); expect(result.path[5]!.y).toBe(10);
      expect(result.path[10]!.x).toBe(10); expect(result.path[10]!.y).toBe(10);
    });

    it("should handle negative direction (left and up)", () => {
      const result = computeBeltPreviewPath(world, 15, 15, 10, 10);
      expect(result.valid).toBe(true);
      expect(result.path[0]!.x).toBe(15); expect(result.path[0]!.y).toBe(15);
      expect(result.path[result.path.length - 1]!.x).toBe(10); expect(result.path[result.path.length - 1]!.y).toBe(10);
      result.path.forEach(tile => {
        expect(tile.valid).toBe(true);
      });
    });
  });

  describe("bounds validation", () => {
    it("should mark tiles out of bounds as invalid", () => {
      const result = computeBeltPreviewPath(world, -1, 10, 5, 10);
      expect(result.valid).toBe(false);
      const invalidTiles = result.path.filter(t => !t.valid);
      expect(invalidTiles.length).toBeGreaterThan(0);
      expect(invalidTiles[0]!.error?.code).toBe("OUT_OF_BOUNDS");
    });

    it("should reject path that goes out of bounds", () => {
      const result = computeBeltPreviewPath(world, 60, 60, 65, 65);
      expect(result.valid).toBe(false);
    });
  });

  describe("terrain validation", () => {
    it("should mark water tiles as invalid", () => {
      // Find a water tile
      let wx = -1, wy = -1;
      for (let y = 0; y < world.height && wx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.terrain === "water" && !isHubTile(world, x, y)) { wx = x; wy = y; break; }
        }
      }
      if (wx >= 0) {
        const result = computeBeltPreviewPath(world, wx, wy, wx + 3, wy);
        expect(result.valid).toBe(false);
        const waterTile = result.path.find(t => t.x === wx && t.y === wy);
        expect(waterTile?.valid).toBe(false);
        expect(waterTile?.error?.code).toBe("INVALID_TERRAIN");
      }
    });

    it("should mark rock tiles as invalid", () => {
      // Find a rock tile
      let rx = -1, ry = -1;
      for (let y = 0; y < world.height && rx < 0; y++) {
        const row = world.tiles[y]!;
        for (let x = 0; x < world.width; x++) {
          if (row[x]!.terrain === "rock" && !isHubTile(world, x, y)) { rx = x; ry = y; break; }
        }
      }
      if (rx >= 0) {
        const result = computeBeltPreviewPath(world, rx, ry, rx + 3, ry);
        expect(result.valid).toBe(false);
        const rockTile = result.path.find(t => t.x === rx && t.y === ry);
        expect(rockTile?.valid).toBe(false);
        expect(rockTile?.error?.code).toBe("INVALID_TERRAIN");
      }
    });
  });

  describe("occupied tile validation", () => {
    it("should mark tiles with buildings as invalid", () => {
      world = createWorld(42);
      const ps = createInputState(); ps.mode = "place"; ps.selectedBuilding = "belt";
      handleTileClick(world, ps, 10, 10);
      
      const result = computeBeltPreviewPath(world, 8, 10, 12, 10);
      expect(result.valid).toBe(false);
      const occupiedTile = result.path.find(t => t.x === 10 && t.y === 10);
      expect(occupiedTile?.valid).toBe(false);
      expect(occupiedTile?.error?.code).toBe("OCCUPIED");
    });
  });

  describe("hub protection", () => {
    it("should mark hub tiles as invalid", () => {
      // Path crosses through hub area at y=31 (hubOrigin.y = 31)
      const result = computeBeltPreviewPath(world, 25, 31, 40, 31);
      expect(result.valid).toBe(false);
      const hubTiles = result.path.filter(t => isHubTile(world, t.x, t.y));
      expect(hubTiles.length).toBeGreaterThan(0);
      hubTiles.forEach(tile => {
        expect(tile.valid).toBe(false);
        expect(tile.error?.code).toBe("HUB_PROTECTED");
      });
    });
  });

  describe("integer validation", () => {
    it("should return empty path for non-integer coordinates", () => {
      const result = computeBeltPreviewPath(world, 10.5, 10, 15, 10);
      expect(result.path.length).toBe(0);
      expect(result.valid).toBe(false);
    });
  });
});
