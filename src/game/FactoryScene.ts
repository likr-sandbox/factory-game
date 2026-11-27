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
import { UI_PALETTE } from "./palette";
import { PlacementGhost } from "./overlays";

export const TILE_SIZE = 32;

const CAMERA_SPEED = 5;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_SENSITIVITY = 0.1;

export class FactoryScene extends Scene {
  private cameraPanStart: { x: number; y: number } | null = null;
  private lastMousePos: { x: number; y: number } | null = null;
  private lastHoveredTile: { x: number; y: number } | null = null;
  private world: WorldState | null = null;
  private inputState: InputState | null = null;
  // Explicit sprite tracking to prevent leaks
  private buildingSprites: Map<string, GameObjects.Sprite> = new Map();
  private itemSprites: Map<string, GameObjects.Sprite> = new Map();
  // Status overlay tracking for faulted buildings and depleted deposits
  private faultOverlays: Map<string, GameObjects.Graphics> = new Map();
  private depletedOverlays: Map<string, GameObjects.Graphics> = new Map();
  // Placement ghost preview
  private placementGhost: PlacementGhost | null = null;

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

    // Initialize placement ghost
    this.placementGhost = new PlacementGhost(this);

    // Sync the initial world state now that Phaser is ready
    if (this.world) {
      this.syncWorld(this.world);
    }
  }

  /**
   * Render the 64x64 terrain tilemap using texture keys from sprites/terrain
   * Renders actual terrain and ore deposits from this.world.tiles when bound
   */
  renderTerrainTilemap(): void {
    const worldWidth = 64;
    const worldHeight = 64;

    // If world is bound, render actual terrain and deposits from world.tiles
    if (this.world && this.world.tiles.length > 0) {
      for (let y = 0; y < this.world.height; y++) {
        for (let x = 0; x < this.world.width; x++) {
          const tile = this.world.tiles[y]?.[x];
          if (!tile) continue;

          // Render base terrain
          const terrainKey = getTerrainTextureKey(tile.terrain, 0);
          this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, terrainKey);

          // Render ore deposit overlay if present
          if (tile.deposit) {
            const depositKey = getDepositTextureKey(tile.deposit.material, 0);
            const depositSprite = this.add.sprite(
              x * TILE_SIZE + TILE_SIZE / 2,
              y * TILE_SIZE + TILE_SIZE / 2,
              depositKey
            );
            depositSprite.setDepth(0.5); // Deposit overlays terrain
          }
        }
      }
    } else {
      // Fallback: render placeholder grass grid when world not yet bound
      for (let y = 0; y < worldHeight; y++) {
        for (let x = 0; x < worldWidth; x++) {
          const terrainKey = getTerrainTextureKey("grass", 0);
          this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, terrainKey);
        }
      }
    }
  }

  /**
   * Sync world state to game objects (buildings, items)
   * Uses explicit sprite tracking to prevent leaks
   */
  syncWorld(world: WorldState): void {
    // Guard: if Phaser has not yet booted create(), this.add will be undefined
    // Return early to prevent TypeError - pre-create() calls are safely skipped
    if (!this.add) {
      return;
    }

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

    // Destroy all tracked fault overlays
    for (const overlay of this.faultOverlays.values()) {
      overlay.destroy();
    }
    this.faultOverlays.clear();

    // Destroy all tracked depleted overlays
    for (const overlay of this.depletedOverlays.values()) {
      overlay.destroy();
    }
    this.depletedOverlays.clear();

    // Sync building sprites with explicit tracking
    for (const building of Object.values(world.buildings)) {
      const frame = building.type === "belt" || building.type === "underground_belt" ? 0 : 0;
      const baseKey = getBuildingTextureKey(building.type, building.direction, frame);
      const key = `${baseKey}_${building.faulted ? "faulted" : "ok"}`;

      // Hub is 2x2 tiles, so position at center and set display size to 64x64
      const isHub = building.type === "hub";
      let posX: number;
      let posY: number;
      if (isHub) {
        // Center of 2x2 hub at (x+1, y+1)
        posX = (building.x + 1) * TILE_SIZE;
        posY = (building.y + 1) * TILE_SIZE;
      } else {
        // 1x1 building centered in tile
        posX = building.x * TILE_SIZE + TILE_SIZE / 2;
        posY = building.y * TILE_SIZE + TILE_SIZE / 2;
      }

      const sprite = this.add.sprite(posX, posY, key);
      if (isHub) {
        sprite.setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2);
      }
      sprite.setDepth(building.y);
      this.buildingSprites.set(building.id, sprite);

      // Create fault overlay for faulted buildings
      if (building.faulted) {
        const faultOverlay = this.add.graphics();
        faultOverlay.x = posX;
        faultOverlay.y = posY;
        faultOverlay.setDepth(building.y + 1); // Above building
        
        // Draw red warning indicator (exclamation mark shape)
        const color = parseInt(UI_PALETTE.fault.hex.substring(1), 16);
        faultOverlay.fillStyle(color, 1);
        
        // Draw a warning triangle/exclamation indicator
        const size = 8;
        const x = posX;
        const y = isHub ? posY - TILE_SIZE : posY - TILE_SIZE / 2;
        
        // Draw exclamation mark - top bar
        faultOverlay.fillRect(x - size / 2, y - 4, size, 2);
        // Draw exclamation mark - bottom dot
        faultOverlay.fillCircle(x, y + 2, 2);
        
        this.faultOverlays.set(building.id, faultOverlay);
      }

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

    // Create depleted overlays for exhausted ore deposits
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.tiles[y]?.[x];
        if (!tile || !tile.deposit) continue;

        if (tile.deposit.remaining <= 0) {
          const key = `depleted_${x}_${y}`;
          const depletedOverlay = this.add.graphics();
          depletedOverlay.x = x * TILE_SIZE + TILE_SIZE / 2;
          depletedOverlay.y = y * TILE_SIZE + TILE_SIZE / 2;
          depletedOverlay.setDepth(0.6); // Above deposit, below buildings

          // Draw depleted indicator (red X mark)
          const color = parseInt(UI_PALETTE.fault.hex.substring(1), 16);
          depletedOverlay.lineStyle(2, color, 1);

          // Draw X shape to indicate depleted
          const size = 8;
          const cx = x * TILE_SIZE + TILE_SIZE / 2;
          const cy = y * TILE_SIZE + TILE_SIZE / 2;
          
          depletedOverlay.beginPath();
          depletedOverlay.moveTo(cx - size / 2, cy - size / 2);
          depletedOverlay.lineTo(cx + size / 2, cy + size / 2);
          depletedOverlay.moveTo(cx + size / 2, cy - size / 2);
          depletedOverlay.lineTo(cx - size / 2, cy + size / 2);
          depletedOverlay.strokePath();

          this.depletedOverlays.set(key, depletedOverlay);
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

    // Center camera on hub origin (hub is 2x2 tiles, so center is at (hubOrigin.x + 1) * TILE_SIZE, (hubOrigin.y + 1) * TILE_SIZE)
    const hubOrigin = this.world?.hubOrigin ?? { x: 31, y: 31 };
    camera.centerOn((hubOrigin.x + 1) * TILE_SIZE, (hubOrigin.y + 1) * TILE_SIZE);

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

      // Track hover position for ghost updates on rotation
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      this.lastHoveredTile = { x: tileX, y: tileY };

      // Update placement ghost preview when in place mode with a selected building
      if (this.inputState?.mode === "place" && this.inputState.selectedBuilding && this.placementGhost) {
        this.placementGhost.update(tileX, tileY, this.inputState.selectedBuilding, this.inputState.direction);
      } else if (this.placementGhost) {
        this.placementGhost.hide();
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

    // Mouse wheel zoom - Phaser 3 wheel event signature: (pointer, gameObjects, deltaX, deltaY)
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
      if (deltaY === 0) return;
      const currentZoom = camera.zoom;
      // Negative deltaY = wheel up = zoom in (+ZOOM_SENSITIVITY)
      // Positive deltaY = wheel down = zoom out (-ZOOM_SENSITIVITY)
      const newZoom = currentZoom - Math.sign(deltaY) * ZOOM_SENSITIVITY;
      camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    });
  }

  /**
   * Setup keyboard controls (WASD/arrows for camera, R for rotate, X for demolish)
   */
  private setupKeyboardControls(): void {
    const cursors = this.input.keyboard?.createCursorKeys();
    const wKey = this.input.keyboard?.addKey("W");
    const aKey = this.input.keyboard?.addKey("A");
    const sKey = this.input.keyboard?.addKey("S");
    const dKey = this.input.keyboard?.addKey("D");

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-R", () => {
        if (!this.inputState) return;
        this.inputState.direction = rotateDirection(this.inputState.direction);
        // Update placement ghost preview immediately with new direction
        if (this.placementGhost && this.inputState.mode === "place" && this.inputState.selectedBuilding && this.lastHoveredTile) {
          this.placementGhost.update(this.lastHoveredTile.x, this.lastHoveredTile.y, this.inputState.selectedBuilding, this.inputState.direction);
        }
        this.events.emit("worldMutated");
      });

      this.input.keyboard.on("keydown-X", () => {
        if (!this.inputState) return;
        this.inputState.mode = "demolish";
        // Hide placement ghost when switching to demolish mode
        if (this.placementGhost) {
          this.placementGhost.hide();
        }
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
