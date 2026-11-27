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

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Show the placement ghost at the given tile position
   * @param tileX - X coordinate of the tile
   * @param tileY - Y coordinate of the tile
   * @param building - The building type to preview
   * @param direction - The direction of the building
   */
  show(tileX: number, tileY: number, building: BuildingType, direction: Direction): void {
    if (!this.sprite) {
      // Create the ghost sprite if it doesn't exist
      const textureKey = getBuildingTextureKey(building, direction, 0) + "_ok";
      this.sprite = this.scene.add.sprite(0, 0, textureKey);
      this.sprite.setAlpha(0.5);
      this.sprite.setDepth(1000); // Above all other objects
    } else {
      // Update texture if building type or direction changed
      const textureKey = getBuildingTextureKey(building, direction, 0) + "_ok";
      this.sprite.setTexture(textureKey);
    }

    // Position at center of tile (tileX + 0.5) * TILE_SIZE, (tileY + 0.5) * TILE_SIZE
    this.sprite.setPosition((tileX + 0.5) * TILE_SIZE, (tileY + 0.5) * TILE_SIZE);
    this.sprite.setVisible(true);
  }

  /**
   * Hide the placement ghost
   */
  hide(): void {
    if (this.sprite) {
      this.sprite.setVisible(false);
    }
  }

  /**
   * Update the ghost position and rotation
   * @param tileX - X coordinate of the tile
   * @param tileY - Y coordinate of the tile
   * @param building - The building type to preview
   * @param direction - The direction of the building
   */
  update(tileX: number, tileY: number, building: BuildingType, direction: Direction): void {
    this.show(tileX, tileY, building, direction);
  }

  /**
   * Destroy the ghost sprite
   */
  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
