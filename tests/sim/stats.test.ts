import { describe, it, expect, beforeEach } from "vitest";
import {
  TICKS_PER_MINUTE,
  recordDelivery,
  calculateSpm,
  updateSpmStats,
  getSpmSummary,
  resetSpmWindow,
  initializeFromHistory,
} from "../../src/sim/stats";
import type { WorldState, DeliveryRecord } from "../../src/sim/types";

const makeWorld = (tick = 100): WorldState => ({
  seed: 42, width: 10, height: 10, tick, rngState: 123, tiles: [],
  buildings: {}, nextBuildingId: 0, hubOrigin: { x: 0, y: 0 },
  delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [],
});

describe("SPM Statistics", () => {
  beforeEach(() => resetSpmWindow());

  describe("recordDelivery", () => {
    it("should record a single delivery", () => {
      recordDelivery(100, "automation_module", 5);
      const summary = calculateSpm(100);
      expect(summary.perMaterial.automation_module).toBe(5);
      expect(summary.totalSpm).toBe(5);
    });

    it("should aggregate deliveries at the same tick", () => {
      recordDelivery(100, "automation_module", 3);
      recordDelivery(100, "automation_module", 2);
      expect(calculateSpm(100).perMaterial.automation_module).toBe(5);
    });

    it("should prune old deliveries outside the window", () => {
      recordDelivery(0, "automation_module", 10);
      recordDelivery(TICKS_PER_MINUTE + 1, "automation_module", 5);
      const summary = calculateSpm(TICKS_PER_MINUTE + 1);
      expect(summary.perMaterial.automation_module).toBe(5);
    });

    it("should not count non-final/non-electronic materials", () => {
      recordDelivery(100, "iron_plate", 100);
      recordDelivery(100, "automation_module", 3);
      const summary = calculateSpm(100);
      expect(summary.perMaterial.iron_plate).toBeUndefined();
      expect(summary.perMaterial.automation_module).toBe(3);
    });
  });

  describe("calculateSpm", () => {
    it("should return zero SPM for empty window", () => {
      const summary = calculateSpm(100);
      expect(summary.totalSpm).toBe(0);
      expect(summary.perMaterial).toEqual({});
    });

    it("should calculate SPM correctly within window", () => {
      recordDelivery(0, "automation_module", 60);
      recordDelivery(TICKS_PER_MINUTE - 1, "automation_module", 40);
      expect(calculateSpm(TICKS_PER_MINUTE - 1).totalSpm).toBe(100);
    });

    it("should track per-material SPM", () => {
      recordDelivery(100, "automation_module", 5);
      recordDelivery(100, "microchip", 3);
      const summary = calculateSpm(100);
      expect(summary.perMaterial.automation_module).toBe(5);
      expect(summary.perMaterial.microchip).toBe(3);
      expect(summary.totalSpm).toBe(8);
    });

    it("should return correct window boundaries", () => {
      recordDelivery(100, "automation_module", 5);
      const summary = calculateSpm(700);
      expect(summary.windowStartTick).toBe(100);
      expect(summary.windowEndTick).toBe(700);
    });
  });

  describe("updateSpmStats", () => {
    it("should update world.spm with current stats", () => {
      recordDelivery(100, "automation_module", 10);
      const world = makeWorld(100);
      updateSpmStats(world);
      expect(world.spm).toBeDefined();
      expect((world.spm as Record<string, number>).automation_module).toBe(10);
      expect((world.spm as Record<string, number>).total).toBe(10);
    });
  });

  describe("getSpmSummary", () => {
    it("should return complete summary", () => {
      recordDelivery(100, "automation_module", 5);
      const summary = getSpmSummary(makeWorld(100));
      expect(summary.totalSpm).toBe(5);
      expect(summary.perMaterial.automation_module).toBe(5);
    });
  });

  describe("initializeFromHistory", () => {
    it("should populate window from delivery history", () => {
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 10 },
        { tick: 100, material: "automation_module", amount: 20 },
        { tick: 200, material: "microchip", amount: 5 },
      ];
      initializeFromHistory(history, 300);
      const summary = calculateSpm(300);
      expect(summary.perMaterial.automation_module).toBe(30);
      expect(summary.perMaterial.microchip).toBe(5);
      expect(summary.totalSpm).toBe(35);
    });

    it("should filter history outside the window", () => {
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 100 },
        { tick: TICKS_PER_MINUTE + 100, material: "automation_module", amount: 20 },
      ];
      initializeFromHistory(history, TICKS_PER_MINUTE + 100);
      expect(calculateSpm(TICKS_PER_MINUTE + 100).perMaterial.automation_module).toBe(20);
    });

    it("should reset existing window data", () => {
      recordDelivery(50, "automation_module", 50);
      initializeFromHistory([{ tick: 100, material: "microchip", amount: 10 }], 200);
      const summary = calculateSpm(200);
      expect(summary.perMaterial.automation_module).toBeUndefined();
      expect(summary.perMaterial.microchip).toBe(10);
    });
  });
});
