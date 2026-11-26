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
  private world: WorldState | null = null;
  private inputState: InputState | null = null;
  // Explicit sprite tracking to prevent leaks
  private buildingSprites: Map<string, GameObjects.Sprite> = new Map();
  private itemSprites: Map<string, GameObjects.Sprite> = new Map();

  constructor() {
    super("FactoryScene");
  }

  init(): void {
    if (!this.cameras) {
      throw new Error("Camera system not initialized");
    }
  }

  /**
   * Bind the active world state and input state for this scene
   * Called from src/main.ts initGame() to connect scene to live simulation
   */
  setContext(world: WorldState, inputState: InputState): void {
    this.world = world;
    this.inputState = inputState;
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
   * Uses explicit sprite tracking to prevent leaks
   */
  syncWorld(world: WorldState): void {
    // Destroy all tracked building sprites
    for (const sprite of this.buildingSprites.values()) {
      sprite.destroy();
    }
    this.buildingSprites.clear();

    // Destroy all tracked item sprites
    for (const sprite of this.itemSprites.values()) {
      sprite.destroy();
    }
    this.itemSprites.clear();

    // Sync building sprites with explicit tracking
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
      this.buildingSprites.set(building.id, sprite);

      // Track expected item keys for this building
      for (let i = 0; i < building.beltItems.length; i++) {
        const item = building.beltItems[i]!;
        const itemKey = getItemTextureKey(item.material);
        const spriteKey = `${building.id}_item_${i}`;

        const itemSprite = this.add.sprite(
          building.x * TILE_SIZE + TILE_SIZE / 2,
          building.y * TILE_SIZE + TILE_SIZE / 2,
          itemKey
        );
        itemSprite.setDepth(building.y + 0.5);
        itemSprite.setName(spriteKey);
        this.itemSprites.set(spriteKey, itemSprite);
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

    let dragStartTile: { x: number; y: number } | null = null;

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        // Middle or right mouse button - start camera pan
        this.cameraPanStart = { x: pointer.x, y: pointer.y };
        this.lastMousePos = { x: pointer.x, y: pointer.y };
      } else if (pointer.button === 0) {
        // Left mouse button - handle tile click or belt drag
        const tileX = Math.floor(pointer.worldX / TILE_SIZE);
        const tileY = Math.floor(pointer.worldY / TILE_SIZE);

        // Check if we're starting a belt drag (holding shift or in place mode with belt selected)
        if (this.inputState?.mode === "place" && this.inputState.selectedBuilding === "belt") {
          startBeltDrag(this.inputState, tileX, tileY);
          dragStartTile = { x: tileX, y: tileY };
        } else {
          // Handle tile click with bound world state (fail fast if not bound)
          if (!this.world || !this.inputState) {
            console.warn("FactoryScene: world or inputState not bound yet");
            return;
          }
          const result = handleTileClick(this.world, this.inputState, tileX, tileY);
          if (result.success) {
            this.events.emit("worldMutated");
          }
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
      } else if (pointer.button === 0 && this.inputState?.isDraggingBelt && dragStartTile) {
        // End belt drag
        const endTileX = Math.floor(pointer.worldX / TILE_SIZE);
        const endTileY = Math.floor(pointer.worldY / TILE_SIZE);
        
        if (this.world && this.inputState) {
          const result = endBeltDrag(this.world, this.inputState, endTileX, endTileY);
          if (result.success) {
            this.events.emit("worldMutated");
          }
        }
        dragStartTile = null;
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
        if (!this.inputState) return;
        this.inputState.direction = rotateDirection(this.inputState.direction);
        this.events.emit("worldMutated");
      });

      this.input.keyboard.on("keydown-X", () => {
        if (!this.inputState) return;
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
