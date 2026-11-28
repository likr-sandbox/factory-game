// Tests for overlays.ts - PlacementGhost, BeltDragPreview, and ModeOverlay
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Phaser before importing
const mockGraphics = {
  clear: vi.fn(),
  setDepth: vi.fn(),
  lineStyle: vi.fn(),
  strokeRect: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  fillStyle: vi.fn(),
  fillRect: vi.fn(),
  setVisible: vi.fn(),
  destroy: vi.fn(),
  beginPath: vi.fn(),
  strokePath: vi.fn(),
};

const mockSprite = {
  setAlpha: vi.fn(),
  setDepth: vi.fn(),
  setPosition: vi.fn(),
  setVisible: vi.fn(),
  setTexture: vi.fn(),
  destroy: vi.fn(),
};

const mockCamera = {
  scrollX: 0,
  scrollY: 0,
  width: 800,
  height: 600,
};

vi.mock("phaser", () => {
  class MockScene {
    cameras = { main: mockCamera };
    add = {
      sprite: vi.fn(() => mockSprite),
      graphics: vi.fn(() => mockGraphics),
    };
  }
  return {
    Scene: MockScene,
    GameObjects: {
      Sprite: class MockSprite {},
      Graphics: class MockGraphics {},
    },
  };
});

import type { Direction, BuildingType } from "../../src/sim/types";
import { PlacementGhost, BeltDragPreview, ModeOverlay, type BeltPathTile } from "../../src/game/overlays";

// Import the mocked Scene class
import { Scene } from "phaser";

describe("PlacementGhost", () => {
  let scene: any;
  let ghost: PlacementGhost;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    scene = new Scene();
    ghost = new PlacementGhost(scene);
  });

  afterEach(() => {
    ghost.destroy();
  });

  it("should create a placement ghost sprite", () => {
    ghost.show(5, 5, "belt" as BuildingType, "E" as Direction, true);
    
    expect(scene.add.sprite).toHaveBeenCalled();
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it("should show green highlight frame when valid is true", () => {
    ghost.show(5, 5, "belt" as BuildingType, "E" as Direction, true);
    
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(2, 0x00FF00, 0.8);
    expect(mockGraphics.strokeRect).toHaveBeenCalledWith(5 * 32, 5 * 32, 32, 32);
  });

  it("should show red highlight frame when valid is false", () => {
    ghost.show(5, 5, "belt" as BuildingType, "E" as Direction, false);
    
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(2, 0xFF0000, 0.8);
  });

  it("should have default valid=true parameter for backward compatibility", () => {
    // Call without valid parameter to test default
    ghost.show(5, 5, "belt" as BuildingType, "E" as Direction);
    
    // Should use green (valid) by default
    const greenCalls = mockGraphics.lineStyle.mock.calls.filter(
      (c: any[]) => c[1] === 0x00FF00
    );
    expect(greenCalls.length).toBeGreaterThan(0);
  });

  it("should draw direction arrow for each direction", () => {
    const directions: Direction[] = ["N", "E", "S", "W"];
    
    for (const dir of directions) {
      vi.clearAllMocks();
      ghost.show(5, 5, "belt" as BuildingType, dir, true);
      expect(mockGraphics.moveTo).toHaveBeenCalled();
      expect(mockGraphics.lineTo).toHaveBeenCalled();
    }
  });

  it("should hide the ghost sprite and graphics", () => {
    ghost.show(5, 5, "belt" as BuildingType, "E" as Direction, true);
    ghost.hide();
    
    expect(mockGraphics.clear).toHaveBeenCalled();
    expect(mockGraphics.setVisible).toHaveBeenCalledWith(false);
  });

  it("should update ghost position and validity", () => {
    ghost.update(5, 5, "belt" as BuildingType, "E" as Direction, true);
    expect(scene.add.sprite).toHaveBeenCalled();
    
    // Second update should call setTexture (sprite already exists)
    vi.clearAllMocks();
    ghost.update(6, 6, "smelter" as BuildingType, "N" as Direction, false);
    expect(mockSprite.setTexture).toHaveBeenCalled();
    expect(mockSprite.setPosition).toHaveBeenCalled();
  });

  it("should destroy sprite and graphics", () => {
    ghost.show(5, 5, "belt" as BuildingType, "E" as Direction, true);
    ghost.destroy();
    
    expect(mockSprite.destroy).toHaveBeenCalled();
    expect(mockGraphics.destroy).toHaveBeenCalled();
  });
});

describe("BeltDragPreview", () => {
  let scene: any;
  let preview: BeltDragPreview;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new Scene();
    preview = new BeltDragPreview(scene);
  });

  afterEach(() => {
    preview.destroy();
  });

  it("should create belt drag preview graphics", () => {
    const path: BeltPathTile[] = [
      { x: 5, y: 5, valid: true },
      { x: 6, y: 5, valid: true },
      { x: 7, y: 5, valid: false },
    ];
    
    preview.show(5, 5, 7, 5, path);
    
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it("should draw green semi-transparent ghosts for valid tiles", () => {
    const path: BeltPathTile[] = [
      { x: 5, y: 5, valid: true },
    ];
    
    preview.show(5, 5, 5, 5, path);
    
    expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00FF00, 0.2);
    expect(mockGraphics.fillRect).toHaveBeenCalled();
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(2, 0x00FF00, 0.5);
  });

  it("should draw red semi-transparent ghosts for invalid tiles", () => {
    const path: BeltPathTile[] = [
      { x: 5, y: 5, valid: false },
    ];
    
    preview.show(5, 5, 5, 5, path);
    
    expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0xFF0000, 0.2);
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(2, 0xFF0000, 0.5);
  });

  it("should handle L-shaped paths with multiple tiles", () => {
    const path: BeltPathTile[] = [
      { x: 5, y: 5, valid: true },
      { x: 6, y: 5, valid: true },
      { x: 7, y: 5, valid: true },
      { x: 7, y: 6, valid: true },
      { x: 7, y: 7, valid: false },
    ];
    
    preview.show(5, 5, 7, 7, path);
    
    expect(mockGraphics.fillStyle).toHaveBeenCalledTimes(5);
    expect(mockGraphics.strokeRect).toHaveBeenCalledTimes(5);
  });

  it("should hide the preview", () => {
    const path: BeltPathTile[] = [{ x: 5, y: 5, valid: true }];
    preview.show(5, 5, 5, 5, path);
    preview.hide();
    
    expect(mockGraphics.clear).toHaveBeenCalled();
    expect(mockGraphics.setVisible).toHaveBeenCalledWith(false);
  });

  it("should destroy graphics", () => {
    const path: BeltPathTile[] = [{ x: 5, y: 5, valid: true }];
    preview.show(5, 5, 5, 5, path);
    preview.destroy();
    expect(mockGraphics.destroy).toHaveBeenCalled();
  });
});

describe("ModeOverlay", () => {
  let scene: any;
  let overlay: ModeOverlay;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new Scene();
    overlay = new ModeOverlay(scene);
  });

  afterEach(() => {
    overlay.destroy();
  });

  it("should create mode overlay graphics", () => {
    overlay.setMode("place");
    
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it("should draw grid in place mode", () => {
    overlay.setMode("place");
    
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(1, 0xFFFFFF, 0.15);
    expect(mockGraphics.moveTo).toHaveBeenCalled();
    expect(mockGraphics.lineTo).toHaveBeenCalled();
  });

  it("should draw grid in demolish mode", () => {
    overlay.setMode("demolish");
    
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(1, 0xFFFFFF, 0.15);
  });

  it("should not draw grid in inspect mode", () => {
    vi.clearAllMocks();
    overlay.setMode("inspect");
    
    // Grid should not be drawn, only selection frame
    const whiteLineStyleCalls = mockGraphics.lineStyle.mock.calls.filter(
      (c: any[]) => c[1] === 0xFFFFFF
    );
    expect(whiteLineStyleCalls.length).toBe(0);
  });

  it("should draw red dashed frame for demolish hover", () => {
    overlay.setMode("demolish");
    overlay.setHoveredTile(5, 5);
    
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(2, 0xFF0000, 0.8);
    expect(mockGraphics.moveTo).toHaveBeenCalled();
    expect(mockGraphics.lineTo).toHaveBeenCalled();
  });

  it("should draw cyan solid frame for inspect selection", () => {
    vi.clearAllMocks();
    overlay.setMode("inspect");
    overlay.setSelectedTile(10, 10);
    
    expect(mockGraphics.lineStyle).toHaveBeenCalledWith(3, 0x00FFFF, 0.9);
    expect(mockGraphics.strokeRect).toHaveBeenCalledWith(10 * 32, 10 * 32, 32, 32);
  });

  it("should update hovered tile in demolish mode", () => {
    overlay.setMode("demolish");
    overlay.setHoveredTile(5, 5);
    // Dashed frame uses moveTo/lineTo, not strokeRect
    expect(mockGraphics.moveTo).toHaveBeenCalled();
    expect(mockGraphics.lineTo).toHaveBeenCalled();
    
    vi.clearAllMocks();
    overlay.setHoveredTile(6, 6);
    expect(mockGraphics.moveTo).toHaveBeenCalled();
    
    vi.clearAllMocks();
    overlay.setHoveredTile(null, null); // Clear - should clear graphics
    expect(mockGraphics.clear).toHaveBeenCalled();
  });

  it("should update selected tile in inspect mode", () => {
    vi.clearAllMocks();
    overlay.setMode("inspect");
    overlay.setSelectedTile(5, 5);
    overlay.setSelectedTile(10, 10);
    overlay.setSelectedTile(null, null); // Clear
    
    expect(mockGraphics.strokeRect).toHaveBeenCalledTimes(2); // Two positions
  });

  it("should hide all overlays", () => {
    overlay.setMode("place");
    overlay.setHoveredTile(5, 5);
    overlay.hide();
    
    expect(mockGraphics.clear).toHaveBeenCalled();
    expect(mockGraphics.setVisible).toHaveBeenCalledWith(false);
  });

  it("should destroy graphics", () => {
    overlay.setMode("place");
    overlay.destroy();
    
    expect(mockGraphics.destroy).toHaveBeenCalled();
  });

  it("should clear previous hover when switching modes", () => {
    overlay.setMode("demolish");
    overlay.setHoveredTile(5, 5);
    
    vi.clearAllMocks();
    overlay.setMode("inspect");
    // In inspect mode, no hover frame should be drawn
    const redCalls = mockGraphics.lineStyle.mock.calls.filter(
      (c: any[]) => c[1] === 0xFF0000
    );
    expect(redCalls.length).toBe(0);
  });
});
