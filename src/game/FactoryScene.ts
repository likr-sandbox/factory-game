// FactoryScene: Main Phaser scene for the factory game
import { Scene, GameObjects } from "phaser";
import type { WorldState, Direction } from "../sim/types";
import type { InputState } from "./input";
import { registerAllTextures } from "./textures";
import { getTerrainTextureKey, getDepositTextureKey } from "./sprites/terrain";
import { getBuildingTextureKey } from "./sprites/buildings";
import { getItemTextureKey } from "./sprites/items";
import {
  handleTileClick,
  startBeltDrag,
  endBeltDrag,
  rotateDirection,
  createInputState,
} from "./input";

export const TILE_SIZE = 32;

const CAMERA_SPEED = 5;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_SENSITIVITY = 0.1;

export class FactoryScene extends Scene {
  private cameraPanStart: { x: number; y: number } | null = null;
  private lastMousePos: { x: number; y: number } | null = null;
  private inputState: InputState;

  constructor() {
    super("FactoryScene");
    this.inputState = createInputState();
  }

  init(): void {
    if (!this.cameras) {
      throw new Error("Camera system not initialized");
    }
  }

  create(): void {
    // Register all procedural textures
    registerAllTextures(this);

    // Create a 64x64 terrain tilemap (placeholder - actual world data comes from syncWorld)
    this.renderTerrainTilemap();

    // Setup camera controls
    this.setupCameraControls();

    // Setup keyboard shortcuts
    this.setupKeyboardControls();
  }

  /**
   * Render the 64x64 terrain tilemap using texture keys from sprites/terrain
   */
  renderTerrainTilemap(): void {
    const worldWidth = 64;
    const worldHeight = 64;

    // Placeholder terrain rendering - in production, this would use actual world.tiles
    // For now, render a simple grass grid
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        const terrainKey = getTerrainTextureKey("grass", 0);
        this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, terrainKey);
      }
    }
  }

  /**
   * Sync world state to game objects (buildings, items)
   */
  syncWorld(world: WorldState): void {
    // Destroy existing building sprites
    const existingBuildings = this.children.list.filter(
      (child): child is GameObjects.Sprite => {
        if (!(child instanceof GameObjects.Sprite)) return false;
        const sprite = child as unknown as { key?: string };
        return sprite.key?.startsWith("building_") ?? false;
      }
    );
    for (const sprite of existingBuildings) {
      sprite.destroy();
    }

    // Destroy existing item sprites
    const existingItems = this.children.list.filter(
      (child): child is GameObjects.Sprite => {
        if (!(child instanceof GameObjects.Sprite)) return false;
        const sprite = child as unknown as { key?: string };
        return sprite.key?.startsWith("item_") ?? false;
      }
    );
    for (const sprite of existingItems) {
      sprite.destroy();
    }

    // Build expected item keys for cleanup
    const expectedItemKeys = new Set<string>();

    // Sync building sprites
    for (const building of Object.values(world.buildings)) {
      const frame = building.type === "belt" || building.type === "underground_belt" ? 0 : 0;
      const baseKey = getBuildingTextureKey(building.type, building.direction, frame);
      const key = `${baseKey}_${building.faulted ? "faulted" : "ok"}`;

      const sprite = this.add.sprite(
        building.x * TILE_SIZE + TILE_SIZE / 2,
        building.y * TILE_SIZE + TILE_SIZE / 2,
        key
      );
      sprite.setDepth(building.y);

      // Track expected item keys for this building
      for (let i = 0; i < building.beltItems.length; i++) {
        expectedItemKeys.add(`${building.id}_item_${i}`);
      }
    }

    // Update belt item sprites
    this.updateBeltItemSprites(world, expectedItemKeys);
  }

  /**
   * Update belt item sprites for all buildings
   * IMPORTANT: itemIndex must be reset inside the per-building loop
   */
  updateBeltItemSprites(world: WorldState, expectedItemKeys?: Set<string>): void {
    const destroyedKeys = new Set<string>();

    for (const building of Object.values(world.buildings)) {
      // Reset itemIndex INSIDE the per-building loop to match expectedItemKeys format
      let itemIndex = 0;

      for (const item of building.beltItems) {
        const itemKey = getItemTextureKey(item.material);
        const spriteKey = `${building.id}_item_${itemIndex}`;

        const sprite = this.add.sprite(
          building.x * TILE_SIZE + TILE_SIZE / 2,
          building.y * TILE_SIZE + TILE_SIZE / 2,
          itemKey
        );
        sprite.setName(spriteKey);
        sprite.setDepth(building.y + 0.5);
        destroyedKeys.add(spriteKey);
        itemIndex++;
      }
    }

    // Clean up removed item sprites
    if (expectedItemKeys) {
      const firstBuildingId = Object.values(world.buildings)[0]?.id;
      if (firstBuildingId) {
        const prefix = `${firstBuildingId}_item_`;
        const existingSprites = this.children.list.filter(
          (child): child is GameObjects.Sprite => {
            if (!(child instanceof GameObjects.Sprite)) return false;
            const sprite = child as unknown as { name?: string };
            return sprite.name?.startsWith(prefix) ?? false;
          }
        );
        for (const sprite of existingSprites) {
          const spriteName = (sprite as unknown as { name?: string }).name;
          if (spriteName && !expectedItemKeys.has(spriteName) && !destroyedKeys.has(spriteName)) {
            sprite.destroy();
          }
        }
      }
    }
  }

  /**
   * Setup camera pan and zoom controls
   */
  private setupCameraControls(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, 64 * TILE_SIZE, 64 * TILE_SIZE);
    camera.setZoom(1);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        // Middle or right mouse button - start camera pan
        this.cameraPanStart = { x: pointer.x, y: pointer.y };
        this.lastMousePos = { x: pointer.x, y: pointer.y };
        camera.pan(0, 0, 0);
      } else if (pointer.button === 0) {
        // Left mouse button - handle tile click
        const worldX = Math.floor(pointer.x / TILE_SIZE);
        const worldY = Math.floor(pointer.y / TILE_SIZE);
        const result = handleTileClick(
          {} as WorldState,
          this.inputState,
          worldX,
          worldY
        );
        if (result.success) {
          this.events.emit("worldMutated");
        }
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.cameraPanStart && this.lastMousePos) {
        const dx = pointer.x - this.lastMousePos.x;
        const dy = pointer.y - this.lastMousePos.y;
        camera.scrollX += dx * CAMERA_SPEED;
        camera.scrollY += dy * CAMERA_SPEED;
        this.lastMousePos = { x: pointer.x, y: pointer.y };
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        this.cameraPanStart = null;
        this.lastMousePos = null;
      }
    });

    // Mouse wheel zoom
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaZ: number) => {
      const currentZoom = camera.zoom;
      const newZoom = currentZoom + deltaZ * ZOOM_SENSITIVITY;
      camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    });
  }

  /**
   * Setup keyboard controls (WASD/arrows for camera, R for rotate, X for demolish)
   */
  private setupKeyboardControls(): void {
    const cursors = this.input.keyboard?.createCursorKeys();
    const wKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const aKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const sKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    const dKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-R", () => {
        this.inputState.direction = rotateDirection(this.inputState.direction);
        this.events.emit("worldMutated");
      });

      this.input.keyboard.on("keydown-X", () => {
        this.inputState.mode = "demolish";
        this.events.emit("worldMutated");
      });
    }

    // Camera movement with WASD
    this.events.on("update", () => {
      const camera = this.cameras.main;
      if (cursors?.left.isDown || aKey?.isDown) {
        camera.scrollX -= CAMERA_SPEED;
      }
      if (cursors?.right.isDown || dKey?.isDown) {
        camera.scrollX += CAMERA_SPEED;
      }
      if (cursors?.up.isDown || wKey?.isDown) {
        camera.scrollY -= CAMERA_SPEED;
      }
      if (cursors?.down.isDown || sKey?.isDown) {
        camera.scrollY += CAMERA_SPEED;
      }
    });
  }

  update(): void {
    this.events.emit("update");
  }
}
