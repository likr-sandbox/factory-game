// Placement ghost preview overlay controller
import type { Scene, GameObjects } from "phaser";
import type { Direction, BuildingType } from "../sim/types";
import { getBuildingTextureKey } from "./sprites/buildings";
import { TILE_SIZE } from "./FactoryScene";

/**
 * PlacementGhost manages a semi-transparent preview sprite for building placement
 */
export class PlacementGhost {
  private sprite: GameObjects.Sprite | null = null;
  private scene: Scene;
  private graphics: GameObjects.Graphics | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Show the placement ghost at the given tile position
   * @param tileX - X coordinate of the tile
   * @param tileY - Y coordinate of the tile
   * @param building - The building type to preview
   * @param direction - The direction of the building
   * @param valid - Whether the placement is valid (true = green highlight, false = red highlight)
   */
  show(tileX: number, tileY: number, building: BuildingType, direction: Direction, valid: boolean = true): void {
    if (!this.sprite) {
      // Create the ghost sprite if it doesn't exist
      const textureKey = getBuildingTextureKey(building, direction, 0);
      this.sprite = this.scene.add.sprite(0, 0, textureKey);
      this.sprite.setAlpha(0.5);
      this.sprite.setDepth(1000); // Above all other objects
    } else {
      // Update texture if building type or direction changed
      const textureKey = getBuildingTextureKey(building, direction, 0);
      this.sprite.setTexture(textureKey);
    }

    // Position at center of tile (tileX + 0.5) * TILE_SIZE, (tileY + 0.5) * TILE_SIZE
    this.sprite.setPosition((tileX + 0.5) * TILE_SIZE, (tileY + 0.5) * TILE_SIZE);
    this.sprite.setVisible(true);

    // Create or update the highlight frame graphics
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics();
      this.graphics.setDepth(1001);
    }

    this.graphics.clear();
    
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const size = TILE_SIZE;

    // Draw highlight frame based on validity
    if (valid) {
      // Green highlight for valid placement
      this.graphics.lineStyle(2, 0x00FF00, 0.8);
    } else {
      // Red highlight for invalid placement
      this.graphics.lineStyle(2, 0xFF0000, 0.8);
    }
    this.graphics.strokeRect(x, y, size, size);

    // Draw direction arrow emphasis
    this.drawDirectionArrow(direction, x, y, size, valid);
  }

  /**
   * Draw an arrow indicating the building's direction
   */
  private drawDirectionArrow(direction: Direction, x: number, y: number, size: number, valid: boolean): void {
    if (!this.graphics) return;

    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const arrowSize = size * 0.3;
    const offset = size * 0.25;

    let arrowColor = valid ? 0x00FF00 : 0xFF0000;
    let alpha = 0.7;

    this.graphics.lineStyle(3, arrowColor, alpha);

    let startX: number, startY: number, endX: number, endY: number;

    switch (direction) {
      case "N":
        startX = centerX;
        startY = centerY + offset;
        endX = centerX;
        endY = centerY - offset - arrowSize;
        break;
      case "S":
        startX = centerX;
        startY = centerY - offset;
        endX = centerX;
        endY = centerY + offset + arrowSize;
        break;
      case "W":
        startX = centerX + offset;
        startY = centerY;
        endX = centerX - offset - arrowSize;
        endY = centerY;
        break;
      case "E":
        startX = centerX - offset;
        startY = centerY;
        endX = centerX + offset + arrowSize;
        endY = centerY;
        break;
    }

    // Draw arrow line
    this.graphics.moveTo(startX, startY);
    this.graphics.lineTo(endX, endY);

    // Draw arrowhead
    const headSize = arrowSize * 0.5;
    let hx1: number, hy1: number, hx2: number, hy2: number;

    switch (direction) {
      case "N":
        hx1 = endX - headSize;
        hy1 = endY + headSize;
        hx2 = endX + headSize;
        hy2 = endY + headSize;
        break;
      case "S":
        hx1 = endX - headSize;
        hy1 = endY - headSize;
        hx2 = endX + headSize;
        hy2 = endY - headSize;
        break;
      case "W":
        hx1 = endX + headSize;
        hy1 = endY - headSize;
        hx2 = endX + headSize;
        hy2 = endY + headSize;
        break;
      case "E":
        hx1 = endX - headSize;
        hy1 = endY - headSize;
        hx2 = endX - headSize;
        hy2 = endY + headSize;
        break;
    }

    this.graphics.moveTo(endX, endY);
    this.graphics.lineTo(hx1, hy1);
    this.graphics.moveTo(endX, endY);
    this.graphics.lineTo(hx2, hy2);
  }

  /**
   * Hide the placement ghost
   */
  hide(): void {
    if (this.sprite) {
      this.sprite.setVisible(false);
    }
    if (this.graphics) {
      this.graphics.clear();
      this.graphics.setVisible(false);
    }
  }

  /**
   * Update the ghost position and rotation
   * @param tileX - X coordinate of the tile
   * @param tileY - Y coordinate of the tile
   * @param building - The building type to preview
   * @param direction - The direction of the building
   * @param valid - Whether the placement is valid
   */
  update(tileX: number, tileY: number, building: BuildingType, direction: Direction, valid: boolean = true): void {
    this.show(tileX, tileY, building, direction, valid);
  }

  /**
   * Destroy the ghost sprite and graphics
   */
  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }
}

/**
 * Tile validity status for belt path
 */
export interface BeltPathTile {
  x: number;
  y: number;
  valid: boolean;
}

/**
 * BeltDragPreview manages semi-transparent belt ghost sprites during L-shaped belt dragging
 * Shows all path tiles with color-coded validity (green for valid, red for invalid)
 */
export class BeltDragPreview {
  private graphics: GameObjects.Graphics | null = null;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Show the belt drag preview along the L-shaped path from start to end
   * @param startX - Starting X coordinate
   * @param startY - Starting Y coordinate
   * @param endX - Ending X coordinate
   * @param endY - Ending Y coordinate
   * @param path - Array of path tiles with validity info (from computeBeltPreviewPath)
   */
  show(startX: number, startY: number, endX: number, endY: number, path: BeltPathTile[]): void {
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics();
      this.graphics.setDepth(1000);
    }

    this.graphics.clear();

    // Draw each tile in the path
    for (const tile of path) {
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      const size = TILE_SIZE;

      if (tile.valid) {
        // Semi-transparent green belt ghost for valid tiles
        this.graphics.fillStyle(0x00FF00, 0.2);
        this.graphics.fillRect(x + 4, y + 12, size - 8, 8); // Belt-like shape
        this.graphics.lineStyle(2, 0x00FF00, 0.5);
        this.graphics.strokeRect(x, y, size, size);
      } else {
        // Semi-transparent red belt ghost for invalid tiles
        this.graphics.fillStyle(0xFF0000, 0.2);
        this.graphics.fillRect(x + 4, y + 12, size - 8, 8); // Belt-like shape
        this.graphics.lineStyle(2, 0xFF0000, 0.5);
        this.graphics.strokeRect(x, y, size, size);
      }
    }

    this.graphics.setVisible(true);
  }

  /**
   * Hide the belt drag preview
   */
  hide(): void {
    if (this.graphics) {
      this.graphics.clear();
      this.graphics.setVisible(false);
    }
  }

  /**
   * Destroy the graphics object
   */
  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }
}

/**
 * ModeOverlay manages mode-specific visual overlays:
 * - 32x32 tile grid in place/demolish modes
 * - Red dashed frame for demolish hover
 * - Cyan frame for inspect selection
 */
export class ModeOverlay {
  private graphics: GameObjects.Graphics | null = null;
  private scene: Scene;
  private mode: "place" | "demolish" | "inspect" = "place";
  private hoveredTile: { x: number; y: number } | null = null;
  private selectedTile: { x: number; y: number } | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Set the current input mode and update overlay accordingly
   * @param mode - The input mode ("place", "demolish", or "inspect")
   */
  setMode(mode: "place" | "demolish" | "inspect"): void {
    this.mode = mode;
    this.update();
  }

  /**
   * Update the hovered tile for demolish mode
   * @param x - X coordinate of hovered tile (null to clear)
   * @param y - Y coordinate of hovered tile
   */
  setHoveredTile(x: number | null, y: number | null): void {
    if (x === null || y === null) {
      this.hoveredTile = null;
    } else {
      this.hoveredTile = { x, y };
    }
    this.update();
  }

  /**
   * Update the selected tile for inspect mode
   * @param x - X coordinate of selected tile (null to clear)
   * @param y - Y coordinate of selected tile
   */
  setSelectedTile(x: number | null, y: number | null): void {
    if (x === null || y === null) {
      this.selectedTile = null;
    } else {
      this.selectedTile = { x, y };
    }
    this.update();
  }

  /**
   * Draw or update all overlays based on current mode and state
   */
  private update(): void {
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics();
      this.graphics.setDepth(1002);
    }

    this.graphics.clear();

    // Always draw the tile grid in place and demolish modes
    if (this.mode === "place" || this.mode === "demolish") {
      this.drawGrid();
    }

    // Draw demolish hover frame
    if (this.mode === "demolish" && this.hoveredTile) {
      this.drawDemolishHover(this.hoveredTile.x, this.hoveredTile.y);
    }

    // Draw inspect selection frame
    if (this.mode === "inspect" && this.selectedTile) {
      this.drawInspectSelection(this.selectedTile.x, this.selectedTile.y);
    }

    this.graphics.setVisible(true);
  }

  /**
   * Draw a thin 32x32 tile grid across the visible area
   */
  private drawGrid(): void {
    if (!this.graphics) return;

    const camera = this.scene.cameras?.main;
    if (!camera) return;

    // Get visible area bounds in world coordinates
    const left = Math.floor(camera.scrollX / TILE_SIZE);
    const top = Math.floor(camera.scrollY / TILE_SIZE);
    const right = Math.ceil((camera.scrollX + camera.width) / TILE_SIZE);
    const bottom = Math.ceil((camera.scrollY + camera.height) / TILE_SIZE);

    this.graphics.lineStyle(1, 0xFFFFFF, 0.15);

    // Draw vertical lines
    for (let x = left; x <= right; x++) {
      const px = x * TILE_SIZE;
      this.graphics.moveTo(px, top * TILE_SIZE);
      this.graphics.lineTo(px, bottom * TILE_SIZE);
    }

    // Draw horizontal lines
    for (let y = top; y <= bottom; y++) {
      const py = y * TILE_SIZE;
      this.graphics.moveTo(left * TILE_SIZE, py);
      this.graphics.lineTo(right * TILE_SIZE, py);
    }
  }

  /**
   * Draw a red dashed frame around the hovered tile in demolish mode
   */
  private drawDemolishHover(x: number, y: number): void {
    if (!this.graphics) return;

    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    const size = TILE_SIZE;

    // Red dashed frame - manually draw dashes
    this.graphics.lineStyle(2, 0xFF0000, 0.8);

    // Top edge
    for (let i = 0; i < size; i += 8) {
      this.graphics.moveTo(px + i, py);
      this.graphics.lineTo(px + i + 4, py);
    }
    // Bottom edge
    for (let i = 0; i < size; i += 8) {
      this.graphics.moveTo(px + i, py + size);
      this.graphics.lineTo(px + i + 4, py + size);
    }
    // Left edge
    for (let i = 0; i < size; i += 8) {
      this.graphics.moveTo(px, py + i);
      this.graphics.lineTo(px, py + i + 4);
    }
    // Right edge
    for (let i = 0; i < size; i += 8) {
      this.graphics.moveTo(px + size, py + i);
      this.graphics.lineTo(px + size, py + i + 4);
    }
  }

  /**
   * Draw a cyan solid frame around the selected tile in inspect mode
   */
  private drawInspectSelection(x: number, y: number): void {
    if (!this.graphics) return;

    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    const size = TILE_SIZE;

    // Cyan solid frame
    this.graphics.lineStyle(3, 0x00FFFF, 0.9);
    this.graphics.strokeRect(px, py, size, size);
  }

  /**
   * Hide all overlays
   */
  hide(): void {
    if (this.graphics) {
      this.graphics.clear();
      this.graphics.setVisible(false);
    }
  }

  /**
   * Destroy the graphics object
   */
  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }
}
