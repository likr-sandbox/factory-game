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
