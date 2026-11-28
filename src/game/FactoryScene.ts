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
import {
  getBuildingAnimationFrame,
  computeBeltItemLayout,
  drawFaultIndicator,
  drawDepletedIndicator,
  syncBuildingStatusOverlays,
} from "./statusRenderer";

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
  private statusOverlays: Map<string, GameObjects.Graphics> = new Map();
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

  /**
   * Center camera on hub origin
   * Moves camera to (hubOrigin.x + 1) * TILE_SIZE, (hubOrigin.y + 1) * TILE_SIZE
   */
  centerCameraOnHub(): void {
    if (!this.cameras?.main) return;
    const camera = this.cameras.main;
    const hubOrigin = this.world?.hubOrigin ?? { x: 31, y: 31 };
    camera.centerOn((hubOrigin.x + 1) * TILE_SIZE, (hubOrigin.y + 1) * TILE_SIZE);
  }

  /**
   * Check if keyboard shortcuts should be blocked due to input focus
   * Returns true if activeElement is INPUT/TEXTAREA/SELECT
   */
  private isInputFocused(): boolean {
    const activeEl = globalThis.document?.activeElement;
    if (!activeEl) return false;
    const tagName = activeEl.tagName?.toUpperCase();
    return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
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
   * Sync world state to game objects (buildings, items) using ID-based diffing
   * Uses explicit sprite tracking to prevent leaks
   */
  syncWorld(world: WorldState): void {
    // Guard: if Phaser has not yet booted create(), this.add will be undefined
    // Return early to prevent TypeError - pre-create() calls are safely skipped
    if (!this.add) {
      return;
    }

    // Build sets of current IDs for diffing
    const currentBuildingIds = new Set(Object.keys(world.buildings));
    
    // Diff building sprites: destroy removed, update existing or create new
    for (const [id, sprite] of this.buildingSprites.entries()) {
      if (!currentBuildingIds.has(id)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
      }
    }
    for (const building of Object.values(world.buildings)) {
      const sprite = this.buildingSprites.get(building.id);
      const frame = getBuildingAnimationFrame(building, world);
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

      if (sprite) {
        // Reuse existing sprite
        sprite.setTexture(key);
        sprite.setPosition(posX, posY);
        sprite.setDepth(building.y);
        if (isHub) {
          sprite.setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2);
        }
      } else {
        // Create new sprite
        const newSprite = this.add.sprite(posX, posY, key);
        if (isHub) {
          newSprite.setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2);
        }
        newSprite.setDepth(building.y);
        this.buildingSprites.set(building.id, newSprite);
      }
    }

    // Diff item sprites: track expected keys per building
    const expectedItemKeys = new Set<string>();
    for (const building of Object.values(world.buildings)) {
      for (let i = 0; i < building.beltItems.length; i++) {
        expectedItemKeys.add(`${building.id}_item_${i}`);
      }
    }

    // Remove items no longer needed
    for (const [key, sprite] of this.itemSprites.entries()) {
      if (!expectedItemKeys.has(key)) {
        sprite.destroy();
        this.itemSprites.delete(key);
      }
    }

    // Update or create item sprites
    for (const building of Object.values(world.buildings)) {
      for (let i = 0; i < building.beltItems.length; i++) {
        const item = building.beltItems[i]!;
        const spriteKey = `${building.id}_item_${i}`;
        const itemKey = getItemTextureKey(item.material);
        
        const layout = computeBeltItemLayout(building, i, building.beltItems.length, world.tick);
        
        let itemSprite = this.itemSprites.get(spriteKey);
        if (itemSprite) {
          itemSprite.setTexture(itemKey);
          itemSprite.setPosition(layout.x, layout.y);
          itemSprite.setScale(layout.scale);
          itemSprite.setDepth(building.y + 0.5);
        } else {
          itemSprite = this.add.sprite(layout.x, layout.y, itemKey);
          itemSprite.setScale(layout.scale);
          itemSprite.setDepth(building.y + 0.5);
          itemSprite.setName(spriteKey);
          this.itemSprites.set(spriteKey, itemSprite);
        }
      }
    }

    // Diff fault overlays: only for faulted buildings
    const expectedFaultIds = new Set<string>();
    for (const building of Object.values(world.buildings)) {
      if (building.faulted) {
        expectedFaultIds.add(building.id);
      }
    }

    // Remove old fault overlays
    for (const [id, overlay] of this.faultOverlays.entries()) {
      if (!expectedFaultIds.has(id)) {
        overlay.destroy();
        this.faultOverlays.delete(id);
      }
    }

    // Update or create fault overlays
    for (const building of Object.values(world.buildings)) {
      if (!building.faulted) continue;
      
      const isHub = building.type === "hub";
      const posX = building.type === "hub" 
        ? (building.x + 1) * TILE_SIZE 
        : building.x * TILE_SIZE + TILE_SIZE / 2;
      const posY = building.type === "hub" 
        ? (building.y + 1) * TILE_SIZE 
        : building.y * TILE_SIZE + TILE_SIZE / 2;

      let overlay = this.faultOverlays.get(building.id);
      if (overlay) {
        drawFaultIndicator(overlay as unknown as import("./statusRenderer").Graphics, isHub, world.tick);
        overlay.setPosition(posX, posY);
        overlay.setDepth(building.y + 1);
      } else {
        overlay = this.add.graphics();
        drawFaultIndicator(overlay as unknown as import("./statusRenderer").Graphics, isHub, world.tick);
        overlay.setPosition(posX, posY);
        overlay.setDepth(building.y + 1);
        this.faultOverlays.set(building.id, overlay);
      }
    }

    // Diff depleted overlays: only for tiles with deposit.remaining <= 0
    const expectedDepletedKeys = new Set<string>();
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.tiles[y]?.[x];
        if (tile?.deposit && tile.deposit.remaining <= 0) {
          expectedDepletedKeys.add(`depleted_${x}_${y}`);
        }
      }
    }

    // Remove old depleted overlays
    for (const [key, overlay] of this.depletedOverlays.entries()) {
      if (!expectedDepletedKeys.has(key)) {
        overlay.destroy();
        this.depletedOverlays.delete(key);
      }
    }

    // Update or create depleted overlays
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.tiles[y]?.[x];
        if (!tile?.deposit || tile.deposit.remaining > 0) continue;
        
        const key = `depleted_${x}_${y}`;
        const posX = x * TILE_SIZE + TILE_SIZE / 2;
        const posY = y * TILE_SIZE + TILE_SIZE / 2;

        let overlay = this.depletedOverlays.get(key);
        if (overlay) {
          drawDepletedIndicator(overlay as unknown as import("./statusRenderer").Graphics);
          overlay.setPosition(posX, posY);
          overlay.setDepth(0.6);
        } else {
          overlay = this.add.graphics();
          drawDepletedIndicator(overlay as unknown as import("./statusRenderer").Graphics);
          overlay.setPosition(posX, posY);
          overlay.setDepth(0.6);
          this.depletedOverlays.set(key, overlay);
        }
      }
    }

    // Sync building status overlays (progress bars, recipe/filter indicators, stall warnings)
    syncBuildingStatusOverlays(
      this as unknown as import("./statusRenderer").Scene, 
      this.statusOverlays as unknown as Map<string, import("./statusRenderer").Graphics>, 
      world
    );
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
          } else {
            this.events.emit("actionFailed", result.error);
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
          } else {
            this.events.emit("actionFailed", result.error);
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
        // Skip if input element is focused (e.g., seed-input)
        if (this.isInputFocused()) return;
        if (!this.inputState) return;
        this.inputState.direction = rotateDirection(this.inputState.direction);
        // Update placement ghost preview immediately with new direction
        if (this.placementGhost && this.inputState.mode === "place" && this.inputState.selectedBuilding && this.lastHoveredTile) {
          this.placementGhost.update(this.lastHoveredTile.x, this.lastHoveredTile.y, this.inputState.selectedBuilding, this.inputState.direction);
        }
        this.events.emit("worldMutated");
      });

      this.input.keyboard.on("keydown-X", () => {
        // Skip if input element is focused (e.g., seed-input)
        if (this.isInputFocused()) return;
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
      // Skip camera movement if input element is focused
      if (this.isInputFocused()) return;
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
