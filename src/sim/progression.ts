// Progression: Tech Tree, research points, Tutorial Phases 1-4
import type { WorldState, MaterialId, BuildingType, RecipeId } from "./types";
import { TECH_CATALOG, RECIPE_CATALOG, BUILDING_CATALOG } from "./catalog";

export type TechId = "underground_belt" | "filter_splitter" | "high_efficiency"
  | "sensor" | "recycler" | "advanced_smelting" | "electronics" | "automation";

const TECH_COSTS: Record<TechId, number> = {
  underground_belt: 150, filter_splitter: 100, high_efficiency: 200,
  sensor: 150, recycler: 200, advanced_smelting: 200, electronics: 300, automation: 500,
};

const RESEARCH_POINTS: Partial<Record<MaterialId, number>> = {
  iron_plate: 5, copper_plate: 5, iron_gear: 8, copper_wire: 8,
  steel_plate: 12, silicon_wafer: 12, circuit_board: 15, microchip: 20,
  automation_module: 25, slag: 2,
};

export function awardResearchPoints(world: WorldState, material: MaterialId, amount: number): number {
  const pts = (RESEARCH_POINTS[material] ?? 0) * amount;
  if (pts > 0) world.researchPoints = (world.researchPoints ?? 0) + pts;
  return pts;
}

export function calculateTotalResearchPoints(history: Array<{ material: MaterialId; amount: number }>): number {
  return history.reduce((s, d) => s + ((RESEARCH_POINTS[d.material] ?? 0) * d.amount), 0);
}

function getTechUnlocks(techId: TechId): string[] {
  const cat = TECH_CATALOG[techId];
  if (!cat) throw new Error(`Unknown tech ID: ${techId}`);
  return cat.unlocks;
}

export function unlockTech(world: WorldState, techId: TechId): boolean {
  const cost = TECH_COSTS[techId] ?? TECH_CATALOG[techId]?.cost;
  if (!cost && !TECH_CATALOG[techId]) throw new Error(`Unknown tech ID: ${techId}`);
  const pts = world.researchPoints ?? 0;
  if (pts < cost) return false;
  world.researchPoints = pts - cost;
  if (!world.unlockedTechs.includes(techId)) world.unlockedTechs.push(techId);
  return true;
}

export function isBuildingUnlocked(world: WorldState, bt: BuildingType): boolean {
  const b = BUILDING_CATALOG[bt];
  if (!b) throw new Error(`Unknown building type: ${bt}`);
  if (b.unlockedByDefault) return true;
  return (world.unlockedTechs || []).some(t => getTechUnlocks(t as TechId).includes(bt));
}

export function isRecipeUnlocked(world: WorldState, rid: RecipeId): boolean {
  const r = RECIPE_CATALOG[rid];
  if (!r) throw new Error(`Unknown recipe ID: ${rid}`);
  // Fail-fast: never report a recipe unlocked if its building is locked
  if (!isBuildingUnlocked(world, r.building)) return false;
  if (r.unlockedByDefault) return true;
  return (world.unlockedTechs || []).some(t => getTechUnlocks(t as TechId).includes(rid));
}

export interface TechTreeStatus {
  undergroundBelt: boolean; filterSplitter: boolean;
  highEfficiencyRecipes: { ironPlateHigh: boolean; copperPlateHigh: boolean };
  sensor: boolean; recycler: boolean;
  advancedSmelting: { steelPlate: boolean; siliconWafer: boolean };
  electronics: { assembler: boolean; circuitBoard: boolean; microchip: boolean };
  automation: { automationModule: boolean };
}

export function getTechTreeStatus(world: WorldState): TechTreeStatus {
  return {
    undergroundBelt: isBuildingUnlocked(world, "underground_belt"),
    filterSplitter: isBuildingUnlocked(world, "filter_splitter"),
    highEfficiencyRecipes: { ironPlateHigh: isRecipeUnlocked(world, "iron_plate_high"), copperPlateHigh: isRecipeUnlocked(world, "copper_plate_high") },
    sensor: isBuildingUnlocked(world, "sensor"),
    recycler: isBuildingUnlocked(world, "recycler"),
    advancedSmelting: { steelPlate: isRecipeUnlocked(world, "steel_plate"), siliconWafer: isRecipeUnlocked(world, "silicon_wafer") },
    electronics: { assembler: isBuildingUnlocked(world, "assembler"), circuitBoard: isRecipeUnlocked(world, "circuit_board"), microchip: isRecipeUnlocked(world, "microchip") },
    automation: { automationModule: isRecipeUnlocked(world, "automation_module") },
  };
}

// Tutorial Phase types and steps
export type TutorialPhase = 0 | 1 | 2 | 3 | 4;
export interface TutorialStep { id: string; titleJa: string; descriptionJa: string; phase: TutorialPhase; rewardPoints: number; check: (w: WorldState) => boolean; }

const hasType = (buildings: Record<string, { type: string }>, t: string) => Object.values(buildings).some(b => b.type === t);

// Phase 1: Manual mining/smelting/delivery (15-25 RP each, total 75 RP + delivery RP = ~150+ RP for underground_belt)
const P1: TutorialStep[] = [
  { id: "p1_manual_mining", titleJa: "手動採掘", descriptionJa: "鉱石を採掘しましょう", phase: 1, rewardPoints: 15, check: w => hasType(w.buildings, "miner") },
  { id: "p1_manual_smelting", titleJa: "手動製錬", descriptionJa: "溶鉱炉で鉄板を製造しましょう", phase: 1, rewardPoints: 15, check: w => hasType(w.buildings, "smelter") },
  { id: "p1_first_delivery", titleJa: "最初の納品", descriptionJa: "鉄板を 10 個ハブに納品しましょう", phase: 1, rewardPoints: 20, check: w => (w.delivered?.iron_plate ?? 0) >= 10 },
  { id: "p1_copper_delivery", titleJa: "銅の納品", descriptionJa: "銅板を 10 個ハブに納品しましょう", phase: 1, rewardPoints: 25, check: w => (w.delivered?.copper_plate ?? 0) >= 10 },
];

// Phase 2: WebMCP/batch line building and parallelization (30-50 RP each)
const P2: TutorialStep[] = [
  { id: "p2_batch_building", titleJa: "バッチ建設", descriptionJa: "採掘ドリル 4 基と溶鉱炉 2 基を設置しましょう", phase: 2, rewardPoints: 30,
    check: w => { const bs = w.buildings; return Object.values(bs).filter(b => b.type === "miner").length >= 4 && Object.values(bs).filter(b => b.type === "smelter").length >= 2; } },
  { id: "p2_parallelization", titleJa: "並列化", descriptionJa: "安定した生産ラインを構築しましょう", phase: 2, rewardPoints: 40, check: w => (w.delivered?.iron_plate ?? 0) >= 50 && (w.delivered?.copper_plate ?? 0) >= 50 },
  { id: "p2_underground_belt", titleJa: "交差ブリッジ活用", descriptionJa: "地下ベルト（交差ブリッジ）を使用しましょう", phase: 2, rewardPoints: 50, check: w => hasType(w.buildings, "underground_belt") },
];

// Phase 3: Electronics and circuit board line (60-80 RP each)
const P3: TutorialStep[] = [
  { id: "p3_electronics_unlock", titleJa: "電子工業アンロック", descriptionJa: "電子工業技術を研究しましょう", phase: 3, rewardPoints: 60, check: w => w.unlockedTechs.includes("electronics") },
  { id: "p3_circuit_board_line", titleJa: "電子基板ライン", descriptionJa: "電子基板を製造するラインを構築しましょう", phase: 3, rewardPoints: 70, check: w => hasType(w.buildings, "assembler") },
  { id: "p3_filter_splitter", titleJa: "フィルター分配機", descriptionJa: "フィルター分配機を使用して物料を選別しましょう", phase: 3, rewardPoints: 75, check: w => hasType(w.buildings, "filter_splitter") },
  { id: "p3_delivery_target", titleJa: "電子部品納品", descriptionJa: "銅線 20 個と電子基板 5 個を納品しましょう", phase: 3, rewardPoints: 80, check: w => (w.delivered?.copper_wire ?? 0) >= 20 && (w.delivered?.circuit_board ?? 0) >= 5 },
];

// Phase 4: Advanced tech, slag handling, fault recovery (100 RP each)
const P4: TutorialStep[] = [
  { id: "p4_advanced_technology", titleJa: "高度技術の研究", descriptionJa: "高度精錬技術と自動化研究をアンロックしましょう", phase: 4, rewardPoints: 100, check: w => w.unlockedTechs.includes("advanced_smelting") && w.unlockedTechs.includes("automation") },
  { id: "p4_slag_handling", titleJa: "スラグ処理", descriptionJa: "不純物処理炉（リサイクラー）を使用してスラグを処理しましょう", phase: 4, rewardPoints: 100, check: w => hasType(w.buildings, "recycler") },
  { id: "p4_sensor_deploy", titleJa: "センサー設置", descriptionJa: "流量・異常センサーを配置してライン監視を行いましょう", phase: 4, rewardPoints: 100, check: w => hasType(w.buildings, "sensor") },
  { id: "p4_master_delivery", titleJa: "完全自動化納品", descriptionJa: "マイクロチップ 10 個と自動化モジュール 3 個を納品しましょう", phase: 4, rewardPoints: 100, check: w => (w.delivered?.microchip ?? 0) >= 10 && (w.delivered?.automation_module ?? 0) >= 3 },
];

const ALL_STEPS: TutorialStep[] = [...P1, ...P2, ...P3, ...P4];

export function getTutorialStepsForPhase(phase: TutorialPhase): TutorialStep[] {
  return ALL_STEPS.filter(s => s.phase === phase);
}

export function getCurrentTutorialStep(world: WorldState): TutorialStep | null {
  const phase = (world.tutorialPhase ?? 0) as TutorialPhase;
  if (phase === 0 || phase > 4) return null;
  const done = new Set(world.completedTutorialSteps || []);
  for (const step of getTutorialStepsForPhase(phase)) {
    if (!done.has(step.id)) return step;
  }
  return null;
}

export function completeTutorialStep(world: WorldState, stepId: string): boolean {
  const step = ALL_STEPS.find(s => s.id === stepId);
  if (!step) throw new Error(`Unknown tutorial step ID: ${stepId}`);
  if (!step.check(world)) return false;
  world.completedTutorialSteps = world.completedTutorialSteps || [];
  // Award bonus RP only on first completion (not if already completed)
  if (!world.completedTutorialSteps.includes(stepId)) {
    world.completedTutorialSteps.push(stepId);
    world.researchPoints = (world.researchPoints ?? 0) + step.rewardPoints;
    const phase = (world.tutorialPhase ?? 1) as TutorialPhase;
    const phaseSteps = getTutorialStepsForPhase(phase);
    if (phaseSteps.every(s => world.completedTutorialSteps?.includes(s.id)) && phase < 4) {
      world.tutorialPhase = (phase + 1) as TutorialPhase;
    }
    return true;
  }
  // Already completed - no double award
  return true;
}

export function startTutorial(world: WorldState): void {
  world.tutorialPhase = 1;
  world.completedTutorialSteps = [];
}

export interface TutorialProgress {
  phase: TutorialPhase; currentStep: TutorialStep | null;
  completedSteps: number; totalStepsInPhase: number; isComplete: boolean;
}

export function getTutorialProgress(world: WorldState): TutorialProgress {
  const phase = (world.tutorialPhase ?? 0) as TutorialPhase;
  const phaseSteps = getTutorialStepsForPhase(phase);
  const completed = phaseSteps.filter(s => world.completedTutorialSteps?.includes(s.id)).length;
  return { phase, currentStep: getCurrentTutorialStep(world), completedSteps: completed, totalStepsInPhase: phaseSteps.length, isComplete: phase === 4 && completed === phaseSteps.length };
}
