// Main game entry point - connects simulation, UI, and Phaser rendering
import "./style.css";
import * as Phaser from "phaser";
import { createWorld } from "./sim/world";
import { unlockTechAction } from "./sim/actions";
import { isBuildingUnlocked } from "./sim/progression";
import type { WorldState, ActionResult } from "./sim/types";
import { stepTick } from "./sim/engine";
import { createPhaserConfig } from "./game/config";
import { FactoryScene } from "./game/FactoryScene";
import { mountMinimap } from "./game/minimap";
import { createInputState, type InputState, repairBuilding, applyRecipe } from "./game/input";
import { setRecipe } from "./sim/actions";
import { mountHud, type HudHandle } from "./ui/hud";
import { mountPaletteBar, type PaletteBarHandle } from "./ui/paletteBar";
import { createInspector, type InspectorHandle } from "./ui/inspector";
import { registerFactoryWebMcpTools } from "./webmcp/bridge";
import { mountWebMcpPanel } from "./ui/webmcpPanel";
import type { ModelContextLike, WebMcpHandle } from "./webmcp/types";
import { TICKS_PER_SECOND } from "./sim/constants";

// Base tick interval in milliseconds (60 FPS target)
export const BASE_TICK_INTERVAL_MS = 1000 / TICKS_PER_SECOND;

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
let webmcpHandle: WebMcpHandle | null = null;
let minimapHandle: ReturnType<typeof mountMinimap> | null = null;

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
  const webmcpContainer = doc.getElementById("webmcp-container");
  const minimapContainer = doc.getElementById("minimap-container");

  if (!gameContainer) {
    throw new Error("Required DOM element #game-container not found");
  }
  if (!hudContainer) {
    throw new Error("Required DOM element #hud-container not found");
  }
  if (!paletteContainer) {
    throw new Error("Required DOM element #palette-container not found");
  }
  if (!webmcpContainer) {
    throw new Error("Required DOM element #webmcp-container not found");
  }

  // Create inspector container within palette container (must be done before mountPaletteBar clears contents)
  const inspectorContainer = doc.createElement("div");
  inspectorContainer.id = "inspector-container";
  paletteContainer.appendChild(inspectorContainer);

  // Create dedicated palette bar container inside paletteContainer
  // This prevents mountPaletteBar's innerHTML="" from detaching inspectorContainer
  const paletteBarContainer = doc.createElement("div");
  // Use responsive flex styling: flex:1 1 auto allows growth/shrink without forcing wrapping, align-items/center for proper layout
  paletteBarContainer.style.cssText = "flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;overflow-x:auto;";
  paletteContainer.insertBefore(paletteBarContainer, inspectorContainer);

  // Create scene instance (shared between main loop and Phaser)
  scene = new FactoryScene();
  
  // Bind the active world and input state to the scene
  scene.setContext(activeWorld, inputState);

  // Mount UI components
  hud = mountHud(hudContainer, {
    onSpeedChange: (speed) => setSimulationSpeed(speed),
    onPausedToggle: (paused) => setSimulationSpeed(paused ? 0 : 1),
    onUnlockTech: (techId) => {
      const result = unlockTechAction(activeWorld, techId as "underground_belt" | "filter_splitter" | "high_efficiency" | "sensor" | "recycler" | "advanced_smelting" | "electronics" | "automation");
      if (result.success) {
        scene?.syncWorld(activeWorld);
        hud?.update(activeWorld);
        paletteBar?.sync(activeWorld, inputState);
        inspector?.update(activeWorld, inputState.inspectedCoord);
        paletteBar?.setFeedback(null);
      } else {
        paletteBar?.setFeedback(formatActionErrorJa(result.error.code));
      }
    },
    onResetWorld: (seed) => {
      const newWorld = createWorld(seed);
      resetSimulationState(newWorld);
      scene?.syncWorld(activeWorld);
      hud?.update(activeWorld);
      paletteBar?.sync(activeWorld, inputState);
      inspector?.update(activeWorld, inputState.inspectedCoord);
      minimapHandle?.update(activeWorld, scene?.getCameraViewport());
      scene?.centerCameraOnHub();
    },
  });

  // Mount palette bar into dedicated container (not paletteContainer directly)
  paletteBar = mountPaletteBar(paletteBarContainer, {
    onBuildingSelect: (building) => {
      inputState.selectedBuilding = building;
      inputState.mode = "place";
      // Sync selectedRecipe to building's default unlocked recipe if needed
      if (building === "smelter" && inputState.selectedRecipe !== "iron_plate") {
        inputState.selectedRecipe = "iron_plate";
      } else if (building === "assembler" && inputState.selectedRecipe !== "iron_gear") {
        inputState.selectedRecipe = "iron_gear";
      }
      // Immediately sync and check if building is unlocked using read-only check
      paletteBar?.sync(activeWorld, inputState);
      if (!isBuildingUnlocked(activeWorld, building)) {
        paletteBar?.setFeedback("テック未解放のため配置できません");
      } else {
        paletteBar?.setFeedback(null);
      }
    },
    onRotate: () => {
      inputState.direction = rotateDirection(inputState.direction);
      paletteBar?.sync(activeWorld, inputState);
    },
    onDemolish: () => {
      inputState.mode = "demolish";
      paletteBar?.sync(activeWorld, inputState);
      paletteBar?.setFeedback(null);
    },
    onInspectToggle: () => {
      inputState.mode = inputState.mode === "inspect" ? "place" : "inspect";
      paletteBar?.sync(activeWorld, inputState);
      paletteBar?.setFeedback(null);
      // Also update inspector when entering inspect mode
      if (inputState.mode === "inspect" && inputState.inspectedCoord) {
        inspector?.update(activeWorld, inputState.inspectedCoord);
      }
    },
  });

  inspector = createInspector(inspectorContainer, {
    onRepair: (x, y) => {
      const result = repairBuilding(activeWorld, x, y);
      if (!result.success) {
        paletteBar?.setFeedback(formatActionErrorJa(result.error.code));
      } else {
        paletteBar?.setFeedback(null);
      }
      // Sync all UI components immediately
      scene?.syncWorld(activeWorld);
      hud?.update(activeWorld);
      paletteBar?.sync(activeWorld, inputState);
      inspector?.update(activeWorld, inputState.inspectedCoord);
    },
    onSetRecipe: (x, y, recipeId) => {
      const result = applyRecipe(activeWorld, x, y, recipeId);
      if (!result.success) {
        paletteBar?.setFeedback(formatActionErrorJa(result.error.code));
      } else {
        paletteBar?.setFeedback(null);
      }
      // Sync all UI components immediately
      scene?.syncWorld(activeWorld);
      hud?.update(activeWorld);
      paletteBar?.sync(activeWorld, inputState);
      inspector?.update(activeWorld, inputState.inspectedCoord);
    },
    onSetFilter: (x, y, material) => {
      const result = setRecipe(activeWorld, { x, y, filterMaterial: material ?? undefined });
      if (!result.success) {
        paletteBar?.setFeedback(formatActionErrorJa(result.error.code));
      } else {
        paletteBar?.setFeedback(null);
      }
      scene?.syncWorld(activeWorld);
      hud?.update(activeWorld);
      paletteBar?.sync(activeWorld, inputState);
      inspector?.update(activeWorld, inputState.inspectedCoord);
    },
  });

  // Register WebMCP tools and mount panel
  webmcpHandle = registerFactoryWebMcpTools({
    getWorld: () => activeWorld,
    onWorldMutated: () => {
      scene?.syncWorld(activeWorld);
      hud?.update(activeWorld);
      paletteBar?.sync(activeWorld, inputState);
      inspector?.update(activeWorld, inputState.inspectedCoord);
      minimapHandle?.update(activeWorld, scene?.getCameraViewport());
    },
    env: { document: doc as unknown as { modelContext?: ModelContextLike }, navigator: (globalThis as unknown as { navigator?: { modelContext?: ModelContextLike } }).navigator },
  });

  mountWebMcpPanel(webmcpContainer, webmcpHandle);

  // Mount minimap - create container inside gameContainer if #minimap-container doesn't exist
  let actualMinimapContainer = minimapContainer;
  if (!actualMinimapContainer && gameContainer) {
    actualMinimapContainer = doc.createElement("div");
    actualMinimapContainer.id = "minimap-container";
    gameContainer.appendChild(actualMinimapContainer);
  }
  if (actualMinimapContainer) {
    minimapHandle = mountMinimap(actualMinimapContainer, {
      onNavigate: (tileX, tileY) => {
        // Center camera on the clicked tile
        scene?.centerCameraOnTile(tileX, tileY);
      },
      visible: true,
    });
  }

  // Create Phaser game instance
  const phaserGame = new Phaser.Game(createPhaserConfig("game-container", scene));

  // Sync canvas dimensions to #game-container immediately after creation
  const w = gameContainer.clientWidth;
  const h = gameContainer.clientHeight;
  if (w > 0 && h > 0) {
    phaserGame.scale?.resize(w, h);
    scene.cameras?.main?.setSize?.(w, h);
  }

  // Attach ResizeObserver / window resize listener for responsive canvas resizing
  // Guard for non-browser test environments
  if (typeof globalThis.ResizeObserver !== "undefined" && typeof globalThis.window !== "undefined") {
    const resizeObserver = new globalThis.ResizeObserver(() => {
      const rw = gameContainer.clientWidth;
      const rh = gameContainer.clientHeight;
      if (rw > 0 && rh > 0) {
        phaserGame.scale?.resize(rw, rh);
        scene?.cameras?.main?.setSize?.(rw, rh);
      }
    });
    resizeObserver.observe(gameContainer);

    globalThis.window.addEventListener("resize", () => {
      const rw = gameContainer.clientWidth;
      const rh = gameContainer.clientHeight;
      if (rw > 0 && rh > 0) {
        phaserGame.scale?.resize(rw, rh);
        scene?.cameras?.main?.setSize?.(rw, rh);
      }
    });
  }

  // Perform initial UI sync immediately after mounting
  hud?.update(activeWorld);
  paletteBar?.sync(activeWorld, inputState);
  inspector?.update(activeWorld, inputState.inspectedCoord);

  // Subscribe to scene events so canvas clicks (including 調査 tile selection) update UI
  scene?.events?.on?.("worldMutated", () => {
    hud?.update(activeWorld);
    paletteBar?.sync(activeWorld, inputState);
    inspector?.update(activeWorld, inputState.inspectedCoord);
    minimapHandle?.update(activeWorld, scene?.getCameraViewport());
    paletteBar?.setFeedback(null); // Clear feedback on successful mutation
  });

  // Subscribe to actionFailed events to display error messages
  scene?.events?.on?.("actionFailed", (err: unknown) => {
    const errorCode = (err as { code?: string })?.code;
    paletteBar?.setFeedback(formatActionErrorJa(errorCode));
  });

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
    if (minimapHandle) {
      minimapHandle.update(activeWorld, scene?.getCameraViewport());
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

/**
 * Format action error code to Japanese message
 * @param code - The error code from ActionResult
 * @returns Japanese error message string
 */
export function formatActionErrorJa(code?: string): string {
  switch (code) {
    case "NO_DEPOSIT":
      return "鉱脈がありません";
    case "TECH_LOCKED":
      return "テック未解放のため配置できません";
    case "HUB_PROTECTED":
      return "中枢納品ハブは保護されています";
    case "OCCUPIED":
      return "既に建物が配置されています";
    case "INVALID_TERRAIN":
      return "この地形には配置できません";
    case "OUT_OF_BOUNDS":
      return "範囲外です";
    case "PREREQUISITE_NOT_MET":
      return "前提技術が未解放です";
    case "INSUFFICIENT_POINTS":
      return "研究ポイントが不足しています";
    default:
      return "操作に失敗しました";
  }
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

/**
 * Get the WebMCP handle for inspection/testing
 * @returns The WebMCP handle or null if not initialized
 */
export function getWebMcpHandle(): WebMcpHandle | null {
  return webmcpHandle;
}

// Auto-initialize if running in browser environment with required containers
if (typeof globalThis.document !== "undefined" && globalThis.document.getElementById("game-container") && globalThis.document.getElementById("webmcp-container")) {
  initGame(globalThis.document as Document);
}
