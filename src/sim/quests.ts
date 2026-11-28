// Dynamic delivery quests module for sim-quests
// Pure TypeScript - ZERO imports or references to Phaser, window, document

import type { WorldState, ActiveQuestState, MaterialId, RecipeId } from "./types";
import { nextRandom } from "./world";
import { QUEST_CATALOG, RECIPE_CATALOG, type QuestEntry } from "./catalog";
import { isRecipeUnlocked } from "./progression";

export const MAX_ACTIVE_QUESTS = 3;

// Extended quest state with catalog-based design
interface DynamicQuestState extends ActiveQuestState {
  questCatalogId: string;
  targets: Record<string, number>;
  rewardPoints: number;
}

/**
 * Calculate scaled target amount and reward points based on progression.
 * scale = 1 + (unlockedTechs.length * 0.25) + (tutorialPhase * 0.25)
 */
function calculateScaledValues(baseAmount: number, baseReward: number, world: WorldState): { target: number; reward: number } {
  const techCount = world.unlockedTechs?.length ?? 0;
  const phase = world.tutorialPhase ?? 0;
  const scale = 1 + techCount * 0.25 + phase * 0.25;
  
  return {
    target: Math.round(baseAmount * scale),
    reward: Math.round(baseReward * scale),
  };
}

/**
 * Get eligible quest entries based on unlocked recipes and active quest materials.
 * Filters out entries for locked recipes and materials already requested by active quests.
 */
function getEligibleQuestEntries(world: WorldState): QuestEntry[] {
  // Build set of materials currently requested by active quests
  const activeMaterials = new Set<MaterialId>();
  for (const quest of world.activeQuests || []) {
    const dynQuest = quest as DynamicQuestState;
    for (const material of Object.keys(dynQuest.targets || {})) {
      activeMaterials.add(material as MaterialId);
    }
  }

  const eligibleEntries: QuestEntry[] = [];
  
  for (const entry of Object.values(QUEST_CATALOG)) {
    // Skip if no deliverable items
    if (!entry.deliver || Object.keys(entry.deliver).length === 0) {
      continue;
    }

    const material = Object.keys(entry.deliver)[0] as MaterialId;
    
    // Check if this material is already requested by an active quest
    if (activeMaterials.has(material)) {
      continue;
    }
    
    // Check if recipe exists and is unlocked
    if (!(material in RECIPE_CATALOG)) {
      continue;
    }
    
    const recipeId = material as RecipeId;
    if (!isRecipeUnlocked(world, recipeId)) {
      continue;
    }
    
    eligibleEntries.push(entry);
  }
  
  return eligibleEntries;
}

/**
 * Select a quest entry using weighted random based on phase.
 * When unlockedTechs.length > 0 or tutorialPhase >= 2, higher phase entries get higher weight.
 */
function selectQuestEntry(eligibleEntries: QuestEntry[], world: WorldState): QuestEntry | null {
  if (eligibleEntries.length === 0) {
    return null;
  }
  
  // Single entry - no need to randomize
  if (eligibleEntries.length === 1) {
    return eligibleEntries[0]!;
  }
  
  const { value: randVal, nextState } = nextRandom(world.rngState);
  world.rngState = nextState;
  
  const techCount = world.unlockedTechs?.length ?? 0;
  const phase = world.tutorialPhase ?? 0;
  
  // Weighted selection when progression has advanced
  if (techCount > 0 || phase >= 2) {
    // Calculate weights: higher phase = higher weight
    const entriesWithWeights = eligibleEntries.map(entry => ({
      entry,
      weight: entry.phase,
    }));
    
    const totalWeight = entriesWithWeights.reduce((sum, e) => sum + e.weight, 0);
    
    // Select based on cumulative weight
    let cumulative = 0;
    const threshold = randVal * totalWeight;
    
    for (const item of entriesWithWeights) {
      cumulative += item.weight;
      if (threshold <= cumulative) {
        return item.entry;
      }
    }
    
    // Fallback to last entry (should never reach here)
    return entriesWithWeights[entriesWithWeights.length - 1]?.entry ?? null;
  }
  
  // Uniform random selection for early game
  const index = Math.floor(randVal * eligibleEntries.length);
  return eligibleEntries[index]!;
}

export function generateDynamicQuest(world: WorldState): ActiveQuestState | null {
  if ((world.activeQuests?.length ?? 0) >= MAX_ACTIVE_QUESTS) {
    return null;
  }

  const eligibleEntries = getEligibleQuestEntries(world);
  
  if (eligibleEntries.length === 0) {
    return null;
  }
  
  const selectedEntry = selectQuestEntry(eligibleEntries, world);
  
  if (!selectedEntry) {
    return null;
  }
  
  // Calculate scaled values based on progression
  const baseAmount = selectedEntry.deliver ? Object.values(selectedEntry.deliver)[0] ?? 0 : 0;
  const baseReward = selectedEntry.rewardPoints;
  const { target, reward } = calculateScaledValues(baseAmount, baseReward, world);
  
  // Build targets object with scaled values
  const targets: Record<string, number> = {};
  if (selectedEntry.deliver) {
    for (const [material, baseQty] of Object.entries(selectedEntry.deliver)) {
      targets[material] = Math.round(baseQty * (target / baseAmount));
    }
  }
  
  const questState: DynamicQuestState = {
    questId: `quest_${world.nextQuestId ?? 0}`,
    stepIndex: 0,
    progress: {},
    startedAtTick: world.tick,
    questCatalogId: selectedEntry.id,
    targets,
    rewardPoints: reward,
  };
  
  // Initialize progress for each target material
  for (const material of Object.keys(targets)) {
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
    const dynQuest = quest as DynamicQuestState;
    
    // Fail-fast: throw error if targets is missing
    if (!dynQuest.targets) {
      throw new Error(`Quest ${quest.questId} is missing targets field`);
    }
    
    const targetAmount = dynQuest.targets[material] ?? 0;
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
    const expired = world.tick - quest.startedAtTick >= 6000;
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

  const dynQuest = quest as DynamicQuestState;
  
  // Fail-fast: throw error if rewardPoints is missing
  if (dynQuest.rewardPoints === undefined) {
    throw new Error(`Quest ${quest.questId} is missing rewardPoints field`);
  }
  
  world.researchPoints = (world.researchPoints ?? 0) + dynQuest.rewardPoints;
}

export function awardResearchPoints(world: WorldState, quest: ActiveQuestState): number {
  const dynQuest = quest as DynamicQuestState;
  
  // Fail-fast: throw error if rewardPoints is missing
  if (dynQuest.rewardPoints === undefined) {
    throw new Error(`Quest ${quest.questId} is missing rewardPoints field`);
  }
  
  const points = dynQuest.rewardPoints;
  world.researchPoints = (world.researchPoints ?? 0) + points;
  return points;
}

export function getActiveQuests(world: WorldState): ActiveQuestState[] {
  return world.activeQuests || [];
}

export function isQuestExpired(world: WorldState, quest: ActiveQuestState): boolean {
  return world.tick - quest.startedAtTick >= 6000;
}

export function isQuestComplete(quest: ActiveQuestState): boolean {
  const dynQuest = quest as DynamicQuestState;
  
  // Fail-fast: throw error if targets is missing
  if (!dynQuest.targets) {
    throw new Error(`Quest ${quest.questId} is missing targets field`);
  }

  for (const material of Object.keys(dynQuest.targets)) {
    const targetAmount = dynQuest.targets[material] ?? 0;
    const currentProgress = quest.progress[material] ?? 0;
    if (currentProgress < targetAmount) {
      return false;
    }
  }
  return true;
}

export function getQuestProgress(quest: ActiveQuestState): Record<string, { current: number; target: number }> {
  const result: Record<string, { current: number; target: number }> = {};
  const dynQuest = quest as DynamicQuestState;
  
  // Fail-fast: throw error if targets is missing
  if (!dynQuest.targets) {
    throw new Error(`Quest ${quest.questId} is missing targets field`);
  }

  for (const material of Object.keys(dynQuest.targets)) {
    const targetAmount = dynQuest.targets[material] ?? 0;
    result[material] = {
      current: quest.progress[material] ?? 0,
      target: targetAmount,
    };
  }

  return result;
}
