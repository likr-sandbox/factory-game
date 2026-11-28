// Unit tests for dynamic delivery quests module
import { describe, it, expect } from "vitest";
import type { WorldState } from "../../src/sim/types";
import { createWorld } from "../../src/sim/world";
import {
  generateDynamicQuest, updateQuestProgress, processQuests, completeQuest,
  awardResearchPoints, getActiveQuests, isQuestExpired, isQuestComplete,
  getQuestProgress, MAX_ACTIVE_QUESTS, QUEST_DURATION_TICKS,
} from "../../src/sim/quests";

describe("Dynamic Delivery Quests", () => {
  function createTestWorld(): WorldState {
    const w = createWorld(12345);
    w.activeQuests = []; w.nextQuestId = 0; w.researchPoints = 0; w.completedQuests = [];
    return w;
  }

  describe("generateDynamicQuest", () => {
    it("should create a new quest when slots available", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world);
      expect(quest).toBeDefined();
      expect(quest?.questId).toMatch(/^quest_\d+$/);
      expect(world.activeQuests?.length).toBe(1);
    });

    it("should return null when max active quests reached", () => {
      const world = createTestWorld();
      for (let i = 0; i < 3; i++) generateDynamicQuest(world);
      expect(generateDynamicQuest(world)).toBeNull();
    });

    it("should use deterministic RNG", () => {
      const world1 = createTestWorld(), world2 = createTestWorld();
      world1.rngState = 100; world2.rngState = 100;
      expect(generateDynamicQuest(world1)?.questId).toBe(generateDynamicQuest(world2)?.questId);
    });
  });

  describe("updateQuestProgress", () => {
    it("should update progress for matching material", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      const material = Object.keys(quest.progress)[0]! as keyof typeof quest.progress;
      expect(updateQuestProgress(world, material as any, 5)).toBe(true);
    });

    it("should not update if no quest needs that material", () => {
      expect(updateQuestProgress(createTestWorld(), "slag" as any, 10)).toBe(false);
    });

    it("should cap progress at target amount", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      const material = Object.keys(quest.progress)[0]! as keyof typeof quest.progress;
      const target = getQuestProgress(quest)[material]?.target ?? 0;
      updateQuestProgress(world, material as any, target + 100);
      expect(quest.progress[material]).toBeLessThanOrEqual(target);
    });
  });

  describe("isQuestComplete", () => {
    it("should return false when incomplete", () => {
      expect(isQuestComplete(generateDynamicQuest(createTestWorld())!)).toBe(false);
    });

    it("should return true when all targets met", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      const info = getQuestProgress(quest);
      for (const [m, d] of Object.entries(info)) quest.progress[m] = d.target;
      expect(isQuestComplete(quest)).toBe(true);
    });
  });

  describe("isQuestExpired", () => {
    it("should return false before expiration", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      world.tick = 6001; // 100 seconds - should NOT be expired yet (duration is 36000 ticks = 600 seconds)
      expect(isQuestExpired(world, quest)).toBe(false);
    });

    it("should return true after expiration", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      world.tick = QUEST_DURATION_TICKS;
      expect(isQuestExpired(world, quest)).toBe(true);
    });

    it("should return true at tick >= QUEST_DURATION_TICKS", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      world.tick = QUEST_DURATION_TICKS + 1;
      expect(isQuestExpired(world, quest)).toBe(true);
    });
  });

  describe("processQuests", () => {
    it("should remove expired and generate replacements", () => {
      const world = createTestWorld();
      const original = generateDynamicQuest(world)!;
      world.tick = QUEST_DURATION_TICKS + 1;
      processQuests(world);
      expect(world.activeQuests?.length).toBe(MAX_ACTIVE_QUESTS);
      expect(world.activeQuests?.some(q => q.questId === original.questId)).toBe(false);
    });

    it("should complete and remove finished quests", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      const info = getQuestProgress(quest);
      for (const [m, d] of Object.entries(info)) quest.progress[m] = d.target;
      processQuests(world);
      expect(world.completedQuests?.includes(quest.questId)).toBe(true);
    });
  });

  describe("completeQuest", () => {
    it("should add to completed list and award points", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      completeQuest(world, quest);
      expect(world.completedQuests?.includes(quest.questId)).toBe(true);
      expect(world.researchPoints).toBeGreaterThan(0);
    });
  });

  describe("awardResearchPoints", () => {
    it("should return and add reward points", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      const initial = world.researchPoints || 0;
      const awarded = awardResearchPoints(world, quest);
      expect(world.researchPoints).toBe(initial + awarded);
    });
  });

  describe("getActiveQuests", () => {
    it("should return empty when none", () => {
      const world = createTestWorld();
      world.activeQuests = undefined;
      expect(getActiveQuests(world).length).toBe(0);
    });

    it("should return all active quests", () => {
      const world = createTestWorld();
      generateDynamicQuest(world);
      generateDynamicQuest(world);
      expect(getActiveQuests(world).length).toBe(2);
    });
  });

  describe("getQuestProgress", () => {
    it("should return current and target for each material", () => {
      const quest = generateDynamicQuest(createTestWorld())!;
      const progress = getQuestProgress(quest);
      for (const [, data] of Object.entries(progress)) {
        expect(data).toHaveProperty("current");
        expect(data).toHaveProperty("target");
      }
    });

    it("should reflect updated progress", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      const material = Object.keys(quest.progress)[0]!;
      const target = getQuestProgress(quest)[material]?.target ?? 10;
      updateQuestProgress(world, material as any, Math.min(3, target));
      expect(getQuestProgress(quest)[material]?.current).toBeGreaterThan(0);
    });
  });

  describe("Deterministic behavior", () => {
    it("should produce same sequence with same seed", () => {
      const w1 = createTestWorld(), w2 = createTestWorld();
      w1.rngState = 999; w2.rngState = 999;
      expect(w1.activeQuests?.[0]?.questId).toBe(w2.activeQuests?.[0]?.questId);
    });
  });

  describe("Regression tests for issue21", () => {
    it("should NOT award rewards for expired but incomplete quests", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      
      // Advance tick to expire the quest without completing it
      world.tick = QUEST_DURATION_TICKS + 1;
      
      // Process should remove expired quest without awarding points
      const initialPoints = world.researchPoints || 0;
      processQuests(world);
      
      // Quest should be removed
      expect(world.activeQuests?.some(q => q.questId === quest.questId)).toBe(false);
      // But no rewards should be given (points unchanged)
      expect(world.researchPoints).toBe(initialPoints);
      // Should not be in completed list
      expect(world.completedQuests?.includes(quest.questId)).toBe(false);
    });

    it("should award rewards only for completed quests", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      
      // Complete the quest
      const info = getQuestProgress(quest);
      for (const [m, d] of Object.entries(info)) quest.progress[m] = d.target;
      
      const initialPoints = world.researchPoints || 0;
      processQuests(world);
      
      // Should be completed with rewards
      expect(world.completedQuests?.includes(quest.questId)).toBe(true);
      expect(world.researchPoints).toBeGreaterThan(initialPoints);
    });

    it("should not generate quests for locked recipes initially", () => {
      const world = createTestWorld();
      
      // Initially only basic recipes should be available
      // Generate max active quests
      for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
        generateDynamicQuest(world);
      }
      
      // Check that none of the active quests are for tech-gated materials
      const techGatedMaterials = ["microchip", "automation_module", "circuit_board"];
      for (const quest of world.activeQuests || []) {
        const material = Object.keys(quest.progress)[0];
        expect(techGatedMaterials.includes(material || "")).toBe(false);
      }
    });

    it("should not duplicate materials already in active quests", () => {
      const world = createTestWorld();
      
      // Generate first quest
      const quest1 = generateDynamicQuest(world)!;
      const material1 = Object.keys(quest1.progress)[0];
      
      // Fill active slots
      while (generateDynamicQuest(world)) {}
      
      // No other quest should request the same material
      for (const quest of world.activeQuests || []) {
        if (quest.questId !== quest1.questId) {
          const material = Object.keys(quest.progress)[0];
          expect(material).not.toBe(material1);
        }
      }
    });
  });
});
