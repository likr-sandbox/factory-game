// Tiered resource distribution and starter reachability for world generation

import type { WorldState, Tile, ResourceDeposit } from "./types";

const HUB_SAFE_RADIUS = 4;

function isInHubSafeZone(x: number, y: number): boolean {
  const dx = Math.abs(x - 31.5);
  const dy = Math.abs(y - 31.5);
  return dx <= HUB_SAFE_RADIUS && dy <= HUB_SAFE_RADIUS;
}

function euclideanDistance(x: number, y: number): number {
  const dx = x - 31.5;
  const dy = y - 31.5;
  return Math.sqrt(dx * dx + dy * dy);
}

type Pos = { x: number; y: number };

function getHubPerimeterWalkableTiles(world: WorldState): Pos[] {
  const perimeter: Pos[] = [];
  const ox = world.hubOrigin.x;
  const oy = world.hubOrigin.y;
  
  // Check tiles around the 2x2 hub (from -1 to +2 offset)
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      const x = ox + dx;
      const y = oy + dy;
      if (x < 0 || x >= world.width || y < 0 || y >= world.height) continue;
      // Skip actual hub tiles
      if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) continue;
      
      const tile = world.tiles[y]![x]!;
      if (tile.terrain === "grass" && tile.deposit === null) {
        perimeter.push({ x, y });
      }
    }
  }
  
  return perimeter;
}

function bfsFindPath(
  world: WorldState,
  startPositions: Pos[],
  targetPositions: Pos[],
  maxSteps: number = 100
): Pos[] | null {
  const visited = new Set<string>();
  const queue: { pos: Pos; path: Pos[] }[] = [];
  const targetSet = new Set(targetPositions.map(p => `${p.x},${p.y}`));
  
  for (const pos of startPositions) {
    queue.push({ pos, path: [pos] });
    visited.add(`${pos.x},${pos.y}`);
  }
  
  const isWalkable = (x: number, y: number): boolean => {
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) return false;
    if (isInHubSafeZone(x, y)) return false; // Don't carve through hub zone
    const tile = world.tiles[y]![x]!;
    // Can walk on grass or through deposits (we can carve rock/water)
    return tile.terrain !== "rock" && tile.terrain !== "water";
  };
  
  const steps: Pos[] = [];
  while (queue.length > 0 && steps.length < maxSteps) {
    const { pos, path } = queue.shift()!;
    
    if (targetSet.has(`${pos.x},${pos.y}`)) {
      return path;
    }
    
    const neighbors: Pos[] = [
      { x: pos.x + 1, y: pos.y },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x, y: pos.y - 1 },
    ];
    
    for (const n of neighbors) {
      const key = `${n.x},${n.y}`;
      if (visited.has(key)) continue;
      if (!isWalkable(n.x, n.y)) continue;
      
      visited.add(key);
      queue.push({ pos: n, path: [...path, n] });
    }
  }
  
  return null;
}

function findBlockingTilesOnPath(world: WorldState, path: Pos[]): Pos[] {
  const blocking: Pos[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const curr = path[i]!;
    const next = path[i + 1]!;
    
    // Check tiles between curr and next for obstacles
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    
    if (dx !== 0) {
      // Horizontal step
      const stepX = dx > 0 ? 1 : -1;
      for (let x = curr.x + stepX; x !== next.x; x += stepX) {
        const tile = world.tiles[curr.y]![x]!;
        if ((tile.terrain === "rock" || tile.terrain === "water") && !tile.deposit) {
          blocking.push({ x, y: curr.y });
        }
      }
    } else if (dy !== 0) {
      // Vertical step
      const stepY = dy > 0 ? 1 : -1;
      for (let y = curr.y + stepY; y !== next.y; y += stepY) {
        const tile = world.tiles[y]![curr.x]!;
        if ((tile.terrain === "rock" || tile.terrain === "water") && !tile.deposit) {
          blocking.push({ x: curr.x, y });
        }
      }
    }
  }
  
  return blocking;
}

function carveGrassPath(world: WorldState, path: Pos[]): void {
  for (const pos of path) {
    const tile = world.tiles[pos.y]![pos.x]!;
    // Only convert non-hub rock/water without deposits
    if (!isInHubSafeZone(pos.x, pos.y) && 
        !tile.deposit && 
        (tile.terrain === "rock" || tile.terrain === "water")) {
      tile.terrain = "grass";
    }
  }
}

function placeCluster(
  tiles: Tile[][],
  rng: () => number,
  centerX: number,
  centerY: number,
  minSize: number,
  maxSize: number,
  deposit: ResourceDeposit,
  allowCarving: boolean = false
): number {
  const clusterSize = minSize + Math.floor(rng() * (maxSize - minSize + 1));
  const placed = new Set<string>();
  const positions: Pos[] = [{ x: centerX, y: centerY }];
  placed.add(`${centerX},${centerY}`);
  
  // Set deposit on center tile
  const centerTile = tiles[centerY]![centerX]!;
  if (!centerTile.deposit) {
    centerTile.deposit = { ...deposit };
  }
  
  let actualSize = 1;
  
  for (let i = 0; i < clusterSize && positions.length > 0; i++) {
    const idx = Math.floor(rng() * positions.length);
    const pos = positions.splice(idx, 1)[0]!;
    
    const neighbors: Pos[] = [
      { x: pos.x + 1, y: pos.y },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x, y: pos.y - 1 },
    ];
    
    for (const n of neighbors) {
      if (n.x < 0 || n.x >= 64 || n.y < 0 || n.y >= 64) continue;
      if (placed.has(`${n.x},${n.y}`)) continue;
      if (isInHubSafeZone(n.x, n.y)) continue;
      
      const tile = tiles[n.y]![n.x]!;
      
      // For starter clusters, we may need to carve rock/water
      if (tile.terrain !== "grass") {
        if (allowCarving && !tile.deposit && (tile.terrain === "rock" || tile.terrain === "water")) {
          tile.terrain = "grass";
        } else {
          continue;
        }
      }
      
      tile.deposit = { ...deposit };
      placed.add(`${n.x},${n.y}`);
      positions.push(n);
      actualSize++;
      
      if (actualSize >= clusterSize) break;
    }
    
    if (actualSize >= clusterSize) break;
  }
  
  return actualSize;
}

function findClusterPositions(world: WorldState, material: string, ringMin: number, ringMax: number): Pos[] {
  const positions: Pos[] = [];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (isInHubSafeZone(x, y)) continue;
      const dist = euclideanDistance(x, y);
      if (dist >= ringMin && dist < ringMax) {
        const tile = world.tiles[y]![x]!;
        if (tile.deposit?.material === material) {
          positions.push({ x, y });
        }
      }
    }
  }
  return positions;
}

function ensureStarterReachability(world: WorldState, rng: () => number): void {
  const requiredResources = ["iron_ore", "copper_ore"];
  
  for (const material of requiredResources) {
    const starterClusters = findClusterPositions(world, material, 5.5, 9.5);
    if (starterClusters.length === 0) continue;
    
    const hubPerimeter = getHubPerimeterWalkableTiles(world);
    if (hubPerimeter.length === 0) continue;
    
    // Check if any starter cluster is reachable
    let allReachable = true;
    for (const clusterPos of starterClusters) {
      const path = bfsFindPath(world, hubPerimeter, [clusterPos], 200);
      if (!path) {
        allReachable = false;
        
        // Try to carve a path
        const alternativePath = bfsFindPath(world, hubPerimeter, [clusterPos], 300);
        if (alternativePath) {
          carveGrassPath(world, alternativePath);
        }
        break;
      }
    }
    
    // If still unreachable after carving, try placing a new reachable cluster
    if (!allReachable) {
      // Find a position near the hub ring that's accessible
      for (let attempt = 0; attempt < 20; attempt++) {
        const angle = rng() * Math.PI * 2;
        const dist = 6 + rng() * 3; // Within 5.5-9.5 range
        const cx = Math.round(31.5 + Math.cos(angle) * dist);
        const cy = Math.round(31.5 + Math.sin(angle) * dist);
        
        if (cx < 0 || cx >= 64 || cy < 0 || cy >= 64) continue;
        if (isInHubSafeZone(cx, cy)) continue;
        
        const tile = world.tiles[cy]![cx]!;
        if (tile.deposit) continue;
        
        // Check if this position is reachable
        const hubPerimeter = getHubPerimeterWalkableTiles(world);
        const path = bfsFindPath(world, hubPerimeter, [{ x: cx, y: cy }], 100);
        if (!path) continue;
        
        // Place the cluster
        const amount = 400 + Math.floor(rng() * 301); // 400-700
        const deposit: ResourceDeposit = {
          material: material as "iron_ore" | "copper_ore",
          remaining: amount,
          initialAmount: amount,
        };
        
        placeCluster(world.tiles, rng, cx, cy, 4, 6, deposit, true);
        break;
      }
    }
  }
}

export function generateTieredResources(world: WorldState, rng: () => number): void {
  // Near-hub starter ring (5.5 to 9.5): guaranteed iron_ore and copper_ore
  const starterRingMin = 5.5;
  const starterRingMax = 9.5;
  
  // Mid-distance ring (10 to 18): guaranteed coal and silica_sand
  const midRingMin = 10;
  const midRingMax = 18;
  
  // Outer area (18 to 29): large clusters of all types
  const outerMin = 18;
  const outerMax = 29;
  
  // Helper to find empty position in a ring
  function findEmptyPosition(minDist: number, maxDist: number, excludeMaterial?: "iron_ore" | "copper_ore" | "coal" | "silica_sand"): Pos | null {
    const attempts = 200;
    for (let i = 0; i < attempts; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = minDist + rng() * (maxDist - minDist);
      const x = Math.round(31.5 + Math.cos(angle) * dist);
      const y = Math.round(31.5 + Math.sin(angle) * dist);
      
      if (x < 0 || x >= 64 || y < 0 || y >= 64) continue;
      if (isInHubSafeZone(x, y)) continue;
      
      const tile = world.tiles[y]![x]!;
      if (tile.terrain !== "grass") continue;
      if (excludeMaterial && tile.deposit?.material === excludeMaterial) continue;
      
      return { x, y };
    }
    return null;
  }
  
  // Place guaranteed starter clusters (iron_ore and copper_ore in 5.5-9.5)
  for (const material of ["iron_ore", "copper_ore"] as const) {
    const pos = findEmptyPosition(starterRingMin, starterRingMax);
    if (!pos) continue;
    
    const amount = 400 + Math.floor(rng() * 301); // 400-700
    const deposit: ResourceDeposit = {
      material: material as "iron_ore" | "copper_ore",
      remaining: amount,
      initialAmount: amount,
    };
    
    placeCluster(world.tiles, rng, pos.x, pos.y, 4, 6, deposit, true);
  }
  
  // Place guaranteed mid-distance clusters (coal and silica_sand in 10-18)
  for (const material of ["coal", "silica_sand"] as const) {
    const pos = findEmptyPosition(midRingMin, midRingMax);
    if (!pos) continue;
    
    const amount = 600 + Math.floor(rng() * 601); // 600-1200
    const deposit: ResourceDeposit = {
      material: material as "coal" | "silica_sand",
      remaining: amount,
      initialAmount: amount,
    };
    
    placeCluster(world.tiles, rng, pos.x, pos.y, 4, 6, deposit);
  }
  
  // Place outer clusters (6-10 tiles, 1500-3500 amount) for all 4 types
  for (const material of ["iron_ore", "copper_ore", "coal", "silica_sand"] as const) {
    const pos = findEmptyPosition(outerMin, outerMax, material);
    if (!pos) continue;
    
    const amount = 1500 + Math.floor(rng() * 2001); // 1500-3500
    const deposit: ResourceDeposit = {
      material: material,
      remaining: amount,
      initialAmount: amount,
    };
    
    placeCluster(world.tiles, rng, pos.x, pos.y, 6, 10, deposit);
  }
  
  // Ensure starter resources are reachable
  ensureStarterReachability(world, rng);
}
