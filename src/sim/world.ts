// Deterministic 64x64 world generator for Agentcraft simulation

export const WORLD_SIZE = 64;
export const HUB_ORIGIN = { x: 31, y: 31 };

import type { WorldState, Tile, ResourceDeposit, BuildingState, Direction } from "./types";

export function nextRandom(state: number): { value: number; nextState: number } {
  let t = (state += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState: t };
}

export function createRng(seed: number): () => number {
  let state = seed || 123456789;
  return () => {
    const { value, nextState } = nextRandom(state);
    state = nextState;
    return value;
  };
}

export function inBounds(world: WorldState, x: number, y: number): boolean {
  return x >= 0 && x < world.width && y >= 0 && y < world.height;
}

export function getTile(world: WorldState, x: number, y: number): Tile | null {
  if (!inBounds(world, x, y)) return null;
  return world.tiles[y]![x]!;
}

export function directionDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case "N": return { dx: 0, dy: -1 };
    case "E": return { dx: 1, dy: 0 };
    case "S": return { dx: 0, dy: 1 };
    case "W": return { dx: -1, dy: 0 };
  }
}

export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case "N": return "S";
    case "E": return "W";
    case "S": return "N";
    case "W": return "E";
  }
}

export function isHubTile(world: WorldState, x: number, y: number): boolean {
  const ox = HUB_ORIGIN.x, oy = HUB_ORIGIN.y;
  return (x === ox || x === ox + 1) && (y === oy || y === oy + 1);
}

const HUB_SAFE_RADIUS = 4;
const RESOURCE_TYPES: ("iron_ore" | "copper_ore" | "coal" | "silica_sand")[] = ["iron_ore", "copper_ore", "coal", "silica_sand"];

function isInHubSafeZone(x: number, y: number): boolean {
  const dx = Math.abs(x - HUB_ORIGIN.x - 0.5);
  const dy = Math.abs(y - HUB_ORIGIN.y - 0.5);
  return dx <= HUB_SAFE_RADIUS && dy <= HUB_SAFE_RADIUS;
}

type Pos = { x: number; y: number };

function placeCluster(
  tiles: Tile[][],
  rng: () => number,
  centerX: number,
  centerY: number,
  clusterSize: number,
  deposit: ResourceDeposit
): void {
  const placed = new Set<string>();
  const positions: Pos[] = [{ x: centerX, y: centerY }];
  placed.add(`${centerX},${centerY}`);

  for (let i = 0; i < clusterSize; i++) {
    if (positions.length === 0) break;
    const idx = Math.floor(rng() * positions.length);
    const pos = positions.splice(idx, 1)[0]!;

    const neighbors: Pos[] = [];
    if (pos.x + 1 < WORLD_SIZE) neighbors.push({ x: pos.x + 1, y: pos.y });
    if (pos.x - 1 >= 0) neighbors.push({ x: pos.x - 1, y: pos.y });
    if (pos.y + 1 < WORLD_SIZE) neighbors.push({ x: pos.x, y: pos.y + 1 });
    if (pos.y - 1 >= 0) neighbors.push({ x: pos.x, y: pos.y - 1 });

    for (const n of neighbors) {
      if (placed.has(`${n.x},${n.y}`)) continue;
      if (isInHubSafeZone(n.x, n.y)) continue;
      const tile = tiles[n.y]![n.x]!;
      if (tile.terrain !== "grass") continue;

      tile.deposit = { ...deposit };
      placed.add(`${n.x},${n.y}`);
      positions.push(n);
      if (placed.size >= clusterSize) break;
    }
  }
}

function generateTerrain(tiles: Tile[][], rng: () => number): void {
  for (let y = 0; y < WORLD_SIZE; y++) {
    tiles[y] = [];
    for (let x = 0; x < WORLD_SIZE; x++) {
      tiles[y]![x] = {
        x,
        y,
        terrain: "grass",
        deposit: null,
        buildingId: null,
      };
    }
  }

  // Generate rock clusters (away from hub)
  const rockClusters = 8 + Math.floor(rng() * 4);
  for (let i = 0; i < rockClusters; i++) {
    let cx: number, cy: number;
    do {
      cx = Math.floor(rng() * WORLD_SIZE);
      cy = Math.floor(rng() * WORLD_SIZE);
    } while (isInHubSafeZone(cx, cy));

    const clusterSize = 5 + Math.floor(rng() * 10);
    const positions: Pos[] = [{ x: cx, y: cy }];
    const placed = new Set<string>([`${cx},${cy}`]);
    tiles[cy]![cx]!.terrain = "rock";

    for (let j = 0; j < clusterSize && positions.length > 0; j++) {
      const idx = Math.floor(rng() * positions.length);
      const pos = positions.splice(idx, 1)[0]!;
      const neighbors: Pos[] = [];
      if (pos.x + 1 < WORLD_SIZE) neighbors.push({ x: pos.x + 1, y: pos.y });
      if (pos.x - 1 >= 0) neighbors.push({ x: pos.x - 1, y: pos.y });
      if (pos.y + 1 < WORLD_SIZE) neighbors.push({ x: pos.x, y: pos.y + 1 });
      if (pos.y - 1 >= 0) neighbors.push({ x: pos.x, y: pos.y - 1 });

      for (const n of neighbors) {
        if (placed.has(`${n.x},${n.y}`)) continue;
        if (isInHubSafeZone(n.x, n.y)) continue;
        const tile = tiles[n.y]![n.x]!;
        if (tile.terrain !== "grass") continue;

        tile.terrain = "rock";
        placed.add(`${n.x},${n.y}`);
        positions.push(n);
      }
    }
  }

  // Generate water pools (away from hub)
  const waterPools = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < waterPools; i++) {
    let cx: number, cy: number;
    do {
      cx = Math.floor(rng() * WORLD_SIZE);
      cy = Math.floor(rng() * WORLD_SIZE);
    } while (isInHubSafeZone(cx, cy));

    const poolSize = 4 + Math.floor(rng() * 8);
    const positions: Pos[] = [{ x: cx, y: cy }];
    const placed = new Set<string>([`${cx},${cy}`]);
    tiles[cy]![cx]!.terrain = "water";

    for (let j = 0; j < poolSize && positions.length > 0; j++) {
      const idx = Math.floor(rng() * positions.length);
      const pos = positions.splice(idx, 1)[0]!;
      const neighbors: Pos[] = [];
      if (pos.x + 1 < WORLD_SIZE) neighbors.push({ x: pos.x + 1, y: pos.y });
      if (pos.x - 1 >= 0) neighbors.push({ x: pos.x - 1, y: pos.y });
      if (pos.y + 1 < WORLD_SIZE) neighbors.push({ x: pos.x, y: pos.y + 1 });
      if (pos.y - 1 >= 0) neighbors.push({ x: pos.x, y: pos.y - 1 });

      for (const n of neighbors) {
        if (placed.has(`${n.x},${n.y}`)) continue;
        if (isInHubSafeZone(n.x, n.y)) continue;
        const tile = tiles[n.y]![n.x]!;
        if (tile.terrain !== "grass") continue;

        tile.terrain = "water";
        placed.add(`${n.x},${n.y}`);
        positions.push(n);
      }
    }
  }
}

function placeResourceDeposits(tiles: Tile[][], rng: () => number): void {
  const usedPositions = new Set<string>();

  for (const material of RESOURCE_TYPES) {
    const numClusters = 3 + Math.floor(rng() * 3);
    const attemptsPerCluster = 50;

    for (let c = 0; c < numClusters; c++) {
      let placed = false;
      for (let attempt = 0; attempt < attemptsPerCluster && !placed; attempt++) {
        const cx = Math.floor(rng() * WORLD_SIZE);
        const cy = Math.floor(rng() * WORLD_SIZE);

        if (isInHubSafeZone(cx, cy)) continue;
        const tile = tiles[cy]![cx]!;
        if (tile.terrain !== "grass") continue;
        if (usedPositions.has(`${cx},${cy}`)) continue;

        const amount = 500 + Math.floor(rng() * 2000);
        const deposit: ResourceDeposit = {
          material,
          remaining: amount,
          initialAmount: amount,
        };

        const clusterSize = 3 + Math.floor(rng() * 5);
        placeCluster(tiles, rng, cx, cy, clusterSize, deposit);

        for (let y = Math.max(0, cy - 2); y <= Math.min(WORLD_SIZE - 1, cy + 2); y++) {
          for (let x = Math.max(0, cx - 2); x <= Math.min(WORLD_SIZE - 1, cx + 2); x++) {
            const t = tiles[y]![x]!;
            if (t.deposit?.material === material) {
              usedPositions.add(`${x},${y}`);
            }
          }
        }
        placed = true;
      }
    }
  }
}

function ensureReachableResources(tiles: Tile[][], rng: () => number): void {
  const maxDistance = 20;
  for (const material of RESOURCE_TYPES) {
    let hasReachable = false;
    for (let y = HUB_ORIGIN.y - maxDistance; y <= HUB_ORIGIN.y + maxDistance && !hasReachable; y++) {
      for (let x = HUB_ORIGIN.x - maxDistance; x <= HUB_ORIGIN.x + maxDistance && !hasReachable; x++) {
        if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) continue;
        const tile = tiles[y]![x]!;
        if (tile.deposit?.material === material) {
          hasReachable = true;
        }
      }
    }

    if (!hasReachable) {
      const attempts = 100;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const angle = rng() * Math.PI * 2;
        const dist = 8 + rng() * 12;
        const cx = Math.round(HUB_ORIGIN.x + Math.cos(angle) * dist);
        const cy = Math.round(HUB_ORIGIN.y + Math.sin(angle) * dist);

        if (cx < 0 || cx >= WORLD_SIZE || cy < 0 || cy >= WORLD_SIZE) continue;
        if (isInHubSafeZone(cx, cy)) continue;
        const tile = tiles[cy]![cx]!;
        if (tile.terrain !== "grass") continue;

        const amount = 800 + Math.floor(rng() * 1500);
        const deposit: ResourceDeposit = {
          material,
          remaining: amount,
          initialAmount: amount,
        };
        const clusterSize = 3 + Math.floor(rng() * 4);
        placeCluster(tiles, rng, cx, cy, clusterSize, deposit);
        break;
      }
    }
  }
}

function createHubBuilding(tiles: Tile[][]): BuildingState {
  const hub: BuildingState = {
    id: "hub",
    type: "hub",
    x: HUB_ORIGIN.x,
    y: HUB_ORIGIN.y,
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

  const hubCoords: Pos[] = [
    { x: HUB_ORIGIN.x, y: HUB_ORIGIN.y },
    { x: HUB_ORIGIN.x + 1, y: HUB_ORIGIN.y },
    { x: HUB_ORIGIN.x, y: HUB_ORIGIN.y + 1 },
    { x: HUB_ORIGIN.x + 1, y: HUB_ORIGIN.y + 1 },
  ];

  for (const coord of hubCoords) {
    const tile = tiles[coord.y]![coord.x]!;
    tile.terrain = "grass";
    tile.deposit = null;
    tile.buildingId = "hub";
  }

  return hub;
}

export function createWorld(seed: number = 12345): WorldState {
  const rng = createRng(seed);
  const tiles: Tile[][] = [];

  // Initialize empty array first
  for (let y = 0; y < WORLD_SIZE; y++) {
    tiles[y] = [];
  }

  generateTerrain(tiles, rng);
  placeResourceDeposits(tiles, rng);
  ensureReachableResources(tiles, rng);
  const hubBuilding = createHubBuilding(tiles);

  const buildings: Record<string, BuildingState> = { hub: hubBuilding };

  return {
    seed,
    width: WORLD_SIZE,
    height: WORLD_SIZE,
    tick: 0,
    rngState: seed,
    tiles,
    buildings,
    nextBuildingId: 1,
    hubOrigin: HUB_ORIGIN,
    delivered: {},
    deliveryHistory: [],
    unlockedTechs: [],
    completedQuests: [],
    // Progression fields
    researchPoints: 0,
    // Tutorial fields
    tutorialPhase: 1,
    completedTutorialSteps: [],
    // Dynamic quest fields
    activeQuests: [],
    nextQuestId: 0,
    // SPM (Science Per Minute) tracking
    spm: {},
  };
}
