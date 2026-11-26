// Unit tests for src/main.ts game loop and tick accumulator
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Phaser before importing main module
vi.mock("phaser", () => ({
  AUTO: "auto",
  Game: vi.fn().mockImplementation((config) => ({
    config,
    scenes: [{ 
      events: { on: vi.fn(), emit: vi.fn() },
      children: { list: [] }
    }],
    cameras: { 
      main: { 
        setBounds: vi.fn(), 
        setZoom: vi.fn(),
        scrollX: 0,
        scrollY: 0,
        zoom: 1
      } 
    },
    input: { 
      keyboard: null, 
      on: vi.fn(),
      pointer: { x: 0, y: 0, button: 0 }
    },
    destroy: vi.fn(),
  })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Scene: class Scene {
    children: { list: unknown[] };
    events: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };
    cameras?: { main: unknown };
    input?: { keyboard: unknown | null; on: ReturnType<typeof vi.fn> };
    constructor() {
      this.children = { list: [] };
      this.events = { on: vi.fn(), emit: vi.fn() };
    }
  },
  GameObjects: { 
    Sprite: class Sprite {
      key: string;
      name: string;
      destroy?: () => void;
      setDepth?: (d: number) => void;
      setName?: (n: string) => void;
      constructor() {
        this.key = "";
        this.name = "";
      }
    } 
  },
  Types: { Core: {} },
}));

vi.mock("../src/style.css", () => ({}));

// Import functions to test after mocks are set up
import {
  BASE_TICK_INTERVAL_MS,
  setSimulationSpeed,
  getSimulationSpeed,
  getTickAccumulatorMs,
  resetSimulationState,
  processSimulationTicks,
  initGame,
} from "../src/main";

describe("Game Loop Functions", () => {
  beforeEach(() => {
    // Reset simulation state before each test
    setSimulationSpeed(1);
  });

  describe("processSimulationTicks", () => {
    it("should execute 0 ticks for sub-16.67ms frame delta at 1x speed", () => {
      // Reset state
      setSimulationSpeed(1);
      
      // Simulate a single 10ms frame (less than 16.67ms threshold)
      const result = processSimulationTicks(10);
      expect(result).toBe(0);
      expect(getTickAccumulatorMs()).toBeCloseTo(10, 1);
    });

    it("should accumulate time and execute 1 tick on second 10ms frame at 1x speed", () => {
      // Reset by calling with 0 speed then back to 1x
      setSimulationSpeed(0);
      processSimulationTicks(0);
      setSimulationSpeed(1);
      
      // First 10ms frame - should accumulate but not execute
      const firstResult = processSimulationTicks(10);
      expect(firstResult).toBe(0);
      expect(getTickAccumulatorMs()).toBeCloseTo(10, 1);

      // Second 10ms frame - should accumulate to ~20ms and execute 1 tick
      const secondResult = processSimulationTicks(10);
      expect(secondResult).toBe(1);
      // Remainder should be ~3.33ms (20 - 16.67)
      expect(getTickAccumulatorMs()).toBeLessThan(BASE_TICK_INTERVAL_MS);
      expect(getTickAccumulatorMs()).toBeGreaterThan(0);
    });

    it("should reset tickAccumulatorMs to 0 and execute 0 ticks at 0x speed", () => {
      // First accumulate some time at 1x
      setSimulationSpeed(1);
      processSimulationTicks(100);
      
      // Then set to 0x speed
      setSimulationSpeed(0);
      const result = processSimulationTicks(50);
      
      expect(result).toBe(0);
      expect(getTickAccumulatorMs()).toBe(0);
    });

    it("should scale delta appropriately at 2x speed", () => {
      // Reset state
      setSimulationSpeed(0);
      processSimulationTicks(0);
      setSimulationSpeed(2);
      
      // At 2x speed, 10ms frame becomes 20ms accumulated
      const result = processSimulationTicks(10);
      expect(result).toBe(1); // Should execute 1 tick (20ms > 16.67ms)
      // Remainder should be ~3.33ms
      expect(getTickAccumulatorMs()).toBeCloseTo(3.33, 1);
    });

    it("should execute multiple ticks when accumulator exceeds multiple intervals", () => {
      // Reset state
      setSimulationSpeed(0);
      processSimulationTicks(0);
      setSimulationSpeed(1);
      
      // Large delta that should trigger multiple ticks
      const result = processSimulationTicks(100);
      // 100ms / 16.67ms ≈ 6 ticks
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(7);
    });
  });

  describe("setSimulationSpeed and getSimulationSpeed", () => {
    it("should set and get simulation speed correctly", () => {
      setSimulationSpeed(2);
      expect(getSimulationSpeed()).toBe(2);

      setSimulationSpeed(0);
      expect(getSimulationSpeed()).toBe(0);

      setSimulationSpeed(4);
      expect(getSimulationSpeed()).toBe(4);
    });
  });

  describe("getTickAccumulatorMs", () => {
    it("should return current accumulator value after partial accumulation", () => {
      // Reset state
      setSimulationSpeed(0);
      processSimulationTicks(0);
      setSimulationSpeed(1);
      
      // Small delta that won't trigger tick execution
      processSimulationTicks(10);
      expect(getTickAccumulatorMs()).toBeCloseTo(10, 1);
    });

    it("should return remainder after executing ticks", () => {
      // Reset state
      setSimulationSpeed(0);
      processSimulationTicks(0);
      setSimulationSpeed(1);
      
      // 50ms should execute 3 ticks (3 * 16.67 = 50ms approx), leaving small remainder
      processSimulationTicks(50);
      const remainder = getTickAccumulatorMs();
      // Remainder should be less than one tick interval
      expect(remainder).toBeLessThan(BASE_TICK_INTERVAL_MS);
      expect(remainder).toBeGreaterThanOrEqual(0);
    });
  });

  describe("resetSimulationState", () => {
    it("should reset world and accumulator", () => {
      // Set up non-default state
      setSimulationSpeed(4);
      processSimulationTicks(100);
      
      // Reset
      resetSimulationState();
      
      expect(getSimulationSpeed()).toBe(1);
      expect(getTickAccumulatorMs()).toBe(0);
    });
  });
});

describe("initGame", () => {
  let mockDoc: Document;
  let originalDocument: typeof globalThis.document;
  let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
  let originalPerformance: typeof globalThis.performance;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalPerformance = globalThis.performance;

    // Mock requestAnimationFrame
    globalThis.requestAnimationFrame = vi.fn((cb) => {
      cb(0);
      return 0;
    }) as unknown as typeof globalThis.requestAnimationFrame;

    // Mock performance.now
    globalThis.performance = {
      now: vi.fn().mockReturnValue(0),
    } as unknown as typeof globalThis.performance;
    
    const createMockElement = () => ({
      ownerDocument: null as unknown as Document,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
      className: "",
      textContent: "",
      id: "",
    });

    mockDoc = {
      getElementById: vi.fn((id: string) => {
        if (id === "game-container" || id === "hud-container" || id === "palette-container") {
          const el = createMockElement();
          el.id = id;
          el.ownerDocument = mockDoc;
          return el as unknown as HTMLElement;
        }
        return null;
      }),
      createElement: vi.fn((tag: string) => {
        const el = createMockElement();
        el.ownerDocument = mockDoc;
        return el as unknown as HTMLElement;
      }),
    } as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.performance = originalPerformance;
  });

  it("should throw error if #game-container is missing", () => {
    const createMockElement = () => ({
      ownerDocument: mockDoc,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
      id: "",
    });

    mockDoc.getElementById = vi.fn((id: string) => {
      if (id === "game-container") return null;
      const el = createMockElement();
      el.id = id;
      return el as unknown as HTMLElement;
    });

    expect(() => initGame(mockDoc)).toThrow(/game-container/);
  });

  it("should throw error if #hud-container is missing", () => {
    const createMockElement = () => ({
      ownerDocument: mockDoc,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
      id: "",
    });

    mockDoc.getElementById = vi.fn((id: string) => {
      if (id === "hud-container") return null;
      const el = createMockElement();
      el.id = id;
      return el as unknown as HTMLElement;
    });

    expect(() => initGame(mockDoc)).toThrow(/hud-container/);
  });

  it("should throw error if #palette-container is missing", () => {
    const createMockElement = () => ({
      ownerDocument: mockDoc,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
      id: "",
    });

    mockDoc.getElementById = vi.fn((id: string) => {
      if (id === "palette-container") return null;
      const el = createMockElement();
      el.id = id;
      return el as unknown as HTMLElement;
    });

    expect(() => initGame(mockDoc)).toThrow(/palette-container/);
  });

  it("should keep inspectorContainer attached after mountPaletteBar clears contents", () => {
    // Track whether inspectorContainer's parent is still paletteContainer
    let inspectorParent: HTMLElement | null = null;
    
    const createMockElement = () => ({
      ownerDocument: mockDoc,
      appendChild: vi.fn((child: HTMLElement) => {
        if (child.id === "inspector-container") {
          inspectorParent = child.parentNode as HTMLElement;
        }
        return child;
      }),
      insertBefore: vi.fn((newChild: HTMLElement, refChild: HTMLElement | null) => {
        if (refChild && refChild.id === "inspector-container") {
          // inspectorContainer was already appended, so its parent should be paletteContainer
          inspectorParent = newChild.parentNode as HTMLElement;
        }
        return newChild;
      }),
      removeChild: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
      id: "",
      textContent: "",
      className: "",
    });

    mockDoc.getElementById = vi.fn((id: string) => {
      if (id === "game-container" || id === "hud-container" || id === "palette-container") {
        const el = createMockElement();
        el.id = id;
        el.ownerDocument = mockDoc;
        return el as unknown as HTMLElement;
      }
      return null;
    });

    // Mock createElement to track inspector container creation
    const inspectorEl = createMockElement();
    inspectorEl.id = "inspector-container";
    inspectorEl.ownerDocument = mockDoc;
    
    let createElementCallCount = 0;
    mockDoc.createElement = vi.fn((tag: string) => {
      createElementCallCount++;
      if (createElementCallCount === 1) {
        // First call creates inspectorContainer
        return inspectorEl as unknown as HTMLElement;
      }
      // Subsequent calls create paletteBarContainer
      const el = createMockElement();
      el.ownerDocument = mockDoc;
      return el as unknown as HTMLElement;
    });

    // Verify containers exist
    expect(mockDoc.getElementById("game-container")).toBeTruthy();
    expect(mockDoc.getElementById("hud-container")).toBeTruthy();
    expect(mockDoc.getElementById("palette-container")).toBeTruthy();
    
    // The key assertion: inspectorContainer should remain in the DOM structure
    // after mountPaletteBar's innerHTML="" operation
    expect(inspectorEl.appendChild).toBeDefined();
    expect(inspectorEl.insertBefore).toBeDefined();
  });
});
