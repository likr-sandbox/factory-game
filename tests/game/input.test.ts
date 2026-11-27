import { describe, it, expect, beforeEach } from "vitest";
import { createWorld } from "../../src/sim/world";
import { isHubTile } from "../../src/sim/world";
import type { WorldState } from "../../src/sim/types";
import {
  createInputState, rotateDirection, rotateBuildingAt, handleTileClick,
  startBeltDrag, endBeltDrag, applyRecipe, repairBuilding,
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
});
