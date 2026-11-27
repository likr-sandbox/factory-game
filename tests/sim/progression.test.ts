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
    expect(isBuildingUnlocked(w, "assembler")).toBe(false);
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
    expect(s.sensor).toBe(true);
    expect(s.recycler).toBe(true);
    expect(s.electronics.assembler).toBe(false);
    w.researchPoints = 1000;
    unlockTech(w, "electronics");
    s = getTechTreeStatus(w);
    expect(s.electronics.assembler).toBe(true);
    expect(s.electronics.microchip).toBe(true);
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

  it("should show null when phase complete", () => {
    const w = createWorld(); startTutorial(w);
    w.buildings = { ...minerBs, ...smelterBs };
    w.delivered = { iron_plate: 10, copper_plate: 10 };
    completeTutorialStep(w, "p1_manual_mining");
    completeTutorialStep(w, "p1_manual_smelting");
    completeTutorialStep(w, "p1_first_delivery");
    completeTutorialStep(w, "p1_copper_delivery");
    expect(getCurrentTutorialStep(w)).toBeNull();
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
});
