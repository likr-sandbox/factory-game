// Dynamic delivery quests module for sim-quests
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { WorldState, ActiveQuestState, MaterialId, RecipeId } from "./types";
import { nextRandom } from "./world";
import { RECIPE_CATALOG } from "./catalog";
import { isRecipeUnlocked } from "./progression";
import { QUEST_DURATION_TICKS } from "./constants";
export { QUEST_DURATION_TICKS };

// Quest templates covering required recipes: iron_plate, copper_plate, iron_gear, copper_wire, circuit_board, microchip, automation_module
interface QuestTemplate {
  id: string;
  nameJa: string;
  deliver: Partial<Record<MaterialId, number>>;
  rewardPoints: number;
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: "delivery_iron_plate", nameJa: "鉄板納品ミッション", deliver: { iron_plate: 15 }, rewardPoints: 50 },
  { id: "delivery_copper_plate", nameJa: "銅板納品ミッション", deliver: { copper_plate: 15 }, rewardPoints: 50 },
  { id: "delivery_iron_gear", nameJa: "鉄歯車納品ミッション", deliver: { iron_gear: 8 }, rewardPoints: 80 },
  { id: "delivery_copper_wire", nameJa: "銅線納品ミッション", deliver: { copper_wire: 12 }, rewardPoints: 80 },
  { id: "delivery_circuit_board", nameJa: "電子基板納品ミッション", deliver: { circuit_board: 5 }, rewardPoints: 120 },
  { id: "delivery_microchip", nameJa: "マイクロチップ納品ミッション", deliver: { microchip: 3 }, rewardPoints: 180 },
  { id: "delivery_automation_module", nameJa: "自動化モジュール納品ミッション", deliver: { automation_module: 2 }, rewardPoints: 250 },
];

export const MAX_ACTIVE_QUESTS = 3;

interface ExtendedActiveQuestState extends ActiveQuestState {
  templateIndex: number;
}

export function generateDynamicQuest(world: WorldState): ActiveQuestState | null {
  if ((world.activeQuests?.length ?? 0) >= MAX_ACTIVE_QUESTS) {
    return null;
  }

  // Build set of materials currently requested by active quests
  const activeMaterials = new Set<MaterialId>();
  for (const quest of world.activeQuests || []) {
    const extQuest = quest as ExtendedActiveQuestState;
    for (const material of Object.keys(quest.progress)) {
      activeMaterials.add(material as MaterialId);
    }
  }

  // Filter templates to only include those that:
  // 1. Have at least one deliverable material that has a corresponding unlocked recipe
  // 2. Don't duplicate materials already requested by active quests
  const validTemplates = QUEST_TEMPLATES.filter((template) => {
    const material = Object.keys(template.deliver)[0] as MaterialId;
    
    // Check if this material is already requested by an active quest
    if (!material || activeMaterials.has(material)) {
      return false;
    }
    
    // Check if there's a recipe for this material and if it's unlocked
    // Note: Not all materials have recipes (e.g., raw materials like iron_ore)
    if (!(material in RECIPE_CATALOG)) {
      return false;
    }
    
    // Type assertion safe because we checked the key exists in RECIPE_CATALOG
    const recipeId = material as RecipeId;
    if (!isRecipeUnlocked(world, recipeId)) {
      return false;
    }
    
    return true;
  });

  // If no valid templates available, return null
  if (validTemplates.length === 0) {
    return null;
  }

  const { value: randVal, nextState } = nextRandom(world.rngState);
  world.rngState = nextState;

  // Select from valid templates only
  const templateIndexInValid = Math.floor(randVal * validTemplates.length);
  const selectedTemplate = validTemplates[templateIndexInValid]!;
  
  // Find the original index in QUEST_TEMPLATES for tracking
  const originalTemplateIndex = QUEST_TEMPLATES.indexOf(selectedTemplate);

  const questState: ExtendedActiveQuestState = {
    questId: `quest_${world.nextQuestId ?? 0}`,
    stepIndex: 0,
    progress: {},
    startedAtTick: world.tick,
    templateIndex: originalTemplateIndex,
  };

  for (const material of Object.keys(selectedTemplate.deliver)) {
    questState.progress[material] = 0;
  }

  world.nextQuestId = (world.nextQuestId ?? 0) + 1;
  world.activeQuests = world.activeQuests || [];
  world.activeQuests.push(questState as ActiveQuestState);

  return questState as ActiveQuestState;
}

export function updateQuestProgress(
  world: WorldState,
  material: MaterialId,
  amountDelivered: number
): boolean {
  const activeQuests = world.activeQuests || [];
  let updated = false;

  for (const quest of activeQuests) {
    const extQuest = quest as ExtendedActiveQuestState;
    const template = QUEST_TEMPLATES[extQuest.templateIndex];
    
    if (!template) continue;
    
    const targetAmount = template.deliver[material] ?? 0;
    if (targetAmount <= 0) continue;

    const currentProgress = quest.progress[material] ?? 0;
    const newProgress = Math.min(currentProgress + amountDelivered, targetAmount);
    quest.progress[material] = newProgress;
    updated = true;

    if (isQuestComplete(quest)) {
      completeQuest(world, quest);
    }
  }

  return updated;
}

export function processQuests(world: WorldState): void {
  const activeQuests = world.activeQuests || [];
  const remaining: ActiveQuestState[] = [];

  for (const quest of activeQuests) {
    const extQuest = quest as ExtendedActiveQuestState;
    const expired = world.tick - quest.startedAtTick >= QUEST_DURATION_TICKS;
    const completed = isQuestComplete(quest);

    if (completed) {
      completeQuest(world, quest);
    } else if (expired) {
      // Discard expired but not completed quests without rewards
      // Do nothing - just don't add to remaining
    } else {
      remaining.push(quest);
    }
  }

  world.activeQuests = remaining;

  while ((world.activeQuests?.length ?? 0) < MAX_ACTIVE_QUESTS) {
    const generated = generateDynamicQuest(world);
    if (!generated) break;
  }
}

export function completeQuest(world: WorldState, quest: ActiveQuestState): void {
  world.completedQuests = world.completedQuests || [];
  
  if (!world.completedQuests.includes(quest.questId)) {
    world.completedQuests.push(quest.questId);
  }

  const extQuest = quest as ExtendedActiveQuestState;
  const template = QUEST_TEMPLATES[extQuest.templateIndex];
  if (template) {
    world.researchPoints = (world.researchPoints ?? 0) + template.rewardPoints;
  }
}

export function awardResearchPoints(world: WorldState, quest: ActiveQuestState): number {
  const extQuest = quest as ExtendedActiveQuestState;
  const template = QUEST_TEMPLATES[extQuest.templateIndex];
  const points = template?.rewardPoints ?? 0;
  world.researchPoints = (world.researchPoints ?? 0) + points;
  return points;
}

export function getActiveQuests(world: WorldState): ActiveQuestState[] {
  return world.activeQuests || [];
}

export function isQuestExpired(world: WorldState, quest: ActiveQuestState): boolean {
  return world.tick - quest.startedAtTick >= QUEST_DURATION_TICKS;
}

export function isQuestComplete(quest: ActiveQuestState): boolean {
  const extQuest = quest as ExtendedActiveQuestState;
  const template = QUEST_TEMPLATES[extQuest.templateIndex];
  
  if (!template || !template.deliver) {
    return false;
  }

  for (const material of Object.keys(template.deliver)) {
    const targetAmount = template.deliver[material as MaterialId] ?? 0;
    const currentProgress = quest.progress[material] ?? 0;
    if (currentProgress < targetAmount) {
      return false;
    }
  }
  return true;
}

export function getQuestProgress(quest: ActiveQuestState): Record<string, { current: number; target: number }> {
  const result: Record<string, { current: number; target: number }> = {};
  const extQuest = quest as ExtendedActiveQuestState;
  const template = QUEST_TEMPLATES[extQuest.templateIndex];

  if (!template) {
    return result;
  }

  for (const material of Object.keys(template.deliver)) {
    const targetAmount = template.deliver[material as MaterialId] ?? 0;
    result[material] = {
      current: quest.progress[material] ?? 0,
      target: targetAmount,
    };
  }

  return result;
}
