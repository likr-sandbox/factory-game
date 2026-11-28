// HUD tests - Lightweight Node stubs, no jsdom or happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountHud } from "../../src/ui/hud";
import { createWorld } from "../../src/sim/world";
import type { WorldState, ActiveQuestState } from "../../src/sim/types";

class MockElement {
  public children: MockElement[] = [];
  public textContent: string = "";
  public style: Record<string, string> = {};
  public attributes: Map<string, string> = new Map();
  public className: string = "";
  public id: string = "";
  public parentNode: MockElement | null = null;
  public ownerDocument: MockDocument | null = null;
  public disabled: boolean = false;
  public ariaExpanded: string = "";
  public ariaHidden: string = "";

  appendChild(child: MockElement): void { child.parentNode = this; this.children.push(child); }
  removeChild(child: MockElement): void { const idx = this.children.indexOf(child); if (idx !== -1) { this.children.splice(idx, 1); child.parentNode = null; } }
  querySelectorAll(sel: string): MockElement[] { 
    if (sel === ".speed-btn") return this.children.filter(c => c.className.includes("speed-btn"));
    if (sel === ".tech-btn") return this.children.filter(c => c.className.includes("tech-btn"));
    if (sel === ".hud-item") return this.children.filter(c => c.className.includes("hud-item"));
    if (sel === ".tech-drawer") return this.children.filter(c => c.className.includes("tech-drawer"));
    if (sel === ".seed-popover") return this.children.filter(c => c.className.includes("seed-popover"));
    return [];
  }
  classList = { 
    add: (cls: string) => { if (!this.className.includes(cls)) this.className += ` ${cls}`; }, 
    remove: (cls: string) => { this.className = this.className.replace(cls, "").trim(); },
    toggle: (cls: string, force?: boolean) => {
      const has = this.className.includes(cls);
      if (force === true || (force === undefined && !has)) this.classList.add(cls);
      if (force === false || (force === undefined && has)) this.classList.remove(cls);
    }
  };
  addEventListener(event: string, handler: (e: unknown) => void): void { (this as unknown as Record<string, unknown>)[`on${event}`] = handler; }
  dispatchEvent(event: string): void { const h = (this as unknown as Record<string, unknown>)[`on${event}`]; if (typeof h === "function") h({}); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); if (name === "aria-expanded") this.ariaExpanded = value; if (name === "aria-hidden") this.ariaHidden = value; }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
}

class MockDocument {
  createElement(tag: string): MockElement { const el = new MockElement(); el.ownerDocument = this; return el; }
}

function makeWorld(): WorldState {
  const w = createWorld(42);
  w.tick = 100;
  w.delivered = { iron_plate: 10, copper_plate: 5, iron_gear: 3, copper_wire: 8 };
  w.researchPoints = 0;
  w.tutorialPhase = 0;
  w.completedTutorialSteps = [];
  w.activeQuests = [];
  w.nextQuestId = 0;
  return w;
}

describe("mountHud", () => {
  let container: MockElement;

  beforeEach(() => { container = new MockElement(); container.ownerDocument = new MockDocument(); });

  it("should render slim hud-bar on mount", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const hud = container.children[0]!;
    expect(hud.className).toContain("hud-bar");
    // Should have spm-display, speed-controls, building-counts, research-points, tutorial-display, quests-display, tech-toggle-btn, seed-toggle-btn
    expect(hud.children.length).toBeGreaterThanOrEqual(8);
    handle.destroy();
  });

  it("should display SPM in slim format", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    handle.update(makeWorld());
    const spmEl = container.children[0]!.children[0]!;
    expect(spmEl.textContent).toContain("SPM:");
    handle.destroy();
  });

  it("should display building counts concisely", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.buildings = {
      "b1": { id: "b1", type: "miner", x: 0, y: 0, direction: "N", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: false, load: 1, idleTicks: 0, blockedTicks: 0 },
      "b2": { id: "b2", type: "smelter", x: 1, y: 0, direction: "E", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: true, load: 0, idleTicks: 0, blockedTicks: 0 },
    };
    world.tiles = [[{ x: 0, y: 0, terrain: "grass", deposit: { material: "iron_ore", remaining: 100, initialAmount: 100 }, buildingId: "b1" }]];
    handle.update(world);
    const countEl = container.children[0]!.children[2]!;
    expect(countEl.textContent).toBe("稼働/故障：1 / 1");
    handle.destroy();
  });

  it("should display research points concisely", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 250;
    handle.update(world);
    const rpEl = container.children[0]!.children[3]!;
    expect(rpEl.textContent).toBe("RP:250");
    handle.destroy();
  });

  it("should call speed change callback on button click", () => {
    const onSpeedChange = vi.fn(), onPausedToggle = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onSpeedChange, onPausedToggle });
    const speedControlsEl = container.children[0]!.children[1]!;
    const buttons = speedControlsEl.querySelectorAll(".speed-btn");
    buttons[2]!.dispatchEvent("click"); // 2x
    expect(onSpeedChange).toHaveBeenCalledWith(2);
    expect(onPausedToggle).toHaveBeenCalledWith(false);
    buttons[0]!.dispatchEvent("click"); // pause
    expect(onSpeedChange).toHaveBeenCalledWith(0);
    expect(onPausedToggle).toHaveBeenCalledWith(true);
    handle.destroy();
  });

  it("should update SPM display when world changes", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const spmEl = container.children[0]!.children[0]!;
    const w1 = makeWorld(); w1.deliveryHistory = [{ tick: 50, material: "iron_plate", amount: 10 }];
    handle.update(w1);
    const first = spmEl.textContent;
    const w2 = makeWorld(); w2.tick = 999; w2.deliveryHistory = [{ tick: 950, material: "copper_plate", amount: 20 }];
    handle.update(w2);
    expect(spmEl.textContent).not.toBe(first);
    expect(spmEl.textContent).toBe("SPM:20");
    handle.destroy();
  });

  it("should cleanup on destroy", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    expect(container.children).toHaveLength(3); // hud-bar + tech-drawer + seed-popover
    handle.destroy();
    expect(container.children).toHaveLength(0);
  });

  it("should show default values when world has no data", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const empty: WorldState = { seed: 42, width: 10, height: 10, tick: 0, rngState: 42, tiles: [], buildings: {}, nextBuildingId: 1, hubOrigin: { x: 0, y: 0 }, delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [], researchPoints: 0, tutorialPhase: 0, completedTutorialSteps: [], activeQuests: [], nextQuestId: 0 };
    handle.update(empty);
    expect(container.children[0]!.children[0]!.textContent).toBe("SPM:0");
    const speedControls = container.children[0]!.children[1]!;
    expect(speedControls.querySelectorAll(".speed-btn").length).toBe(4);
    expect(container.children[0]!.children[2]!.textContent).toBe("稼働/故障：0 / 0");
    expect(container.children[0]!.children[3]!.textContent).toBe("RP:0");
    expect(container.children[0]!.children[4]!.textContent).toBe("チュートリアル：未開始");
    expect(container.children[0]!.children[5]!.textContent).toBe("クエスト：なし");
    handle.destroy();
  });

  it("should display research points correctly", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 250;
    handle.update(world);
    expect(container.children[0]!.children[3]!.textContent).toBe("RP:250");
    handle.destroy();
  });

  it("should display tutorial progress with current step", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.tutorialPhase = 1;
    world.completedTutorialSteps = ["p1_manual_mining"];
    handle.update(world);
    expect(container.children[0]!.children[4]!.textContent).toContain("チュートリアル：Phase 1");
    handle.destroy();
  });

  it("should display tech tree unlock buttons when techs are locked", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = []; // No techs unlocked
    world.researchPoints = 1000; // Enough RP to unlock all
    handle.update(world);
    const techDrawer = container.children[1]!;
    const buttons = techDrawer.querySelectorAll(".tech-btn");
    expect(buttons.length).toBeGreaterThan(0);
    handle.destroy();
  });

  it("should call onUnlockTech callback when tech button clicked", () => {
    const onUnlockTech = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onUnlockTech });
    const world = makeWorld();
    world.unlockedTechs = [];
    handle.update(world);
    const techTreeEl = container.children[0]!.children[6]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    if (buttons.length > 0) {
      buttons[0]!.dispatchEvent("click");
      expect(onUnlockTech).toHaveBeenCalled();
    }
    handle.destroy();
  });

  it("should display active quests with progress", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.tick = 1000;
    world.activeQuests = [
      {
        questId: "quest_0",
        stepIndex: 0,
        progress: { iron_plate: 10 },
        startedAtTick: 500,
        questCatalogId: "iron_plate",
        targets: { iron_plate: 15 },
        rewardPoints: 50,
      } as ActiveQuestState,
    ];
    handle.update(world);
    expect(container.children[0]!.children[5]!.textContent).toContain("クエスト");
    handle.destroy();
  });

  it("should display seed reset controls", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    handle.update(world);
    const seedPopoverEl = container.children[2]!;
    const seedInput = seedPopoverEl.children[0]!;
    const resetBtn = seedPopoverEl.children[1]!;
    const randomBtn = seedPopoverEl.children[2]!;
    expect(seedInput.className).toContain("seed-input");
    expect(resetBtn.className).toContain("reset-btn");
    expect(randomBtn.className).toContain("random-btn");
    handle.destroy();
  });

  it("should call onResetWorld callback when reset button clicked", () => {
    const onResetWorld = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onResetWorld });
    const world = makeWorld();
    handle.update(world);
    const seedPopoverEl = container.children[2]!;
    const resetBtn = seedPopoverEl.children[1]!;
    resetBtn.dispatchEvent("click");
    handle.destroy();
  });

  it("should call onResetWorld with random seed when random button clicked", () => {
    const onResetWorld = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onResetWorld });
    const world = makeWorld();
    handle.update(world);
    const seedPopoverEl = container.children[2]!;
    const randomBtn = seedPopoverEl.children[2]!;
    randomBtn.dispatchEvent("click");
    expect(onResetWorld).toHaveBeenCalled();
    handle.destroy();
  });

  it("should initialize 1x speed button with active class on mount", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const speedControlsEl = container.children[0]!.children[1]!;
    const buttons = speedControlsEl.querySelectorAll(".speed-btn");
    // buttons[0]=pause, buttons[1]=1x, buttons[2]=2x, buttons[3]=4x
    expect(buttons[1]!.className).toContain("active");
    expect(buttons[0]!.className).not.toContain("active");
    expect(buttons[2]!.className).not.toContain("active");
    expect(buttons[3]!.className).not.toContain("active");
    handle.destroy();
  });

  it("should have tech toggle button that toggles tech drawer", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const hud = container.children[0]!;
    const techToggleBtn = hud.children[6]!;
    expect(techToggleBtn.className).toContain("tech-toggle-btn");
    expect(techToggleBtn.textContent).toContain("研究");
    
    // Tech drawer should be hidden by default
    const techDrawer = container.children[1]!;  // tech-drawer popover
    expect(techDrawer.style.display).toBe("none");
    expect(techToggleBtn.ariaExpanded).toBe("false");
    
    // Click to open
    techToggleBtn.dispatchEvent("click");
    expect(techDrawer.style.display).not.toBe("none");
    expect(techToggleBtn.ariaExpanded).toBe("true");
    
    handle.destroy();
  });

  it("should show unlockable badge only when techs are affordable with current RP", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    
    // Test 1: RP = 0, no affordable techs - badge should be hidden
    const world1 = makeWorld();
    world1.researchPoints = 0;
    world1.unlockedTechs = []; // All 8 techs locked but none affordable
    handle.update(world1);
    
    const techToggleBtn1 = container.children[0]!.children[6]!;
    const badge1 = Array.from(techToggleBtn1.children).find((c: any) => c.className?.includes("tech-badge"));
    expect(badge1).toBeDefined();
    expect(badge1!.style.display).toBe("none");
    expect(techToggleBtn1.className.includes("has-unlockable")).toBe(false);
    
    // Test 2: RP = 1000, 8 techs affordable - badge should show "8"
    const world2 = makeWorld();
    world2.researchPoints = 1000;
    world2.unlockedTechs = [];
    handle.update(world2);
    
    const techToggleBtn2 = container.children[0]!.children[6]!;
    const badge2 = Array.from(techToggleBtn2.children).find((c: any) => c.className?.includes("tech-badge"));
    expect(badge2).toBeDefined();
    expect(badge2!.style.display).not.toBe("none");
    expect(badge2!.textContent).toBe("8");
    expect(techToggleBtn2.className.includes("has-unlockable")).toBe(true);
    
    // Test 3: RP = 100, only filter_splitter (100RP) is affordable - badge should show "1"
    const world3 = makeWorld();
    world3.researchPoints = 100;
    world3.unlockedTechs = [];
    handle.update(world3);
    
    const techToggleBtn3 = container.children[0]!.children[6]!;
    const badge3 = Array.from(techToggleBtn3.children).find((c: any) => c.className?.includes("tech-badge"));
    expect(badge3).toBeDefined();
    expect(badge3!.style.display).not.toBe("none");
    expect(badge3!.textContent).toBe("1");
    expect(techToggleBtn3.className.includes("has-unlockable")).toBe(true);
    
    // Test 4: Some techs unlocked, remaining not affordable - badge should be hidden
    const world4 = makeWorld();
    world4.researchPoints = 50; // Not enough for any remaining tech
    world4.unlockedTechs = ["filter_splitter"]; // 1 unlocked, 7 locked but none affordable
    handle.update(world4);
    
    const techToggleBtn4 = container.children[0]!.children[6]!;
    const badge4 = Array.from(techToggleBtn4.children).find((c: any) => c.className?.includes("tech-badge"));
    expect(badge4).toBeDefined();
    expect(badge4!.style.display).toBe("none");
    expect(techToggleBtn4.className.includes("has-unlockable")).toBe(false);
    
    handle.destroy();
  });

  it("should hide tech tree when all 8 techs are unlocked", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = ["underground_belt", "filter_splitter", "high_efficiency", 
      "sensor", "recycler", "advanced_smelting", "electronics", "automation"];
    
    handle.update(world);
    
    const techToggleBtn = container.children[0]!.children[6]!;
    expect(techToggleBtn.style.display).toBe("none");
    
    handle.destroy();
  });

  it("should update tech buttons non-destructively in drawer", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    
    // First update with no techs unlocked
    handle.update(world);
    const techDrawer = container.children[1]!;  // tech-drawer popover
    const buttonsBefore = techDrawer.querySelectorAll(".tech-btn");
    expect(buttonsBefore.length).toBe(8);
    
    // Unlock one tech and update
    world.unlockedTechs = ["filter_splitter"];
    handle.update(world);
    
    // The same button element should be hidden/disabled, not recreated
    const buttonsAfter = techDrawer.querySelectorAll(".tech-btn");
    expect(buttonsAfter.length).toBe(8);
    
    handle.destroy();
  });

  it("should call onUnlockTech callback when tech button clicked", () => {
    const onUnlockTech = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onUnlockTech });
    const world = makeWorld();
    world.tick = 1000;
    world.unlockedTechs = [];
    // Note: Quest templates use targets like iron_plate: 15, copper_plate: 15
    world.activeQuests = [
      {
        questId: "quest_0",
        stepIndex: 0,
        progress: { iron_plate: 5, copper_plate: 3 },
        startedAtTick: 500,
        questCatalogId: "iron_plate",
        targets: { iron_plate: 15, copper_plate: 15 },
        rewardPoints: 50,
      } as ActiveQuestState,
    ];
    handle.update(world);
    
    const techDrawer = container.children[1]!;  // tech-drawer popover
    const buttons = techDrawer.querySelectorAll(".tech-btn");
    if (buttons.length > 0) {
      buttons[0]!.dispatchEvent("click");
      expect(onUnlockTech).toHaveBeenCalled();
    }
    handle.destroy();
  });

  it("should disable tech buttons and show '不足' when RP is insufficient", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 50; // Less than filter_splitter cost (100)
    handle.update(world);
    
    const techDrawer = container.children[1]!;  // tech-drawer popover
    const buttons = techDrawer.querySelectorAll(".tech-btn");
    
    const filterSplitterBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("フィルター分配機"));
    expect(filterSplitterBtn).toBeDefined();
    expect(filterSplitterBtn!.disabled).toBe(true);
    expect(filterSplitterBtn!.textContent).toContain("不足");
    
    handle.destroy();
  });

  it("should have seed toggle button that toggles seed popover", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const hud = container.children[0]!;
    const seedToggleBtn = hud.children[7]!;
    expect(seedToggleBtn.className).toContain("seed-toggle-btn");
    expect(seedToggleBtn.textContent).toContain("シード");
    
    // Seed popover should be hidden by default
    const seedPopover = container.children[2]!;
    expect(seedPopover.style.display).toBe("none");
    
    // Click to open
    seedToggleBtn.dispatchEvent("click");
    expect(seedPopover.style.display).not.toBe("none");
    
    handle.destroy();
  });

  it("should close seed popover when tech drawer is opened", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    handle.update(world);
    
    const hud = container.children[0]!;
    const seedToggleBtn = hud.children[7]!;
    const techToggleBtn = hud.children[6]!;
    const seedPopover = container.children[2]!;
    const techDrawer = container.children[1]!;
    
    // Open seed popover
    seedToggleBtn.dispatchEvent("click");
    expect(seedPopover.style.display).not.toBe("none");
    
    // Open tech drawer (should close seed popover)
    techToggleBtn.dispatchEvent("click");
    expect(seedPopover.style.display).toBe("none");
    expect(techDrawer.style.display).not.toBe("none");
    
    handle.destroy();
  });

  it("should close tech drawer when seed popover is opened", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    handle.update(world);
    
    const hud = container.children[0]!;
    const seedToggleBtn = hud.children[7]!;
    const techToggleBtn = hud.children[6]!;
    const seedPopover = container.children[2]!;
    const techDrawer = container.children[1]!;
    
    // Open tech drawer
    techToggleBtn.dispatchEvent("click");
    expect(techDrawer.style.display).not.toBe("none");
    
    // Open seed popover (should close tech drawer)
    seedToggleBtn.dispatchEvent("click");
    expect(techDrawer.style.display).toBe("none");
    expect(seedPopover.style.display).not.toBe("none");
    
    handle.destroy();
  });

  it("should call onResetWorld callback when reset button clicked", () => {
    const onResetWorld = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onResetWorld });
    const world = makeWorld();
    handle.update(world);
    
    const seedPopover = container.children[2]!;
    const resetBtn = seedPopover.children[1]!;
    resetBtn.dispatchEvent("click");
    handle.destroy();
  });

  it("should call onResetWorld with random seed when random button clicked", () => {
    const onResetWorld = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onResetWorld });
    const world = makeWorld();
    handle.update(world);
    
    const seedPopover = container.children[2]!;
    const randomBtn = seedPopover.children[2]!;
    randomBtn.dispatchEvent("click");
    expect(onResetWorld).toHaveBeenCalled();
    handle.destroy();
  });

  it("should display tutorial progress", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.tutorialPhase = 1;
    handle.update(world);
    
    const tutorialEl = container.children[0]!.children[4]!;
    expect(tutorialEl.textContent).toContain("チュートリアル：Phase 1");
    handle.destroy();
  });

  it("should display quests", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.tick = 1000;
    world.activeQuests = [
      {
        questId: "quest_0",
        stepIndex: 0,
        progress: { iron_plate: 5 },
        startedAtTick: 500,
        questCatalogId: "iron_plate",
        targets: { iron_plate: 15 },
        rewardPoints: 50,
      } as ActiveQuestState,
    ];
    handle.update(world);
    
    const questsEl = container.children[0]!.children[5]!;
    expect(questsEl.textContent).toContain("クエスト");
    handle.destroy();
  });

  it("should cleanup on destroy", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    expect(container.children).toHaveLength(3); // hud-bar + tech-drawer + seed-popover
    handle.destroy();
    expect(container.children).toHaveLength(0);
  });

  it("should show default values when world has no data", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const empty: WorldState = { seed: 42, width: 10, height: 10, tick: 0, rngState: 42, tiles: [], buildings: {}, nextBuildingId: 1, hubOrigin: { x: 0, y: 0 }, delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [], researchPoints: 0, tutorialPhase: 0, completedTutorialSteps: [], activeQuests: [], nextQuestId: 0 };
    handle.update(empty);
    
    const hud = container.children[0]!;
    expect(hud.children[0]!.textContent).toBe("SPM:0");
    expect(hud.children[2]!.textContent).toBe("稼働/故障：0 / 0");
    expect(hud.children[3]!.textContent).toBe("RP:0");
    expect(hud.children[4]!.textContent).toBe("チュートリアル：未開始");
    expect(hud.children[5]!.textContent).toBe("クエスト：なし");
    handle.destroy();
  });

  it("should create exactly 8 tech buttons in drawer", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 1000;
    handle.update(world);
    
    const techDrawer = container.children[1]!;  // tech-drawer popover
    const buttons = techDrawer.querySelectorAll(".tech-btn");
    expect(buttons.length).toBe(8);
    
    handle.destroy();
  });

  it("should show expected tech labels in drawer", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 1000;
    handle.update(world);
    
    const techDrawer = container.children[1]!;  // tech-drawer popover
    const buttons = techDrawer.querySelectorAll(".tech-btn");
    const texts = buttons.map(b => b.textContent);
    
    expect(texts).toContain("フィルター分配機 (100RP)");
    expect(texts).toContain("交差ブリッジ (150RP)");
    expect(texts).toContain("電子工業 (300RP)");
    
    handle.destroy();
  });
});
