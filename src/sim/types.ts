// Core simulation types for Agentcraft headless simulation
// Pure TypeScript - ZERO imports or references to Phaser, window, document

// ============================================================================
// Basic Enums (as union literals)
// ============================================================================

export type Direction = "N" | "E" | "S" | "W";

export type TerrainType = "grass" | "rock" | "water";

// ============================================================================
// Material and Building Types
// ============================================================================

export type MaterialId =
  | "iron_ore"
  | "copper_ore"
  | "coal"
  | "silica_sand"
  | "iron_plate"
  | "copper_plate"
  | "iron_gear"
  | "copper_wire"
  | "steel_plate"
  | "silicon_wafer"
  | "circuit_board"
  | "microchip"
  | "automation_module"
  | "slag";

export type BuildingType =
  | "miner"
  | "belt"
  | "splitter"
  | "filter_splitter"
  | "underground_belt"
  | "smelter"
  | "assembler"
  | "recycler"
  | "sensor"
  | "hub";

export type RecipeId =
  | "iron_plate"
  | "copper_plate"
  | "iron_plate_high"
  | "copper_plate_high"
  | "iron_gear"
  | "copper_wire"
  | "steel_plate"
  | "silicon_wafer"
  | "circuit_board"
  | "microchip"
  | "automation_module";

export type TechId = "filter_splitter" | "underground_belt" | "sensor"
  | "recycler" | "high_efficiency" | "advanced_smelting" | "electronics" | "automation";

// ============================================================================
// Core Data Structures
// ============================================================================

export interface ActiveQuestState {
  questId: string;
  stepIndex: number;
  progress: Record<string, number>;
  startedAtTick: number;
}

export interface TutorialStepDef {
  id: string;
  title: string;
  description: string;
  targetType: "place_building" | "collect_resource" | "deliver_item" | "research_tech";
  targetValue?: string;
  requiredAmount?: number;
}

export interface ResourceDeposit {
  material: MaterialId;
  remaining: number;
  initialAmount: number;
}

export interface BeltItem {
  material: MaterialId;
  movedAtTick: number;
}

export interface BuildingState {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  direction: Direction;
  recipeId?: RecipeId;
  filterMaterial?: MaterialId;
  inputBuffer: Partial<Record<MaterialId, number>>;
  outputBuffer: Partial<Record<MaterialId, number>>;
  beltItems: BeltItem[];
  craftProgress: number;
  roundRobinIndex: number;
  faulted: boolean;
  load: number;
  idleTicks: number;
  blockedTicks: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  deposit: ResourceDeposit | null;
  buildingId: string | null;
}

export interface DeliveryRecord {
  tick: number;
  material: MaterialId;
  amount: number;
}

export interface WorldState {
  seed: number;
  width: number;
  height: number;
  tick: number;
  rngState: number;
  tiles: Tile[][];
  buildings: Record<string, BuildingState>;
  nextBuildingId: number;
  hubOrigin: { x: number; y: number };
  delivered: Partial<Record<MaterialId, number>>;
  deliveryHistory: DeliveryRecord[];
  unlockedTechs: string[];
  completedQuests: string[];
  // Progression fields
  researchPoints?: number;
  // Tutorial fields
  tutorialPhase?: number;
  completedTutorialSteps?: string[];
  // Dynamic quest fields
  activeQuests?: ActiveQuestState[];
  nextQuestId?: number;
  // SPM (Science Per Minute) tracking
  spm?: Partial<Record<string, number>>;
}

// ============================================================================
// Action Types
// ============================================================================

export interface ActionError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ActionResultSuccess {
  success: true;
  worldTick: number;
  buildingId?: string;
  changes?: unknown;
}

export interface ActionResultFailure {
  success: false;
  error: ActionError;
}

export type ActionResult = ActionResultSuccess | ActionResultFailure;

export interface PlaceBuildingInput {
  x: number;
  y: number;
  type: BuildingType;
  direction: Direction;
  recipeId?: RecipeId;
  filterMaterial?: MaterialId;
}

export interface PlaceBeltLineInput {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  cornerFirst?: "x" | "y";
}

export interface RemoveAreaInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SetRecipeInput {
  x: number;
  y: number;
  recipeId?: RecipeId;
  filterMaterial?: MaterialId;
  repair?: boolean;
}

export type BatchActionItem =
  | { kind: "place_building"; input: PlaceBuildingInput }
  | { kind: "place_belt_line"; input: PlaceBeltLineInput }
  | { kind: "remove_area"; input: RemoveAreaInput }
  | { kind: "set_recipe"; input: SetRecipeInput };

export interface BatchActionsInput {
  actions: BatchActionItem[];
  atomic?: boolean;
}
