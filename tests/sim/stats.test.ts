import { describe, it, expect } from "vitest";
import {
  calculateSpm,
  updateSpmStats,
  getSpmSummary,
  TICKS_PER_MINUTE,
} from "../../src/sim/stats";
import type { WorldState, DeliveryRecord } from "../../src/sim/types";

const makeWorld = (tick = 100, deliveryHistory?: DeliveryRecord[]): WorldState => ({
  seed: 42, width: 10, height: 10, tick, rngState: 123, tiles: [],
  buildings: {}, nextBuildingId: 0, hubOrigin: { x: 0, y: 0 },
  delivered: {}, deliveryHistory: deliveryHistory ?? [], unlockedTechs: [], completedQuests: [],
});

describe("SPM Statistics", () => {
  describe("calculateSpm (pure function)", () => {
    it("should return zero SPM for empty history", () => {
      const summary = calculateSpm([], 100);
      expect(summary.totalSpm).toBe(0);
      expect(summary.perMaterial).toEqual({});
    });

    it("should calculate SPM correctly with default window (TICKS_PER_MINUTE)", () => {
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 60 },
        { tick: 100, material: "automation_module", amount: 40 },
      ];
      const summary = calculateSpm(history, TICKS_PER_MINUTE - 1);
      expect(summary.totalSpm).toBe(100);
      expect(summary.perMaterial.automation_module).toBe(100);
    });

    it("should filter history outside the window", () => {
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 100 },
        { tick: TICKS_PER_MINUTE + 100, material: "automation_module", amount: 20 },
      ];
      const summary = calculateSpm(history, TICKS_PER_MINUTE + 100);
      // Only the entry at tick 100+ should be in window [100, 100+TICKS_PER_MINUTE]
      expect(summary.perMaterial.automation_module).toBe(20);
    });

    it("should not count non-final/non-electronic materials", () => {
      const history: DeliveryRecord[] = [
        { tick: 100, material: "iron_plate", amount: 100 },
        { tick: 100, material: "automation_module", amount: 3 },
      ];
      const summary = calculateSpm(history, 100);
      expect(summary.perMaterial.iron_plate).toBeUndefined();
      expect(summary.perMaterial.automation_module).toBe(3);
    });

    it("should normalize to per-minute rate when windowTicks != TICKS_PER_MINUTE", () => {
      // Deliver 30 automation_modules in 30 ticks -> scale = 3600/30 = 120, so 30 * 120 = 3600 spm
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 30 },
      ];
      const summary = calculateSpm(history, 30, 30);
      expect(summary.totalSpm).toBe(3600);
      expect(summary.perMaterial.automation_module).toBe(3600);
    });

    it("should throw error for invalid windowTicks", () => {
      const history: DeliveryRecord[] = [{ tick: 100, material: "automation_module", amount: 5 }];
      
      expect(() => calculateSpm(history, 100, 0)).toThrow("windowTicks must be a positive finite number");
      expect(() => calculateSpm(history, 100, -100)).toThrow("windowTicks must be a positive finite number");
      expect(() => calculateSpm(history, 100, Infinity)).toThrow("windowTicks must be a positive finite number");
      expect(() => calculateSpm(history, 100, NaN)).toThrow("windowTicks must be a positive finite number");
    });

    it("should track multiple materials correctly", () => {
      const history: DeliveryRecord[] = [
        { tick: 100, material: "automation_module", amount: 5 },
        { tick: 100, material: "microchip", amount: 3 },
      ];
      const summary = calculateSpm(history, 100);
      expect(summary.perMaterial.automation_module).toBe(5);
      expect(summary.perMaterial.microchip).toBe(3);
      expect(summary.totalSpm).toBe(8);
    });

    it("should return correct window boundaries", () => {
      const history: DeliveryRecord[] = [{ tick: 100, material: "automation_module", amount: 5 }];
      const summary = calculateSpm(history, 700);
      // With default windowTicks = TICKS_PER_MINUTE = 3600, windowStartTick = max(0, 700-3600) = 0
      expect(summary.windowStartTick).toBe(0);
      expect(summary.windowEndTick).toBe(700);
    });

    it("should handle custom window size", () => {
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 60 },
        { tick: 100, material: "automation_module", amount: 40 },
      ];
      // With windowTicks=200, both entries are within [0, 200]
      const summary = calculateSpm(history, 200, 200);
      // Scale factor = 3600/200 = 18, so total = 100 * 18 = 1800
      expect(summary.totalSpm).toBe(1800);
      expect(summary.perMaterial.automation_module).toBe(1800);
    });
  });

  describe("updateSpmStats", () => {
    it("should update world.spm using deliveryHistory", () => {
      const history: DeliveryRecord[] = [
        { tick: 100, material: "automation_module", amount: 10 },
      ];
      const world = makeWorld(100, history);
      updateSpmStats(world);
      expect(world.spm).toBeDefined();
      expect((world.spm as Record<string, number>).automation_module).toBe(10);
      expect((world.spm as Record<string, number>).total).toBe(10);
    });

    it("should support custom windowTicks", () => {
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 30 },
      ];
      const world = makeWorld(30, history);
      updateSpmStats(world, 30);
      // Scale = 3600/30 = 120, so 30 * 120 = 3600 spm
      expect((world.spm as Record<string, number>).total).toBe(3600);
    });
  });

  describe("getSpmSummary", () => {
    it("should return complete summary from deliveryHistory", () => {
      const history: DeliveryRecord[] = [
        { tick: 100, material: "automation_module", amount: 5 },
      ];
      const world = makeWorld(100, history);
      const summary = getSpmSummary(world);
      expect(summary.totalSpm).toBe(5);
      expect(summary.perMaterial.automation_module).toBe(5);
    });

    it("should support custom windowTicks", () => {
      const history: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 30 },
      ];
      const world = makeWorld(30, history);
      const summary = getSpmSummary(world, 30);
      expect(summary.totalSpm).toBe(3600);
    });
  });

  describe("World isolation (no global state leakage)", () => {
    it("should not leak state between different world instances", () => {
      const history1: DeliveryRecord[] = [
        { tick: 100, material: "automation_module", amount: 10 },
      ];
      const history2: DeliveryRecord[] = [
        { tick: 100, material: "microchip", amount: 5 },
      ];

      const world1 = makeWorld(100, history1);
      const world2 = makeWorld(100, history2);

      const summary1 = getSpmSummary(world1);
      const summary2 = getSpmSummary(world2);

      expect(summary1.perMaterial.automation_module).toBe(10);
      expect(summary1.perMaterial.microchip).toBeUndefined();
      expect(summary2.perMaterial.automation_module).toBeUndefined();
      expect(summary2.perMaterial.microchip).toBe(5);
    });

    it("should handle independent delivery histories correctly", () => {
      const historyA: DeliveryRecord[] = [
        { tick: 0, material: "automation_module", amount: 100 },
      ];
      const historyB: DeliveryRecord[] = [
        { tick: 0, material: "microchip", amount: 50 },
        { tick: 100, material: "microchip", amount: 50 },
      ];

      const worldA = makeWorld(TICKS_PER_MINUTE, historyA);
      const worldB = makeWorld(TICKS_PER_MINUTE, historyB);

      const summaryA = getSpmSummary(worldA);
      const summaryB = getSpmSummary(worldB);

      expect(summaryA.totalSpm).toBe(100);
      expect(summaryB.totalSpm).toBe(100);
      expect(summaryA.perMaterial.automation_module).toBe(100);
      expect(summaryB.perMaterial.microchip).toBe(100);
    });
  });
});
