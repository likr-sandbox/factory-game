// Catalog definitions for materials, buildings, recipes, techs, and quests
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { MaterialId, BuildingType, RecipeId } from "./types";

// ============================================================================
// Balance Constants
// ============================================================================

export const MINING_INTERVAL = 60;
export const BELT_MOVE_INTERVAL = 10;
export const MAX_OUTPUT_BUFFER = 10;
export const MIN_INPUT_BUFFER_PER_MATERIAL = 6;
export const INPUT_BUFFER_MULTIPLIER = 3;

// ============================================================================
// Material Catalog
// ============================================================================

export interface MaterialEntry {
  id: MaterialId;
  nameJa: string;
  category: "raw" | "intermediate" | "part" | "electronic" | "final" | "byproduct";
}

export const MATERIAL_CATALOG: Record<MaterialId, MaterialEntry> = {
  iron_ore: { id: "iron_ore", nameJa: "鉄鉱石", category: "raw" },
  copper_ore: { id: "copper_ore", nameJa: "銅鉱石", category: "raw" },
  coal: { id: "coal", nameJa: "石炭", category: "raw" },
  silica_sand: { id: "silica_sand", nameJa: "珪砂", category: "raw" },
  iron_plate: { id: "iron_plate", nameJa: "鉄板", category: "intermediate" },
  copper_plate: { id: "copper_plate", nameJa: "銅板", category: "intermediate" },
  iron_gear: { id: "iron_gear", nameJa: "鉄歯車", category: "part" },
  copper_wire: { id: "copper_wire", nameJa: "銅線", category: "part" },
  steel_plate: { id: "steel_plate", nameJa: "鋼板", category: "intermediate" },
  silicon_wafer: { id: "silicon_wafer", nameJa: "シリコンウェハ", category: "intermediate" },
  circuit_board: { id: "circuit_board", nameJa: "電子基板", category: "electronic" },
  microchip: { id: "microchip", nameJa: "マイクロチップ", category: "electronic" },
  automation_module: { id: "automation_module", nameJa: "自動化モジュール", category: "final" },
  slag: { id: "slag", nameJa: "スラグ", category: "byproduct" },
};

// ============================================================================
// Building Catalog
// ============================================================================

export interface BuildingEntry {
  type: BuildingType;
  nameJa: string;
  width: number;
  height: number;
  unlockedByDefault: boolean;
}

export const BUILDING_CATALOG: Record<BuildingType, BuildingEntry> = {
  miner: { type: "miner", nameJa: "採掘ドリル", width: 1, height: 1, unlockedByDefault: true },
  belt: { type: "belt", nameJa: "コンベアベルト", width: 1, height: 1, unlockedByDefault: true },
  splitter: { type: "splitter", nameJa: "分配機", width: 1, height: 1, unlockedByDefault: true },
  filter_splitter: { type: "filter_splitter", nameJa: "フィルター分配機", width: 1, height: 1, unlockedByDefault: false },
  underground_belt: { type: "underground_belt", nameJa: "交差ブリッジ", width: 1, height: 1, unlockedByDefault: false },
  smelter: { type: "smelter", nameJa: "溶鉱炉", width: 1, height: 1, unlockedByDefault: true },
  assembler: { type: "assembler", nameJa: "組立機", width: 1, height: 1, unlockedByDefault: true },
  recycler: { type: "recycler", nameJa: "不純物処理炉", width: 1, height: 1, unlockedByDefault: false },
  sensor: { type: "sensor", nameJa: "流量・異常センサー", width: 1, height: 1, unlockedByDefault: false },
  hub: { type: "hub", nameJa: "中枢納品ハブ", width: 2, height: 2, unlockedByDefault: true },
};

// ============================================================================
// Recipe Catalog
// ============================================================================

export interface RecipeEntry {
  id: RecipeId;
  nameJa: string;
  building: "smelter" | "assembler";
  inputs: Partial<Record<MaterialId, number>>;
  outputs: Partial<Record<MaterialId, number>>;
  craftTicks: number;
  unlockedByDefault: boolean;
  slagChance?: number;
}

export const RECIPE_CATALOG: Record<RecipeId, RecipeEntry> = {
  iron_plate: {
    id: "iron_plate",
    nameJa: "鉄板製造",
    building: "smelter",
    inputs: { iron_ore: 2 },
    outputs: { iron_plate: 1 },
    craftTicks: 60,
    unlockedByDefault: true,
  },
  copper_plate: {
    id: "copper_plate",
    nameJa: "銅板製造",
    building: "smelter",
    inputs: { copper_ore: 2 },
    outputs: { copper_plate: 1 },
    craftTicks: 60,
    unlockedByDefault: true,
  },
  iron_plate_high: {
    id: "iron_plate_high",
    nameJa: "鉄板製造（高効率）",
    building: "smelter",
    inputs: { iron_ore: 3 },
    outputs: { iron_plate: 2 },
    craftTicks: 75,
    unlockedByDefault: false,
    slagChance: 0.15,
  },
  copper_plate_high: {
    id: "copper_plate_high",
    nameJa: "銅板製造（高効率）",
    building: "smelter",
    inputs: { copper_ore: 3 },
    outputs: { copper_plate: 2 },
    craftTicks: 75,
    unlockedByDefault: false,
    slagChance: 0.15,
  },
  iron_gear: {
    id: "iron_gear",
    nameJa: "鉄歯車製造",
    building: "assembler",
    inputs: { iron_plate: 2 },
    outputs: { iron_gear: 1 },
    craftTicks: 60,
    unlockedByDefault: true,
  },
  copper_wire: {
    id: "copper_wire",
    nameJa: "銅線製造",
    building: "assembler",
    inputs: { copper_plate: 1 },
    outputs: { copper_wire: 2 },
    craftTicks: 60,
    unlockedByDefault: true,
  },
  steel_plate: {
    id: "steel_plate",
    nameJa: "鋼板製造",
    building: "smelter",
    inputs: { iron_plate: 2, coal: 1 },
    outputs: { steel_plate: 1 },
    craftTicks: 120,
    unlockedByDefault: false,
    slagChance: 0.25,
  },
  silicon_wafer: {
    id: "silicon_wafer",
    nameJa: "シリコンウェハ製造",
    building: "smelter",
    inputs: { silica_sand: 2, coal: 1 },
    outputs: { silicon_wafer: 1 },
    craftTicks: 120,
    unlockedByDefault: false,
    slagChance: 0.20,
  },
  circuit_board: {
    id: "circuit_board",
    nameJa: "電子基板製造",
    building: "assembler",
    inputs: { iron_plate: 1, copper_wire: 3 },
    outputs: { circuit_board: 1 },
    craftTicks: 90,
    unlockedByDefault: false,
  },
  microchip: {
    id: "microchip",
    nameJa: "マイクロチップ製造",
    building: "assembler",
    inputs: { circuit_board: 1, silicon_wafer: 2, copper_wire: 2 },
    outputs: { microchip: 1 },
    craftTicks: 240,
    unlockedByDefault: false,
  },
  automation_module: {
    id: "automation_module",
    nameJa: "自動化モジュール製造",
    building: "assembler",
    inputs: { steel_plate: 2, iron_gear: 4, microchip: 2 },
    outputs: { automation_module: 1 },
    craftTicks: 240,
    unlockedByDefault: false,
  },
};

// ============================================================================
// Tech Catalog
// ============================================================================

export interface TechEntry {
  id: string;
  nameJa: string;
  description: string;
  cost: number;
  unlocks: string[]; // building types, recipe ids, or feature flags
}

export const TECH_CATALOG: Record<string, TechEntry> = {
  "filter_splitter": {
    id: "filter_splitter",
    nameJa: "フィルター分配機",
    description: "指定物質を自動選別する分配機をアンロック",
    cost: 100,
    unlocks: ["filter_splitter"],
  },
  "underground_belt": {
    id: "underground_belt",
    nameJa: "交差ブリッジ",
    description: "ラインを跨ぐ長距離搬送ブリッジをアンロック",
    cost: 150,
    unlocks: ["underground_belt"],
  },
  "high_efficiency": {
    id: "high_efficiency",
    nameJa: "高効率製錬",
    description: "高効率鉄板・銅板レシピをアンロック",
    cost: 200,
    unlocks: ["iron_plate_high", "copper_plate_high"],
  },
  "sensor": {
    id: "sensor",
    nameJa: "流量・異常センサー",
    description: "流量・異常センサーをアンロック",
    cost: 150,
    unlocks: ["sensor"],
  },
  "recycler": {
    id: "recycler",
    nameJa: "不純物処理炉",
    description: "不純物処理炉（リサイクラー）をアンロック",
    cost: 200,
    unlocks: ["recycler"],
  },
  "advanced_smelting": {
    id: "advanced_smelting",
    nameJa: "高度精錬技術",
    description: "鋼板・シリコンウェハレシピをアンロック",
    cost: 200,
    unlocks: ["steel_plate", "silicon_wafer"],
  },
  "electronics": {
    id: "electronics",
    nameJa: "電子工業",
    description: "電子基板・マイクロチップレシピと組立機をアンロック",
    cost: 300,
    unlocks: ["assembler", "circuit_board", "microchip"],
  },
  "automation": {
    id: "automation",
    nameJa: "自動化研究",
    description: "自動化モジュールレシピをアンロック",
    cost: 500,
    unlocks: ["automation_module"],
  },
};

// ============================================================================
// Quest Catalog
// ============================================================================

export interface QuestEntry {
  id: string;
  nameJa: string;
  description: string;
  phase: 1 | 2 | 3 | 4;
  deliver?: Partial<Record<MaterialId, number>>;
  build?: Partial<Record<BuildingType, number>>;
  targetSpm?: number;
}

export const QUEST_CATALOG: Record<string, QuestEntry> = {
  "tutorial_iron": {
    id: "tutorial_iron",
    nameJa: "鉄の納品",
    description: "鉄板を 10 個ハブに納品しましょう",
    phase: 1,
    deliver: { iron_plate: 10 },
  },
  "tutorial_copper": {
    id: "tutorial_copper",
    nameJa: "銅の納品",
    description: "銅板を 10 個ハブに納品しましょう",
    phase: 1,
    deliver: { copper_plate: 10 },
  },
  "tutorial_gears": {
    id: "tutorial_gears",
    nameJa: "歯車の生産",
    description: "鉄歯車を 5 個生産しましょう",
    phase: 1,
    deliver: { iron_gear: 5 },
  },
  "phase2_setup": {
    id: "phase2_setup",
    nameJa: "自動化ライン構築",
    description: "採掘ドリル 4 基と溶鉱炉 2 基を設置",
    phase: 2,
    build: { miner: 4, smelter: 2 },
  },
  "phase2_delivery": {
    id: "phase2_delivery",
    nameJa: "安定供給",
    description: "鉄板を 50 個、銅板を 50 個納品",
    phase: 2,
    deliver: { iron_plate: 50, copper_plate: 50 },
  },
  "phase3_electronics": {
    id: "phase3_electronics",
    nameJa: "電子部品ライン",
    description: "銅線 20 個と電子基板 5 個を納品",
    phase: 3,
    deliver: { copper_wire: 20, circuit_board: 5 },
  },
  "phase3_throughput": {
    id: "phase3_throughput",
    nameJa: "高スループット",
    description: "目標 SPM 10 を達成",
    phase: 3,
    targetSpm: 10,
  },
  "phase4_mastery": {
    id: "phase4_mastery",
    nameJa: "完全自動化",
    description: "マイクロチップ 10 個と自動化モジュール 3 個を納品",
    phase: 4,
    deliver: { microchip: 10, automation_module: 3 },
  },
};
