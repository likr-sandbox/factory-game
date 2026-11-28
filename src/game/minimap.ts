// Minimap module for 64x64 map visualization on 128x128px canvas
// Renders terrain, deposits, buildings, hub, and camera view rectangle

import type { WorldState, Tile, BuildingState, TerrainType } from "../sim/types";
import { TERRAIN_PALETTE, DEPOSIT_PALETTE, BUILDING_PALETTE } from "./palette";

// ============================================================================
// Constants
// ============================================================================

export const MINIMAP_SIZE = 128; // Canvas size in pixels
export const MAP_SIZE = 64; // World map size (64x64 tiles)
export const TILE_SCALE = MINIMAP_SIZE / MAP_SIZE; // 2 pixels per tile

// Hub is 2x2 tiles
export const HUB_SIZE = 2;

// Camera view rectangle dimensions (in tiles) - typical viewport
export const CAMERA_VIEW_TILES_X = 32;
export const CAMERA_VIEW_TILES_Y = 18;

// ============================================================================
// Options Type
// ============================================================================

export interface CameraViewport {
  /** Top-left tile coordinates of camera view */
  left: number;
  top: number;
  /** Width and height in tiles */
  width: number;
  height: number;
}

export interface MinimapOptions {
  /** Callback when user navigates to a tile (click/drag) */
  onNavigate?: (tileX: number, tileY: number) => void;
  /** Current camera position (top-left tile coordinates) - deprecated, use cameraViewport */
  cameraX?: number;
  cameraY?: number;
  /** Whether minimap is visible */
  visible?: boolean;
}

// ============================================================================
// Internal State
// ============================================================================

interface MinimapState {
  canvas: HTMLCanvasElement;
  container: { ownerDocument: Document; appendChild: (child: Node) => void };
  toggleButton: HTMLButtonElement;
  options: MinimapOptions;
  world: WorldState | null;
  isVisible: boolean;
}

let currentMinimap: MinimapState | null = null;

// ============================================================================
// Drawing Functions
// ============================================================================

/** Draw terrain with deposit overlay */
function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: Tile
): void {
  const pxX = x * TILE_SCALE;
  const pxY = y * TILE_SCALE;
  const size = TILE_SCALE;

  // Draw terrain background
  const terrainColor = TERRAIN_PALETTE[tile.terrain];
  ctx.fillStyle = terrainColor.hex;
  ctx.fillRect(pxX, pxY, size, size);

  // Draw deposit if present
  if (tile.deposit) {
    const depositColor = DEPOSIT_PALETTE[tile.deposit.material];
    // Draw deposit as a slightly darker overlay or center dot
    ctx.fillStyle = depositColor.hex;
    const dotSize = Math.max(1, Math.floor(size / 2));
    const offset = (size - dotSize) / 2;
    ctx.fillRect(pxX + offset, pxY + offset, dotSize, dotSize);
  }
}

/** Draw building on tile */
function drawBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  building: BuildingState
): void {
  const pxX = x * TILE_SCALE;
  const pxY = y * TILE_SCALE;
  const size = TILE_SCALE;

  const buildingColor = BUILDING_PALETTE[building.type];
  ctx.fillStyle = buildingColor.hex;
  
  // Draw building as filled square with slight border
  const margin = 1;
  ctx.fillRect(pxX + margin, pxY + margin, size - margin * 2, size - margin * 2);

  // Draw direction indicator (small triangle on output side)
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  const centerX = pxX + size / 2;
  const centerY = pxY + size / 2;
  const arrowSize = 3;
  
  let ax = centerX, ay = centerY;
  switch (building.direction) {
    case "N": ay -= arrowSize; break;
    case "S": ay += arrowSize; break;
    case "E": ax += arrowSize; break;
    case "W": ax -= arrowSize; break;
  }
  
  ctx.beginPath();
  ctx.arc(ax, ay, 2, 0, Math.PI * 2);
  ctx.fill();

  // Fault indicator
  if (building.faulted) {
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 1;
    ctx.strokeRect(pxX, pxY, size, size);
  }
}

/** Draw hub (2x2 area) */
function drawHub(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number
): void {
  const hubColor = BUILDING_PALETTE.hub.hex;
  ctx.fillStyle = hubColor;

  for (let dy = 0; dy < HUB_SIZE; dy++) {
    for (let dx = 0; dx < HUB_SIZE; dx++) {
      const pxX = (originX + dx) * TILE_SCALE;
      const pxY = (originY + dy) * TILE_SCALE;
      ctx.fillRect(pxX, pxY, TILE_SCALE, TILE_SCALE);
    }
  }

  // Hub outline
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    originX * TILE_SCALE,
    originY * TILE_SCALE,
    HUB_SIZE * TILE_SCALE,
    HUB_SIZE * TILE_SCALE
  );
}

/** Draw camera view rectangle */
function drawCameraView(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidthTiles: number,
  viewHeightTiles: number
): void {
  const viewWidthPx = viewWidthTiles * TILE_SCALE;
  const viewHeightPx = viewHeightTiles * TILE_SCALE;
  
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2]);
  ctx.strokeRect(cameraX * TILE_SCALE, cameraY * TILE_SCALE, viewWidthPx, viewHeightPx);
  ctx.setLineDash([]);
}

/** Draw player/cursor marker */
function drawPlayerMarker(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number
): void {
  const pxX = tileX * TILE_SCALE + TILE_SCALE / 2;
  const pxY = tileY * TILE_SCALE + TILE_SCALE / 2;
  
  ctx.fillStyle = "#FFFF00";
  ctx.beginPath();
  ctx.arc(pxX, pxY, 3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ============================================================================
// Minimap Rendering
// ============================================================================

/** Render the entire minimap */
function renderMinimap(state: MinimapState, cameraViewport?: CameraViewport): void {
  const ctx = state.canvas.getContext("2d");
  if (!ctx || !state.world) return;

  // Clear canvas
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // Draw background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // Draw all tiles
  const worldHeight = state.world.height;
  const worldWidth = state.world.width;
  
  for (let y = 0; y < Math.min(worldHeight, MAP_SIZE); y++) {
    const row = state.world.tiles[y];
    if (!row) continue;
    
    for (let x = 0; x < Math.min(worldWidth, MAP_SIZE); x++) {
      const tile = row[x];
      if (!tile) continue;
      
      drawTile(ctx, x, y, tile);
      
      // Draw building if present
      if (tile.buildingId) {
        const building = state.world.buildings[tile.buildingId];
        if (building) {
          drawBuilding(ctx, x, y, building);
        }
      }
    }
  }

  // Draw hub
  drawHub(ctx, state.world.hubOrigin.x, state.world.hubOrigin.y);

  // Draw camera view rectangle - use provided viewport or fallback to options
  let camLeft: number, camTop: number, camWidth: number, camHeight: number;
  
  if (cameraViewport) {
    camLeft = cameraViewport.left;
    camTop = cameraViewport.top;
    camWidth = cameraViewport.width;
    camHeight = cameraViewport.height;
  } else if (state.options.cameraX !== undefined && state.options.cameraY !== undefined) {
    // Fallback to deprecated cameraX/cameraY
    camLeft = state.options.cameraX;
    camTop = state.options.cameraY;
    camWidth = CAMERA_VIEW_TILES_X;
    camHeight = CAMERA_VIEW_TILES_Y;
  } else {
    // No camera position specified
    camLeft = camTop = camWidth = camHeight = 0;
  }
  
  if (camWidth > 0 && camHeight > 0) {
    drawCameraView(ctx, camLeft, camTop, camWidth, camHeight);
    
    // Draw player marker at center of camera view
    const playerX = camLeft + Math.floor(camWidth / 2);
    const playerY = camTop + Math.floor(camHeight / 2);
    drawPlayerMarker(ctx, playerX, playerY);
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/** Handle canvas click for navigation */
function handleClick(
  state: MinimapState, 
  event: { clientX: number; clientY: number }
): void {
  const rect = state.canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;
  
  const tileX = Math.floor(clickX / TILE_SCALE);
  const tileY = Math.floor(clickY / TILE_SCALE);
  
  // Clamp to map bounds
  const clampedX = Math.max(0, Math.min(tileX, (state.world?.width ?? 1) - 1));
  const clampedY = Math.max(0, Math.min(tileY, (state.world?.height ?? 1) - 1));
  
  if (state.options.onNavigate && state.world) {
    state.options.onNavigate(clampedX, clampedY);
  }
}

/** Handle canvas drag for navigation */
function handleDrag(
  state: MinimapState, 
  event: { clientX: number, clientY: number }
): void {
  if (!dragState.isDragging) return;
  handleClick(state, event);
}

// ============================================================================
// Public API
// ============================================================================

interface DragState {
  isDragging: boolean;
  lastX: number;
  lastY: number;
}

const dragState: DragState = {
  isDragging: false,
  lastX: 0,
  lastY: 0,
};

/**
 * Mount minimap to a container element
 * @param container - Parent DOM element to attach minimap
 * @param options - Minimap configuration options
 * @returns Object with update and destroy methods
 */
export function mountMinimap(
  container: { ownerDocument: Document; appendChild: (child: Node) => void },
  options: MinimapOptions = {}
): {
  update: (world: WorldState) => void;
  destroy: () => void;
  setVisible: (visible: boolean) => void;
} {
  const doc = container.ownerDocument;
  
  // Create container wrapper
  const minimapContainer = doc.createElement("div");
  minimapContainer.className = "minimap-container";
  
  // Create canvas
  const canvas = doc.createElement("canvas") as HTMLCanvasElement;
  canvas.width = MINIMAP_SIZE;
  canvas.height = MINIMAP_SIZE;
  canvas.className = "minimap-canvas";
  
  // Create toggle button
  const toggleButton = doc.createElement("button") as HTMLButtonElement;
  toggleButton.className = "minimap-toggle-btn";
  toggleButton.textContent = "Minimap";
  
  // Assemble container
  const headerDiv = doc.createElement("div");
  headerDiv.className = "minimap-header";
  headerDiv.appendChild(toggleButton);
  
  minimapContainer.appendChild(headerDiv);
  minimapContainer.appendChild(canvas);
  container.appendChild(minimapContainer);
  
  // Initial visibility state
  let isVisible = options.visible ?? true;
  minimapContainer.style.display = isVisible ? "block" : "none";
  
  // Setup event handlers
  let isMouseDown = false;
  
  const handleMouseDown = (event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (mouseEvent.target === canvas && currentMinimap) {
      isMouseDown = true;
      dragState.isDragging = true;
      dragState.lastX = mouseEvent.clientX;
      dragState.lastY = mouseEvent.clientY;
      handleClick(currentMinimap, mouseEvent);
    }
  };
  
  const handleMouseUp = () => {
    isMouseDown = false;
    dragState.isDragging = false;
  };
  
  const handleMouseMove = (event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (isMouseDown && mouseEvent.target === canvas && currentMinimap) {
      handleDrag(currentMinimap, mouseEvent);
    }
  };
  
  canvas.addEventListener("mousedown", handleMouseDown);
  
  // Only add global event listeners if window is available (browser environment)
  if (typeof window !== "undefined") {
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
  }
  
  // Toggle button handler - only hide/show canvas, not the entire container
  const handleToggle = () => {
    isVisible = !isVisible;
    canvas.style.display = isVisible ? "block" : "none";
  };
  toggleButton.addEventListener("click", handleToggle);
  
  // Store state
  currentMinimap = {
    canvas,
    container,
    toggleButton,
    options,
    world: null,
    isVisible,
  };
  
  return {
    /** Update minimap with new world state and optional camera viewport */
    update(world: WorldState, cameraViewport?: CameraViewport): void {
      if (!currentMinimap) return;
      currentMinimap.world = world;
      renderMinimap(currentMinimap, cameraViewport);
    },
    
    /** Destroy minimap and clean up event listeners */
    destroy(): void {
      canvas.removeEventListener("mousedown", handleMouseDown);
      
      // Only remove global event listeners if window is available
      if (typeof window !== "undefined") {
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("mousemove", handleMouseMove);
      }
      
      toggleButton.removeEventListener("click", handleToggle);
      minimapContainer.remove();
      currentMinimap = null;
    },
    
    /** Set minimap visibility */
    setVisible(visible: boolean): void {
      isVisible = visible;
      canvas.style.display = visible ? "block" : "none";
    },
  };
}

/** Get current minimap instance */
export function getMinimap(): MinimapState | null {
  return currentMinimap;
}
