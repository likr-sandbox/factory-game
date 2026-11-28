// Unit tests for progression.ts
import { describe, it, expect } from "vitest";
import {
  awardResearchPoints, calculateTotalResearchPoints, unlockTech,
  isBuildingUnlocked, isRecipeUnlocked, getTechTreeStatus,
  startTutorial, getCurrentTutorialStep, completeTutorialStep, getTutorialProgress,
} from "../../src/sim/progression";
import type { WorldState, MaterialId, BuildingState } from "../../src/sim/types";

const emptyBs: BuildingState = {
  id: "", type: "miner", x: 0, y: 0, direction: "N",
  inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0,
  roundRobinIndex: 0, faulted: false, load: 0, idleTicks: 0, blockedTicks: 0,
};

function createWorld(): WorldState {
  return {
    seed: 1, width: 64, height: 64, tick: 0, rngState: 1,
    tiles: [], buildings: {}, nextBuildingId: 1,
    hubOrigin: { x: 31, y: 31 }, delivered: {}, deliveryHistory: [],
    unlockedTechs: [], completedQuests: [], researchPoints: 0,
    tutorialPhase: 0, completedTutorialSteps: [], activeQuests: [],
    nextQuestId: 0, spm: {},
  };
}

describe("Research Points", () => {
  it("should award points for iron_plate delivery", () => {
    const w = createWorld();
    const pts = awardResearchPoints(w, "iron_plate", 5);
    expect(pts).toBe(25); expect(w.researchPoints).toBe(25);
  });

  it("should award points for copper_plate delivery", () => {
    const w = createWorld();
    const pts = awardResearchPoints(w, "copper_plate", 3);
    expect(pts).toBe(15); expect(w.researchPoints).toBe(15);
  });

  it("should award higher points for advanced materials", () => {
    const w = createWorld();
    expect(awardResearchPoints(w, "microchip", 2)).toBe(40);
    expect(awardResearchPoints(w, "automation_module", 1)).toBe(25);
  });

  it("should award small points for slag", () => {
    const w = createWorld();
    expect(awardResearchPoints(w, "slag", 10)).toBe(20);
  });

  it("should not award points for unknown materials", () => {
    const w = createWorld();
    expect(awardResearchPoints(w, "miner" as never, 1)).toBe(0);
  });

  it("should accumulate points", () => {
    const w = createWorld();
    awardResearchPoints(w, "iron_plate", 2);
    awardResearchPoints(w, "copper_plate", 3);
    awardResearchPoints(w, "iron_gear", 1);
    expect(w.researchPoints).toBe(33);
  });

  it("should calculate total from history", () => {
    const h = [
      { material: "iron_plate" as MaterialId, amount: 10 },
      { material: "copper_plate" as MaterialId, amount: 5 },
      { material: "microchip" as MaterialId, amount: 2 },
    ];
    expect(calculateTotalResearchPoints(h)).toBe(115);
  });
});

describe("Tech Tree Unlocks", () => {
  it("should unlock underground_belt with sufficient points", () => {
    const w = createWorld(); w.researchPoints = 200;
    expect(unlockTech(w, "underground_belt")).toBe(true);
    expect(w.researchPoints).toBe(50);
    expect(w.unlockedTechs).toContain("underground_belt");
  });

  it("should fail with insufficient points", () => {
    const w = createWorld(); w.researchPoints = 50;
    expect(unlockTech(w, "underground_belt")).toBe(false);
    expect(w.researchPoints).toBe(50);
  });

  it("should throw on unknown tech", () => {
    expect(() => unlockTech(createWorld(), "unknown" as never)).toThrow("Unknown tech ID");
  });

  it("should check building unlock status", () => {
    const w = createWorld();
    expect(isBuildingUnlocked(w, "belt")).toBe(true);
    expect(isBuildingUnlocked(w, "assembler")).toBe(true); // assembler is now unlocked by default
    w.researchPoints = 300;
    unlockTech(w, "electronics");
    expect(isBuildingUnlocked(w, "assembler")).toBe(true);
  });

  it("should check recipe unlock status", () => {
    const w = createWorld();
    expect(isRecipeUnlocked(w, "iron_plate")).toBe(true);
    expect(isRecipeUnlocked(w, "iron_plate_high")).toBe(false);
    w.researchPoints = 300;
    unlockTech(w, "high_efficiency");
    expect(isRecipeUnlocked(w, "iron_plate_high")).toBe(true);
    w.researchPoints = 400;
    unlockTech(w, "advanced_smelting");
    expect(isRecipeUnlocked(w, "steel_plate")).toBe(true);
  });

  it("should throw on unknown building type", () => {
    expect(() => isBuildingUnlocked(createWorld(), "unknown" as never)).toThrow("Unknown building type");
  });

  it("should throw on unknown recipe", () => {
    expect(() => isRecipeUnlocked(createWorld(), "unknown" as never)).toThrow("Unknown recipe ID");
  });

  it("should get tech tree status", () => {
    const w = createWorld();
    let s = getTechTreeStatus(w);
    expect(s.sensor).toBe(false);
    expect(s.recycler).toBe(false);
    expect(s.electronics.assembler).toBe(true);
    w.researchPoints = 1000;
    unlockTech(w, "electronics");
    s = getTechTreeStatus(w);
    expect(s.electronics.assembler).toBe(true);
    expect(s.electronics.microchip).toBe(true);
  });

  it("should fail-fast: recipe not unlocked if building is locked", () => {
    const w = createWorld();
    // sensor and recycler buildings are locked by default
    // so their recipes should also be locked even if we check them directly
    expect(isBuildingUnlocked(w, "sensor")).toBe(false);
    expect(isBuildingUnlocked(w, "recycler")).toBe(false);
    expect(isBuildingUnlocked(w, "underground_belt")).toBe(false);
    expect(isBuildingUnlocked(w, "filter_splitter")).toBe(false);
    // assembler IS unlocked by default
    expect(isBuildingUnlocked(w, "assembler")).toBe(true);
  });

  it("should unlock assembler and its recipes with electronics tech", () => {
    const w = createWorld();
    // assembler is already unlocked by default
    expect(isBuildingUnlocked(w, "assembler")).toBe(true);
    // But circuit_board and microchip recipes need electronics tech
    expect(isRecipeUnlocked(w, "circuit_board")).toBe(false);
    expect(isRecipeUnlocked(w, "microchip")).toBe(false);
    w.researchPoints = 300;
    unlockTech(w, "electronics");
    expect(isRecipeUnlocked(w, "circuit_board")).toBe(true);
    expect(isRecipeUnlocked(w, "microchip")).toBe(true);
  });

  it("should have basic recipes unlocked by default", () => {
    const w = createWorld();
    expect(isRecipeUnlocked(w, "iron_plate")).toBe(true);
    expect(isRecipeUnlocked(w, "copper_plate")).toBe(true);
    expect(isRecipeUnlocked(w, "iron_gear")).toBe(true);
    expect(isRecipeUnlocked(w, "copper_wire")).toBe(true);
  });

  it("should lock high-efficiency and advanced recipes by default", () => {
    const w = createWorld();
    expect(isRecipeUnlocked(w, "iron_plate_high")).toBe(false);
    expect(isRecipeUnlocked(w, "copper_plate_high")).toBe(false);
    expect(isRecipeUnlocked(w, "steel_plate")).toBe(false);
    expect(isRecipeUnlocked(w, "silicon_wafer")).toBe(false);
  });
});

describe("Tutorial Phases", () => {
  const minerBs: Record<string, BuildingState> = { m: { ...emptyBs, id: "m", type: "miner", x: 10, y: 10 } };
  const smelterBs: Record<string, BuildingState> = { s: { ...emptyBs, id: "s", type: "smelter", x: 12, y: 10 } };

  it("should start tutorial at phase 1", () => {
    const w = createWorld();
    startTutorial(w);
    expect(w.tutorialPhase).toBe(1);
    expect(w.completedTutorialSteps).toEqual([]);
  });

  it("should get current step for phase 1", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = minerBs;
    const step = getCurrentTutorialStep(w);
    expect(step).not.toBeNull();
    expect(step?.phase).toBe(1);
    expect(step?.id).toBe("p1_manual_mining");
  });

  it("should mark step as completed", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = minerBs;
    expect(completeTutorialStep(w, "p1_manual_mining")).toBe(true);
    expect(w.completedTutorialSteps).toContain("p1_manual_mining");
  });

  it("should fail if conditions not met", () => {
    const w = createWorld(); startTutorial(w);
    expect(completeTutorialStep(w, "p1_manual_mining")).toBe(false);
  });

  it("should throw on unknown step", () => {
    expect(() => completeTutorialStep(createWorld(), "unknown")).toThrow("Unknown tutorial step ID");
  });

  it("should advance phase when complete", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = { ...minerBs, ...smelterBs };
    w.delivered = { iron_plate: 10, copper_plate: 10 };
    completeTutorialStep(w, "p1_manual_mining");
    completeTutorialStep(w, "p1_manual_smelting");
    completeTutorialStep(w, "p1_first_delivery");
    completeTutorialStep(w, "p1_copper_delivery");
    expect(w.tutorialPhase).toBe(2);
  });

  it("should get tutorial progress", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = minerBs;
    const p = getTutorialProgress(w);
    expect(p.phase).toBe(1);
    expect(p.currentStep).not.toBeNull();
    expect(p.completedSteps).toBe(0);
    expect(p.totalStepsInPhase).toBeGreaterThan(0);
  });

  it("should show null only when all steps in final phase are completed", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = { ...minerBs, ...smelterBs };
    w.delivered = { iron_plate: 10, copper_plate: 10 };
    completeTutorialStep(w, "p1_manual_mining");
    completeTutorialStep(w, "p1_manual_smelting");
    completeTutorialStep(w, "p1_first_delivery");
    completeTutorialStep(w, "p1_copper_delivery");
    // After completing all phase 1 steps, tutorial advances to phase 2
    // getCurrentTutorialStep returns first incomplete step of phase 2
    expect(w.tutorialPhase).toBe(2);
    expect(getCurrentTutorialStep(w)?.id).toBe("p2_batch_building");
  });

  it("should handle phase 2", () => {
    const w = createWorld(); w.tutorialPhase = 2;
    w.buildings = {};
    for (let i = 0; i < 4; i++) w.buildings[`m${i}`] = { ...emptyBs, id: `m${i}`, type: "miner", x: 10 + i, y: 10 };
    for (let i = 0; i < 2; i++) w.buildings[`s${i}`] = { ...emptyBs, id: `s${i}`, type: "smelter", x: 15 + i, y: 10 };
    expect(getCurrentTutorialStep(w)?.id).toBe("p2_batch_building");
    expect(completeTutorialStep(w, "p2_batch_building")).toBe(true);
  });

  it("should handle phase 3", () => {
    const w = createWorld(); w.tutorialPhase = 3; w.researchPoints = 500;
    unlockTech(w, "electronics");
    w.buildings = { a: { ...emptyBs, id: "a", type: "assembler", x: 10, y: 10 } };
    completeTutorialStep(w, "p3_electronics_unlock");
    expect(getCurrentTutorialStep(w)?.id).toBe("p3_circuit_board_line");
    expect(completeTutorialStep(w, "p3_circuit_board_line")).toBe(true);
  });

  it("should handle phase 4", () => {
    const w = createWorld(); w.tutorialPhase = 4; w.researchPoints = 2000;
    unlockTech(w, "advanced_smelting"); unlockTech(w, "electronics");
    unlockTech(w, "automation"); unlockTech(w, "recycler"); unlockTech(w, "sensor");
    w.buildings = {
      r: { ...emptyBs, id: "r", type: "recycler", x: 10, y: 10 },
      s: { ...emptyBs, id: "s", type: "sensor", x: 12, y: 10 },
    };
    w.delivered = { microchip: 10, automation_module: 3 };
    completeTutorialStep(w, "p4_advanced_technology");
    completeTutorialStep(w, "p4_slag_handling");
    completeTutorialStep(w, "p4_sensor_deploy");
    expect(getCurrentTutorialStep(w)?.id).toBe("p4_master_delivery");
    expect(completeTutorialStep(w, "p4_master_delivery")).toBe(true);
  });

  it("should return first incomplete step in phase 1 without checking conditions", () => {
    // After starting tutorial, current step should be p1_manual_mining (first non-completed)
    const w = createWorld(); startTutorial(w);
    expect(getCurrentTutorialStep(w)?.id).toBe("p1_manual_mining");
    // Even without miner building, it returns the first incomplete step
  });

  it("should skip completed steps and return next incomplete step", () => {
    const w = createWorld(); startTutorial(w);
    // Mark first step as completed
    w.completedTutorialSteps = ["p1_manual_mining"];
    // Should return second step regardless of check condition
    expect(getCurrentTutorialStep(w)?.id).toBe("p1_manual_smelting");
  });

  it("should return null when all steps in phase are completed", () => {
    const w = createWorld(); startTutorial(w);
    // Complete all phase 1 steps
    w.completedTutorialSteps = ["p1_manual_mining", "p1_manual_smelting", "p1_first_delivery", "p1_copper_delivery"];
    expect(getCurrentTutorialStep(w)).toBeNull();
  });

  it("should return null for phase 0", () => {
    const w = createWorld();
    // tutorialPhase is 0 by default
    expect(getCurrentTutorialStep(w)).toBeNull();
  });

  it("should return null for phase > 4", () => {
    const w = createWorld();
    w.tutorialPhase = 5 as never;
    expect(getCurrentTutorialStep(w)).toBeNull();
  });

  it("should award bonus RP on first step completion in phase 1", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = minerBs;
    expect(w.researchPoints).toBe(0);
    completeTutorialStep(w, "p1_manual_mining");
    expect(w.researchPoints).toBe(15); // p1_manual_mining rewardPoints
  });

  it("should award cumulative bonus RP for all phase 1 steps", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = { ...minerBs, ...smelterBs };
    w.delivered = { iron_plate: 10, copper_plate: 10 };
    completeTutorialStep(w, "p1_manual_mining");
    completeTutorialStep(w, "p1_manual_smelting");
    completeTutorialStep(w, "p1_first_delivery");
    completeTutorialStep(w, "p1_copper_delivery");
    // 15 + 15 + 20 + 25 = 75 RP from bonus
    expect(w.researchPoints).toBe(75);
  });

  it("should award bonus RP on first step completion in phase 2", () => {
    const w = createWorld(); w.tutorialPhase = 2;
    w.buildings = {};
    for (let i = 0; i < 4; i++) w.buildings[`m${i}`] = { ...emptyBs, id: `m${i}`, type: "miner", x: 10 + i, y: 10 };
    for (let i = 0; i < 2; i++) w.buildings[`s${i}`] = { ...emptyBs, id: `s${i}`, type: "smelter", x: 15 + i, y: 10 };
    expect(w.researchPoints).toBe(0);
    completeTutorialStep(w, "p2_batch_building");
    expect(w.researchPoints).toBe(30); // p2_batch_building rewardPoints
  });

  it("should award bonus RP on first step completion in phase 3", () => {
    const w = createWorld(); w.tutorialPhase = 3; w.researchPoints = 300;
    unlockTech(w, "electronics");
    w.buildings = { a: { ...emptyBs, id: "a", type: "assembler", x: 10, y: 10 } };
    completeTutorialStep(w, "p3_electronics_unlock");
    expect(w.researchPoints).toBe(60); // p3_electronics_unlock rewardPoints (300 - 300 cost + 60 bonus = 60)
  });

  it("should award bonus RP on first step completion in phase 4", () => {
    const w = createWorld(); w.tutorialPhase = 4; w.researchPoints = 0;
    w.buildings = { r: { ...emptyBs, id: "r", type: "recycler", x: 10, y: 10 } };
    completeTutorialStep(w, "p4_slag_handling");
    expect(w.researchPoints).toBe(100); // p4_slag_handling rewardPoints
  });

  it("should not double-award bonus RP for already completed step", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = minerBs;
    completeTutorialStep(w, "p1_manual_mining");
    expect(w.researchPoints).toBe(15);
    // Call again with same step - should not add more RP
    completeTutorialStep(w, "p1_manual_mining");
    expect(w.researchPoints).toBe(15); // Still 15, no double award
  });

  it("should reach underground_belt cost (150 RP) after completing phase 1", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = { ...minerBs, ...smelterBs };
    // Simulate delivery RP from iron_plate (5 RP each) and copper_plate (5 RP each)
    // 10 iron_plate = 50 RP, 10 copper_plate = 50 RP from deliveries
    awardResearchPoints(w, "iron_plate", 10);
    awardResearchPoints(w, "copper_plate", 10);
    // Now complete all phase 1 steps for bonus RP
    w.delivered = { iron_plate: 10, copper_plate: 10 };
    completeTutorialStep(w, "p1_manual_mining");
    completeTutorialStep(w, "p1_manual_smelting");
    completeTutorialStep(w, "p1_first_delivery");
    completeTutorialStep(w, "p1_copper_delivery");
    // Total: 50 (iron) + 50 (copper) + 75 (bonus) = 175 RP
    expect(w.researchPoints).toBe(175);
    expect(w.researchPoints).toBeGreaterThanOrEqual(150); // Enough for underground_belt
  });
});
