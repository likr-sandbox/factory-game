// Status rendering helpers: animation frames, belt item layout, status overlays
import type { BuildingState, WorldState, Direction } from "../sim/types";
import { RECIPE_CATALOG } from "../sim/catalog";
import { getMaterialColor, UI_PALETTE } from "./palette";

export interface Graphics {
  clear(): void; setAlpha(a: number): void; fillRect(x: number, y: number, w: number, h: number): void;
  fillCircle(x: number, y: number, r: number): void; fillStyle(color: number, alpha?: number): void;
  setPosition(x: number, y: number): void; setDepth(depth: number): void; destroy(): void;
}
export interface Scene<T extends Graphics = Graphics> { add: { graphics(): T }; }

/** Calculate animation frame (0|1) for a building based on type and world state. */
export function getBuildingAnimationFrame(building: BuildingState, world: WorldState): 0 | 1 {
  if (building.faulted) return 0;
  const tick = world.tick;
  switch (building.type) {
    case "belt": case "underground_belt": return (Math.floor(tick / 6) % 2) as 0 | 1;
    case "miner": {
      const hasDeposit = world.tiles[building.y]?.[building.x]?.deposit?.remaining ?? 0;
      return hasDeposit > 0 ? (Math.floor(tick / 8) % 2) as 0 | 1 : 0;
    }
    case "smelter": case "assembler": {
      const isActive = building.recipeId != null && building.craftProgress > 0;
      return isActive ? (Math.floor(tick / 8) % 2) as 0 | 1 : 0;
    }
    case "recycler": case "hub": return (Math.floor(tick / 12) % 2) as 0 | 1;
    default: return 0;
  }
}

/** Compute position and scale for a belt item along the building's direction. */
export function computeBeltItemLayout(building: BuildingState, itemIndex: number, totalItems: number, worldTick: number): { x: number; y: number; scale: number } {
  const centerX = building.x * 32 + 16, centerY = building.y * 32 + 16, scale = 0.58;
  const slotOffsets: Record<Direction, number[]> = { N: [0, -7, -14], S: [0, 7, 14], W: [0, -7, -14], E: [0, 7, 14] };
  const offsets = slotOffsets[building.direction], slotIndex = itemIndex % offsets.length;
  const baseOffset = offsets[slotIndex] ?? 0;
  const movedAtTick = worldTick - itemIndex * 3;
  const progress = Math.min(1, Math.max(0, worldTick - movedAtTick));
  const smoothOffset = progress * 2;
  let offsetX = 0, offsetY = 0;
  switch (building.direction) {
    case "N": offsetY = baseOffset - smoothOffset; break;
    case "S": offsetY = baseOffset + smoothOffset; break;
    case "W": offsetX = baseOffset - smoothOffset; break;
    case "E": offsetX = baseOffset + smoothOffset; break;
  }
  return { x: centerX + offsetX, y: centerY + offsetY, scale };
}

/** Draw fault indicator (red exclamation) in LOCAL coordinates around (0,0). */
export function drawFaultIndicator(graphics: Graphics, isHub: boolean, worldTick: number): void {
  graphics.clear();
  const blink = Math.floor(worldTick / 15) % 2 === 0 ? 1 : 0.45;
  graphics.setAlpha(blink);
  const badgeY = isHub ? -32 : -16;
  graphics.fillStyle(parseInt(UI_PALETTE.fault.hex.slice(1), 16), blink);
  graphics.fillCircle(0, badgeY, 10);
  graphics.fillStyle(0xFFFFFF, 1);
  graphics.fillRect(-2, badgeY - 8, 4, 12);
  graphics.fillRect(-2, badgeY + 4, 4, 4);
}

/** Draw depleted indicator (red X mark) centered at local (0,0). */
export function drawDepletedIndicator(graphics: Graphics): void {
  graphics.clear();
  graphics.fillStyle(parseInt(UI_PALETTE.fault.hex.slice(1), 16), 1);
  graphics.fillCircle(-5, -5, 3); graphics.fillCircle(5, 5, 3);
  graphics.fillCircle(5, -5, 3); graphics.fillCircle(-5, 5, 3);
  graphics.fillCircle(0, 0, 4);
}

/** Sync status overlay Graphics objects using ID-based diffing. */
export function syncBuildingStatusOverlays<T extends Graphics>(scene: Scene<T>, overlays: Map<string, T>, world: WorldState): void {
  const neededIds = new Set<string>();
  for (const building of Object.values(world.buildings)) {
    const needsOverlay =
      ((building.type === "smelter" || building.type === "assembler") && building.recipeId != null && building.craftProgress > 0) ||
      ((building.type === "smelter" || building.type === "assembler") && building.recipeId != null) ||
      (building.type === "filter_splitter" && building.filterMaterial != null) ||
      ((building.blockedTicks ?? 0) >= 30 && !building.faulted);
    if (needsOverlay) {
      neededIds.add(building.id);
      let overlay = overlays.get(building.id);
      if (!overlay) { overlay = scene.add.graphics(); overlays.set(building.id, overlay); }
      renderOverlay(overlay, building, world.tick);
      overlay.setPosition(building.x * 32 + 16, building.y * 32 + 16);
      overlay.setDepth(building.y + 1);
    }
  }
  for (const [id, overlay] of overlays.entries()) {
    if (!neededIds.has(id)) { overlay.destroy(); overlays.delete(id); }
  }
}

function renderOverlay(g: Graphics, b: BuildingState, tick: number): void {
  g.clear();
  if ((b.type === "smelter" || b.type === "assembler") && b.recipeId != null && b.craftProgress > 0) {
    const recipe = RECIPE_CATALOG[b.recipeId], ratio = Math.min(1, b.craftProgress / recipe.craftTicks);
    g.fillStyle(0x333333, 0.7); g.fillRect(-14, 14, 28, 6);
    g.fillStyle(0x00FF00, 1); g.fillRect(-14, 14, 28 * ratio, 6);
  }
  let color: number | null = null;
  if (b.type === "smelter" || b.type === "assembler") {
    if (b.recipeId != null) {
      const outputs = Object.keys(RECIPE_CATALOG[b.recipeId].outputs);
      if (outputs.length > 0) color = parseInt(getMaterialColor(outputs[0] as never).hex.slice(1), 16);
    }
  } else if (b.type === "filter_splitter" && b.filterMaterial != null) {
    color = parseInt(getMaterialColor(b.filterMaterial).hex.slice(1), 16);
  }
  if (color != null) { g.fillStyle(color, 1); g.fillCircle(-16, -20, 5); }
  if ((b.blockedTicks ?? 0) >= 30 && !b.faulted) { g.fillStyle(parseInt(UI_PALETTE.warning.hex.slice(1), 16), 1); g.fillCircle(16, -20, 5); }
}
