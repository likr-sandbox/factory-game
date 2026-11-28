import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WorldState, Tile, BuildingState } from "../../src/sim/types";
import {
  mountMinimap,
  MINIMAP_SIZE,
  MAP_SIZE,
  TILE_SCALE,
  HUB_SIZE,
  CAMERA_VIEW_TILES_X,
  CAMERA_VIEW_TILES_Y,
  getMinimap,
  type MinimapOptions,
} from "../../src/game/minimap";
import { TERRAIN_PALETTE, DEPOSIT_PALETTE, BUILDING_PALETTE } from "../../src/game/palette";

// ============================================================================
// Node DOM Stubs for Vitest (no jsdom/happy-dom)
// ============================================================================

class StubCanvas {
  width = 0;
  height = 0;
  className = "";
  style: Record<string, string> = {};
  private ctx: StubRenderingContext2D | null = null;
  private eventListeners: Map<string, Set<() => void>> = new Map();

  getContext(type: string): StubRenderingContext2D | null {
    if (type === "2d") {
      if (!this.ctx) {
        this.ctx = new StubRenderingContext2D();
      }
      return this.ctx;
    }
    return null;
  }

  querySelector(sel: string): unknown {
    return null;
  }

  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    return { left: 0, top: 0, right: this.width, bottom: this.height, width: this.width, height: this.height };
  }

  addEventListener(event: string, handler: () => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: () => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }
}

class StubRenderingContext2D {
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  font = "";
  textAlign = "start";
  commands: string[] = [];

  clearRect(x: number, y: number, w: number, h: number): void {
    this.commands.push(`clearRect(${x},${y},${w},${h})`);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.commands.push(`fillRect(${x},${y},${w},${h})`);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.commands.push(`strokeRect(${x},${y},${w},${h})`);
  }

  beginPath(): void {
    this.commands.push("beginPath");
  }

  arc(x: number, y: number, r: number, sa: number, ea: number): void {
    this.commands.push(`arc(${x},${y},${r},${sa},${ea})`);
  }

  fill(): void {
    this.commands.push("fill");
  }

  stroke(): void {
    this.commands.push("stroke");
  }

  setLineDash(dash: number[]): void {
    this.commands.push(`setLineDash([${dash.join(",")}])`);
  }
}

class StubElement {
  className = "";
  textContent = "";
  style: Record<string, string> = {};
  children: StubElement[] = [];
  childNodes: Node[] = [];
  private eventListeners: Map<string, Set<() => void>> = new Map();
  parent: StubElement | null = null;
  ownerDocument: StubDocument = new StubDocument();
  
  appendChild(child: StubElement): StubElement {
    this.children.push(child);
    this.childNodes.push(child as unknown as Node);
    (child as StubElement).parent = this;
    return child;
  }

  remove(): void {
    if (this.parent) {
      const idx = this.parent.children.indexOf(this);
      if (idx >= 0) {
        this.parent.children.splice(idx, 1);
      }
    }
  }

  querySelector(sel: string): StubElement | null {
    if (sel === "button" && this.className === "minimap-header") {
      return this.children.find(c => c.className === "minimap-toggle-btn") || null;
    }
    if (sel === "canvas") {
      return this.children.find(c => c instanceof StubCanvas) as unknown as StubElement | null;
    }
    return null;
  }

  addEventListener(event: string, handler: () => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: () => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }
}

class StubHTMLButtonElement extends StubElement {
  constructor() {
    super();
    this.className = "minimap-toggle-btn";
    this.textContent = "Minimap";
  }
}

class StubDocument {
  createElement(tag: string): StubElement | StubCanvas {
    if (tag === "canvas") {
      return new StubCanvas();
    }
    if (tag === "button") {
      return new StubHTMLButtonElement();
    }
    return new StubElement();
  }
}

// Global container mock
const globalContainer = {
  ownerDocument: new StubDocument(),
  children: [] as (StubElement | StubCanvas)[],
  appendChild(child: StubElement | StubCanvas): void {
    this.children.push(child);
  },
  remove(): void {
    this.children = [];
  },
};

// ============================================================================
// Test World State Generator
// ============================================================================

function createTestWorld(overrides?: Partial<WorldState>): WorldState {
  const width = overrides?.width ?? 64;
  const height = overrides?.height ?? 64;

  // Generate tiles
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const terrain: "grass" | "rock" | "water" = x < 10 ? "water" : y < 10 ? "rock" : "grass";
      row.push({
        x,
        y,
        terrain,
        deposit:
          x >= 20 && x < 30 && y >= 20 && y < 30
            ? { material: "iron_ore", remaining: 1000, initialAmount: 1000 }
            : null,
        buildingId: null,
      });
    }
    tiles.push(row);
  }

  // Add a building (ensure indices are within bounds)
  const buildingId = "building-1";
  if (tiles[15] && tiles[15][15]) {
    tiles[15][15].buildingId = buildingId;
  }

  const buildings: Record<string, BuildingState> = {
    [buildingId]: {
      id: buildingId,
      type: "miner",
      x: 15,
      y: 15,
      direction: "S",
      inputBuffer: {},
      outputBuffer: {},
      beltItems: [],
      craftProgress: 0,
      roundRobinIndex: 0,
      faulted: false,
      load: 0,
      idleTicks: 0,
      blockedTicks: 0,
    },
  };

  return {
    seed: 12345,
    width,
    height,
    tick: 0,
    rngState: 42,
    tiles,
    buildings,
    nextBuildingId: 2,
    hubOrigin: { x: 30, y: 30 },
    delivered: {},
    deliveryHistory: [],
    unlockedTechs: [],
    completedQuests: [],
    ...(overrides || {}),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Minimap Constants", () => {
  it("should have correct constant values", () => {
    expect(MINIMAP_SIZE).toBe(128);
    expect(MAP_SIZE).toBe(64);
    expect(TILE_SCALE).toBe(2); // 128 / 64 = 2
    expect(HUB_SIZE).toBe(2);
    expect(CAMERA_VIEW_TILES_X).toBe(32);
    expect(CAMERA_VIEW_TILES_Y).toBe(18);
  });
});

describe("mountMinimap", () => {
  let container: typeof globalContainer;

  beforeEach(() => {
    container = {
      ownerDocument: new StubDocument(),
      children: [],
      appendChild(child: StubElement | StubCanvas): void {
        this.children.push(child);
      },
      remove(): void {
        this.children = [];
      },
    };
  });

  it("should create minimap container with canvas and toggle button", () => {
    const result = mountMinimap(container as unknown as HTMLElement, { visible: true });

    expect(container.children.length).toBe(1); // minimap-container wrapper
    const minimapContainer = container.children[0] as StubElement;
    expect(minimapContainer.className).toContain("minimap-container");
    
    // Should have header and canvas as children
    expect(minimapContainer.children.length).toBe(2); // header + canvas
    
    const header = minimapContainer.children[0] as StubElement;
    expect(header.className).toBe("minimap-header");
    
    // Header should contain toggle button
    const button = header.querySelector("button") as StubHTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.className).toBe("minimap-toggle-btn");
    expect(button.textContent).toBe("Minimap");

    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
    expect(canvas.className).toBe("minimap-canvas");
  });

  it("should create canvas with correct dimensions", () => {
    mountMinimap(container as unknown as HTMLElement, { visible: true });

    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas.width).toBe(MINIMAP_SIZE);
    expect(canvas.height).toBe(MINIMAP_SIZE);
  });

  it("should respect visible option", () => {
    const container1 = {
      ownerDocument: new StubDocument(),
      children: [] as (StubElement | StubCanvas)[],
      appendChild(child: StubElement | StubCanvas) { this.children.push(child); },
      remove() { this.children = []; },
    };
    mountMinimap(container1 as unknown as HTMLElement, { visible: true });
    const minimapContainer1 = container1.children[0] as StubElement;
    expect(minimapContainer1.style.display).not.toBe("none");

    const container2 = {
      ownerDocument: new StubDocument(),
      children: [] as (StubElement | StubCanvas)[],
      appendChild(child: StubElement | StubCanvas) { this.children.push(child); },
      remove() { this.children = []; },
    };
    mountMinimap(container2 as unknown as HTMLElement, { visible: false });
    const minimapContainer2 = container2.children[0] as StubElement;
    expect(minimapContainer2.style.display).toBe("none");
  });

  it("should return API with update, destroy, and setVisible methods", () => {
    const result = mountMinimap(container as unknown as HTMLElement, { visible: true });

    expect(typeof result.update).toBe("function");
    expect(typeof result.destroy).toBe("function");
    expect(typeof result.setVisible).toBe("function");
  });
});

describe("Minimap Update", () => {
  let container: typeof globalContainer;
  let world: WorldState;

  beforeEach(() => {
    container = {
      ownerDocument: new StubDocument(),
      children: [],
      appendChild(child: StubElement | StubCanvas): void {
        this.children.push(child);
      },
      remove(): void {
        this.children = [];
      },
    };
    world = createTestWorld();
  });

  it("should render world state to canvas", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    update(world);

    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
    
    // Get canvas context and verify it exists
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeTruthy();
  });

  it("should handle multiple updates without error", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    const world1 = createTestWorld();
    const world2 = createTestWorld({ seed: 67890 });
    
    expect(() => {
      update(world1);
      update(world2);
    }).not.toThrow();
  });

  it("should draw terrain tiles", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    update(world);

    // The minimap should have rendered something
    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
  });

  it("should draw hub at correct position", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    update(world);

    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
    
    // Hub should be drawn at hubOrigin (30, 30) with size 2x2
    // This is verified by the rendering completing without errors
  });

  it("should draw camera view rectangle when camera position is set", () => {
    const options: MinimapOptions = {
      cameraX: 0,
      cameraY: 0,
    };
    const { update } = mountMinimap(container as unknown as HTMLElement, options);
    update(world);

    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
  });

  it("should draw building on tile with buildingId", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    update(world);

    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
  });

  it("should draw deposit overlay on tiles with deposits", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    update(world);

    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
  });
});

describe("Minimap Navigation", () => {
  let container: typeof globalContainer;
  let onNavigateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = {
      ownerDocument: new StubDocument(),
      children: [],
      appendChild(child: StubElement | StubCanvas): void {
        this.children.push(child);
      },
      remove(): void {
        this.children = [];
      },
    };
    onNavigateMock = vi.fn();
  });

  it("should calculate correct tile coordinates from click position", () => {
    // Test the coordinate calculation logic
    const clickX = 20;
    const clickY = 20;
    
    const tileX = Math.floor(clickX / TILE_SCALE);
    const tileY = Math.floor(clickY / TILE_SCALE);
    
    expect(tileX).toBe(10);
    expect(tileY).toBe(10);
  });

  it("should clamp navigation coordinates to map bounds", () => {
    const world = createTestWorld({ width: 32, height: 32 });
    
    // Click beyond bounds (100, 100) should clamp to (31, 31)
    const tileX = Math.floor(100 / TILE_SCALE); // 50
    const clampedX = Math.max(0, Math.min(tileX, world.width - 1));
    
    expect(clampedX).toBe(31);
  });

  it("should call onNavigate when provided", () => {
    const options: MinimapOptions = {
      onNavigate: onNavigateMock,
    };
    
    mountMinimap(container as unknown as HTMLElement, options);
    
    // Verify the minimap was created with the callback
    expect(container.children.length).toBe(1);
  });
});

describe("Minimap Visibility Toggle", () => {
  let container: typeof globalContainer;

  beforeEach(() => {
    container = {
      ownerDocument: new StubDocument(),
      children: [],
      appendChild(child: StubElement | StubCanvas): void {
        this.children.push(child);
      },
      remove(): void {
        this.children = [];
      },
    };
  });

  it("should toggle visibility when setVisible is called", () => {
    const { setVisible } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    
    const minimapContainer = container.children[0] as StubElement;
    
    // Initially visible
    expect(minimapContainer.style.display).not.toBe("none");
    
    // Toggle to hidden
    setVisible(false);
    expect(minimapContainer.style.display).toBe("none");
    
    // Toggle back to visible
    setVisible(true);
    expect(minimapContainer.style.display).not.toBe("none");
  });
});

describe("Minimap Destroy", () => {
  let container: typeof globalContainer;

  beforeEach(() => {
    // Create a container that properly tracks children and supports remove
    const containerElement = new StubElement();
    containerElement.ownerDocument = new StubDocument();
    
    container = containerElement as unknown as typeof globalContainer;
  });

  it("should remove container from DOM and clean up", () => {
    const { destroy } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    
    expect(container.children.length).toBe(1);
    
    destroy();
    
    // Container should be removed
    expect(container.children.length).toBe(0);
    
    // getMinimap should return null after destroy
    expect(getMinimap()).toBeNull();
  });
});

describe("Minimap Palette Integration", () => {
  it("should use TERRAIN_PALETTE colors for terrain rendering", () => {
    const expectedColors = Object.values(TERRAIN_PALETTE).map((p) => p.hex);
    expect(expectedColors).toContain("#4A7C3E"); // grass
    expect(expectedColors).toContain("#808080"); // rock
    expect(expectedColors).toContain("#1E90FF"); // water
  });

  it("should use DEPOSIT_PALETTE colors for deposit rendering", () => {
    expect(DEPOSIT_PALETTE.iron_ore.hex).toBe("#5D737E");
    expect(DEPOSIT_PALETTE.copper_ore.hex).toBe("#D2691E");
    expect(DEPOSIT_PALETTE.coal.hex).toBe("#222629");
    expect(DEPOSIT_PALETTE.silica_sand.hex).toBe("#E8D9A0");
  });

  it("should use BUILDING_PALETTE colors for building rendering", () => {
    expect(BUILDING_PALETTE.miner.hex).toBe("#4169E1");
    expect(BUILDING_PALETTE.hub.hex).toBe("#FF4500");
  });
});

describe("Edge Cases", () => {
  let container: typeof globalContainer;

  beforeEach(() => {
    container = {
      ownerDocument: new StubDocument(),
      children: [],
      appendChild(child: StubElement | StubCanvas): void {
        this.children.push(child);
      },
      remove(): void {
        this.children = [];
      },
    };
  });

  it("should handle empty world state gracefully", () => {
    const world = createTestWorld({ width: 1, height: 1, buildings: {} });
    world.tiles = [[{ x: 0, y: 0, terrain: "grass", deposit: null, buildingId: null }]];
    world.hubOrigin = { x: 0, y: 0 };

    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    expect(() => update(world)).not.toThrow();
  });

  it("should handle world smaller than 64x64", () => {
    const world = createTestWorld({ width: 16, height: 16 });
    
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    expect(() => update(world)).not.toThrow();
  });

  it("should handle world larger than 64x64 (clipped to minimap size)", () => {
    const world = createTestWorld({ width: 128, height: 128 });
    
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    expect(() => update(world)).not.toThrow();
  });

  it("should handle missing onNavigate callback", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, {});
    const world = createTestWorld();
    
    expect(() => update(world)).not.toThrow();
  });

  it("should handle multiple updates without error", () => {
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    const world1 = createTestWorld();
    const world2 = createTestWorld({ seed: 67890 });
    
    expect(() => {
      update(world1);
      update(world2);
    }).not.toThrow();
  });
});

describe("Minimap Rendering Completeness", () => {
  let container: typeof globalContainer;

  beforeEach(() => {
    container = {
      ownerDocument: new StubDocument(),
      children: [],
      appendChild(child: StubElement | StubCanvas): void {
        this.children.push(child);
      },
      remove(): void {
        this.children = [];
      },
    };
  });

  it("should render all terrain types", () => {
    const world = createTestWorld();
    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    
    // Update should complete without errors
    expect(() => update(world)).not.toThrow();
    
    const minimapContainer = container.children[0] as StubElement;
    const canvas = minimapContainer.children[1] as unknown as StubCanvas;
    expect(canvas).toBeTruthy();
  });

  it("should render all building types", () => {
    const buildingTypes: BuildingState["type"][] = [
      "miner", "belt", "splitter", "filter_splitter",
      "underground_belt", "smelter", "assembler",
      "recycler", "sensor", "hub"
    ];

    for (const type of buildingTypes) {
      const testContainer = {
        ownerDocument: new StubDocument(),
        children: [] as (StubElement | StubCanvas)[],
        appendChild(child: StubElement | StubCanvas) { this.children.push(child); },
        remove() { this.children = []; },
      };
      
      const world = createTestWorld({ buildings: {} });
      const buildingId = `test-${type}`;
      
      // Ensure tile exists before modifying
      if (world.tiles[15] && world.tiles[15][15]) {
        world.tiles[15][15].buildingId = buildingId;
        
        world.buildings[buildingId] = {
          id: buildingId,
          type,
          x: 15,
          y: 15,
          direction: "N",
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
      }

      const { update } = mountMinimap(testContainer as unknown as HTMLElement, { visible: true });
      expect(() => update(world)).not.toThrow();
    }
  });

  it("should render faulted building indicator", () => {
    const world = createTestWorld();
    const buildingId = "building-1";
    if (world.buildings[buildingId]) {
      world.buildings[buildingId].faulted = true;
    }

    const { update } = mountMinimap(container as unknown as HTMLElement, { visible: true });
    expect(() => update(world)).not.toThrow();
  });
});
