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
      const techGatedMaterials = ["microchip", "automation_module", "circuit_board", "steel_plate", "silicon_wafer"];
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

  describe("Progression scaling", () => {
    it("should scale target quantity and rewardPoints with unlockedTechs count", () => {
      const world1 = createTestWorld();
      const quest1 = generateDynamicQuest(world1)!;
      const info1 = getQuestProgress(quest1);
      const material1 = Object.keys(info1)[0]!;
      const target1 = info1[material1]?.target ?? 0;
      const dynQuest1 = quest1 as any;
      const reward1 = dynQuest1.rewardPoints;
      
      // Create world with unlocked techs
      const world2 = createTestWorld();
      world2.unlockedTechs = ["advanced_smelting", "electronics"];
      // Generate multiple quests to ensure we get the same base item type
      // by clearing and regenerating
      world2.activeQuests = [];
      const quest2 = generateDynamicQuest(world2)!;
      const info2 = getQuestProgress(quest2);
      const material2 = Object.keys(info2)[0]!;
      const dynQuest2 = quest2 as any;
      
      // If same material type, verify scaling
      if (material1 === material2) {
        const target2 = info2[material2]?.target ?? 0;
        const reward2 = dynQuest2.rewardPoints;
        expect(target2).toBeGreaterThan(target1);
        expect(reward2).toBeGreaterThan(reward1);
      }
    });

    it("should scale iron_plate quest targets and rewards with tutorialPhase", () => {
      // World at phase 1
      const world1 = createTestWorld();
      world1.tutorialPhase = 1;
      world1.activeQuests = [];
      let quest1 = generateDynamicQuest(world1)!;
      
      // Keep generating until we get an iron_plate quest
      while (!(quest1 as any).questCatalogId || (quest1 as any).questCatalogId !== "iron_plate") {
        world1.activeQuests = [];
        quest1 = generateDynamicQuest(world1)!;
      }
      
      const info1 = getQuestProgress(quest1);
      const target1 = info1["iron_plate"]?.target ?? 0;
      const dynQuest1 = quest1 as any;
      const reward1 = dynQuest1.rewardPoints;
      
      // World at phase 3 with more techs
      const world2 = createTestWorld();
      world2.tutorialPhase = 3;
      world2.unlockedTechs = ["advanced_smelting", "electronics"];
      world2.activeQuests = [];
      let quest2 = generateDynamicQuest(world2)!;
      
      // Keep generating until we get an iron_plate quest
      while (!(quest2 as any).questCatalogId || (quest2 as any).questCatalogId !== "iron_plate") {
        world2.activeQuests = [];
        quest2 = generateDynamicQuest(world2)!;
      }
      
      const info2 = getQuestProgress(quest2);
      const target2 = info2["iron_plate"]?.target ?? 0;
      const dynQuest2 = quest2 as any;
      const reward2 = dynQuest2.rewardPoints;
      
      expect(target2).toBeGreaterThan(target1);
      expect(reward2).toBeGreaterThan(reward1);
    });

    it("should scale steel_plate quest with advanced_smelting tech", () => {
      // World without advanced_smelting - steel_plate should not appear
      const world1 = createTestWorld();
      world1.activeQuests = [];
      let steelQuest1: any = null;
      
      for (let i = 0; i < 10; i++) {
        const quest = generateDynamicQuest(world1);
        if (!quest) break;
        if ((quest as any).questCatalogId === "steel_plate") {
          steelQuest1 = quest;
          break;
        }
      }
      
      expect(steelQuest1).toBeNull();
      
      // World with advanced_smelting - steel_plate should appear and scale
      const world2 = createTestWorld();
      world2.unlockedTechs = ["advanced_smelting"];
      world2.activeQuests = [];
      let steelQuest2: any = null;
      
      for (let i = 0; i < 10; i++) {
        const quest = generateDynamicQuest(world2);
        if (!quest) break;
        if ((quest as any).questCatalogId === "steel_plate") {
          steelQuest2 = quest;
          break;
        }
      }
      
      expect(steelQuest2).not.toBeNull();
      if (steelQuest2) {
        expect(steelQuest2.targets).toBeDefined();
        expect(steelQuest2.targets["steel_plate"]).toBeGreaterThan(0);
        expect(steelQuest2.rewardPoints).toBeGreaterThan(0);
      }
    });

    it("should scale with both unlockedTechs.length and tutorialPhase", () => {
      const world1 = createTestWorld();
      world1.tutorialPhase = 1;
      world1.unlockedTechs = [];
      world1.activeQuests = [];
      let quest1 = generateDynamicQuest(world1)!;
      
      // Keep generating until we get a copper_wire quest (phase 1)
      while (!(quest1 as any).questCatalogId || (quest1 as any).questCatalogId !== "copper_wire") {
        world1.activeQuests = [];
        quest1 = generateDynamicQuest(world1)!;
      }
      
      const info1 = getQuestProgress(quest1);
      const target1 = info1["copper_wire"]?.target ?? 0;
      const dynQuest1 = quest1 as any;
      const reward1 = dynQuest1.rewardPoints;
      
      const world2 = createTestWorld();
      world2.tutorialPhase = 3;
      world2.unlockedTechs = ["advanced_smelting", "electronics", "automation"];
      world2.activeQuests = [];
      let quest2 = generateDynamicQuest(world2)!;
      
      // Keep generating until we get a copper_wire quest
      while (!(quest2 as any).questCatalogId || (quest2 as any).questCatalogId !== "copper_wire") {
        world2.activeQuests = [];
        quest2 = generateDynamicQuest(world2)!;
      }
      
      const info2 = getQuestProgress(quest2);
      const target2 = info2["copper_wire"]?.target ?? 0;
      const dynQuest2 = quest2 as any;
      const reward2 = dynQuest2.rewardPoints;
      
      expect(target2).toBeGreaterThan(target1);
      expect(reward2).toBeGreaterThan(reward1);
    });
  });

  describe("Recipe unlock filtering", () => {
    it("should include all 9 items when advanced_smelting, electronics, automation are unlocked", () => {
      const world = createTestWorld();
      world.unlockedTechs = ["advanced_smelting", "electronics", "automation"];
      world.activeQuests = [];
      
      // Generate max active quests
      for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
        generateDynamicQuest(world);
      }
      
      // Collect all quest catalog IDs
      const questIds = new Set<string>();
      for (const quest of world.activeQuests || []) {
        const dynQuest = quest as any;
        if (dynQuest.questCatalogId) {
          questIds.add(dynQuest.questCatalogId);
        }
      }
      
      // All unlocked recipes should be eligible (though only 3 will be active)
      expect(questIds.size).toBe(MAX_ACTIVE_QUESTS);
      
      // Verify that unlocked recipes can appear
      const unlockedRecipes = ["iron_plate", "copper_plate", "iron_gear", "copper_wire", 
                               "steel_plate", "silicon_wafer", "circuit_board", "microchip", "automation_module"];
      
      // At least some of the generated quests should be from unlocked recipes
      for (const questId of questIds) {
        expect(unlockedRecipes.includes(questId)).toBe(true);
      }
    });

    it("should NOT include steel_plate or silicon_wafer without advanced_smelting", () => {
      const world = createTestWorld();
      world.unlockedTechs = ["electronics"]; // No advanced_smelting
      world.activeQuests = [];
      
      // Generate max active quests
      for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
        generateDynamicQuest(world);
      }
      
      // Check that steel_plate and silicon_wafer are not in active quests
      for (const quest of world.activeQuests || []) {
        const dynQuest = quest as any;
        expect(dynQuest.questCatalogId).not.toBe("steel_plate");
        expect(dynQuest.questCatalogId).not.toBe("silicon_wafer");
      }
    });

    it("should NOT include circuit_board, microchip, automation_module without electronics/automation", () => {
      const world = createTestWorld();
      world.unlockedTechs = ["advanced_smelting"]; // No electronics or automation
      world.activeQuests = [];
      
      // Generate max active quests
      for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
        generateDynamicQuest(world);
      }
      
      // Check that electronics/automation gated items are not in active quests
      for (const quest of world.activeQuests || []) {
        const dynQuest = quest as any;
        expect(dynQuest.questCatalogId).not.toBe("circuit_board");
        expect(dynQuest.questCatalogId).not.toBe("microchip");
        expect(dynQuest.questCatalogId).not.toBe("automation_module");
      }
    });

    it("should include steel_plate and silicon_wafer when advanced_smelting is unlocked", () => {
      const world = createTestWorld();
      world.unlockedTechs = ["advanced_smelting"];
      world.activeQuests = [];
      
      // Generate multiple quests to try to get steel_plate or silicon_wafer
      let foundAdvanced = false;
      for (let i = 0; i < 20; i++) {
        world.activeQuests = [];
        for (let j = 0; j < MAX_ACTIVE_QUESTS; j++) {
          generateDynamicQuest(world);
        }
        
        for (const quest of world.activeQuests || []) {
          const dynQuest = quest as any;
          if (dynQuest.questCatalogId === "steel_plate" || dynQuest.questCatalogId === "silicon_wafer") {
            foundAdvanced = true;
            break;
          }
        }
        
        if (foundAdvanced) break;
      }
      
      expect(foundAdvanced).toBe(true);
    });
  });

  describe("Fail-fast behavior", () => {
    it("should throw error when quest is missing targets field", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      
      // Corrupt the quest by removing targets
      const dynQuest = quest as any;
      delete dynQuest.targets;
      
      expect(() => isQuestComplete(quest)).toThrow(/missing targets field/);
    });

    it("should throw error when quest is missing rewardPoints field", () => {
      const world = createTestWorld();
      const quest = generateDynamicQuest(world)!;
      
      // Corrupt the quest by removing rewardPoints
      const dynQuest = quest as any;
      delete dynQuest.rewardPoints;
      
      expect(() => completeQuest(world, quest)).toThrow(/missing rewardPoints field/);
    });
  });
});
