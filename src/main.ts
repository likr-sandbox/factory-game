// Main game entry point - connects simulation, UI, and Phaser rendering
import "./style.css";
import * as Phaser from "phaser";
import { createWorld } from "./sim/world";
import type { WorldState } from "./sim/types";
import { stepTick } from "./sim/engine";
import { createPhaserConfig } from "./game/config";
import { FactoryScene } from "./game/FactoryScene";
import { createInputState, type InputState, repairBuilding, applyRecipe } from "./game/input";
import { mountHud, type HudHandle } from "./ui/hud";
import { mountPaletteBar, type PaletteBarHandle } from "./ui/paletteBar";
import { createInspector, type InspectorHandle } from "./ui/inspector";

// Base tick interval in milliseconds (60 FPS target)
export const BASE_TICK_INTERVAL_MS = 1000 / 60;

// Simulation speed multiplier (default 1x)
let simulationSpeed: number = 1;

// Tick accumulator for fixed-tick simulation
let tickAccumulatorMs: number = 0;

// Active world instance
let activeWorld: WorldState = createWorld();

// Scene instance for sync
let scene: FactoryScene | null = null;

// UI handles
let hud: HudHandle | null = null;
let paletteBar: PaletteBarHandle | null = null;
let inspector: InspectorHandle | null = null;

// Input state
let inputState: InputState = createInputState();

/**
 * Set simulation speed multiplier
 * @param speed - Speed multiplier (0 = paused, 1 = normal, 2 = 2x, etc.)
 */
export function setSimulationSpeed(speed: number): void {
  simulationSpeed = speed;
}

/**
 * Get current simulation speed multiplier
 * @returns Current speed multiplier
 */
export function getSimulationSpeed(): number {
  return simulationSpeed;
}

/**
 * Get current tick accumulator value in milliseconds
 * @returns Accumulated time in ms
 */
export function getTickAccumulatorMs(): number {
  return tickAccumulatorMs;
}

/**
 * Reset simulation state to initial world
 * @param world - Optional world state to reset to (defaults to new world)
 */
export function resetSimulationState(world?: WorldState): void {
  activeWorld = world ?? createWorld();
  tickAccumulatorMs = 0;
  simulationSpeed = 1;
}

/**
 * Process simulation ticks based on elapsed time
 * @param deltaTimeMs - Elapsed time in milliseconds since last frame
 * @returns Number of ticks executed
 */
export function processSimulationTicks(deltaTimeMs: number): number {
  if (simulationSpeed <= 0) {
    tickAccumulatorMs = 0;
    return 0;
  }

  tickAccumulatorMs += deltaTimeMs * simulationSpeed;

  let executedTicks = 0;
  while (tickAccumulatorMs >= BASE_TICK_INTERVAL_MS) {
    stepTick(activeWorld);
    tickAccumulatorMs -= BASE_TICK_INTERVAL_MS;
    executedTicks++;
  }

  return executedTicks;
}

/**
 * Initialize the game - creates DOM elements and starts Phaser game
 * @param doc - Optional document object (uses global document if not provided)
 */
export function initGame(doc: Document = globalThis.document as Document): void {
  if (!doc) {
    throw new Error("Document is required for game initialization");
  }

  // Validate required DOM containers
  const gameContainer = doc.getElementById("game-container");
  const hudContainer = doc.getElementById("hud-container");
  const paletteContainer = doc.getElementById("palette-container");

  if (!gameContainer) {
    throw new Error("Required DOM element #game-container not found");
  }
  if (!hudContainer) {
    throw new Error("Required DOM element #hud-container not found");
  }
  if (!paletteContainer) {
    throw new Error("Required DOM element #palette-container not found");
  }

  // Create inspector container within palette container
  const inspectorContainer = doc.createElement("div");
  inspectorContainer.id = "inspector-container";
  inspectorContainer.style.cssText = "flex:1;display:flex;align-items:center;justify-content:flex-end;";
  paletteContainer.appendChild(inspectorContainer);

  // Create scene instance (shared between main loop and Phaser)
  scene = new FactoryScene();
  
  // Bind the active world and input state to the scene
  scene.setContext(activeWorld, inputState);

  // Mount UI components
  hud = mountHud(hudContainer, {
    onSpeedChange: (speed) => setSimulationSpeed(speed),
    onPausedToggle: (paused) => setSimulationSpeed(paused ? 0 : 1),
  });

  paletteBar = mountPaletteBar(paletteContainer, {
    onBuildingSelect: (building) => {
      inputState.selectedBuilding = building;
      inputState.mode = "place";
    },
    onRotate: () => {
      inputState.direction = rotateDirection(inputState.direction);
    },
    onDemolish: () => {
      inputState.mode = "demolish";
    },
    onInspectToggle: () => {
      inputState.mode = inputState.mode === "inspect" ? "place" : "inspect";
    },
  });

  inspector = createInspector(inspectorContainer, {
    onRepair: (x, y) => {
      repairBuilding(activeWorld, x, y);
      // Scene will be updated in next frame via syncWorld
    },
    onSetRecipe: (x, y, recipeId) => {
      applyRecipe(activeWorld, x, y, recipeId);
      // Scene will be updated in next frame via syncWorld
    },
  });

  // Create Phaser game instance
  const phaserGame = new Phaser.Game(createPhaserConfig("game-container", scene));

  // Start animation loop
  let lastTimestamp: number = performance.now();

  function gameLoop(timestamp: number): void {
    const deltaTimeMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Process simulation ticks
    processSimulationTicks(deltaTimeMs);

    // Update UI and rendering
    if (scene) {
      scene.syncWorld(activeWorld);
    }
    if (hud) {
      hud.update(activeWorld);
    }
    if (paletteBar) {
      paletteBar.sync(activeWorld, inputState);
    }
    if (inspector) {
      inspector.update(activeWorld, inputState.inspectedCoord);
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

/**
 * Helper to rotate direction clockwise
 */
function rotateDirection(dir: "N" | "E" | "S" | "W"): "N" | "E" | "S" | "W" {
  switch (dir) {
    case "N": return "E";
    case "E": return "S";
    case "S": return "W";
    case "W": return "N";
  }
}

// Auto-initialize if running in browser environment with required containers
if (typeof globalThis.document !== "undefined" && globalThis.document.getElementById("game-container")) {
  initGame(globalThis.document as Document);
}
