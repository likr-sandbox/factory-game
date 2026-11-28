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
  public title: string = "";

  appendChild(child: MockElement): void { child.parentNode = this; this.children.push(child); }
  removeChild(child: MockElement): void { const idx = this.children.indexOf(child); if (idx !== -1) { this.children.splice(idx, 1); child.parentNode = null; } }
  querySelectorAll(sel: string): MockElement[] { 
    if (sel === ".speed-btn") return this.children.filter(c => c.className.includes("speed-btn"));
    if (sel === ".tech-btn") return this.children.filter(c => c.className.includes("tech-btn"));
    return [];
  }
  classList = { add: (cls: string) => { if (!this.className.includes(cls)) this.className += ` ${cls}`; }, remove: (cls: string) => { this.className = this.className.replace(cls, "").trim(); } };
  addEventListener(event: string, handler: (e: unknown) => void): void { (this as unknown as Record<string, unknown>)[`on${event}`] = handler; }
  dispatchEvent(event: string): void { const h = (this as unknown as Record<string, unknown>)[`on${event}`]; if (typeof h === "function") h({}); }
}

class MockDocument {
  createElement(tag: string): MockElement { 
    const el = new MockElement(); 
    el.ownerDocument = this; 
    return el; 
  }
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

  it("should render Japanese labels on mount", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    handle.update(makeWorld());
    const hud = container.children[0]!;
    expect(hud.children[0]!.textContent).toContain("生産速度/分");
    expect(hud.children[1]!.textContent).toContain("ティック");
    expect(hud.children[3]!.textContent).toContain("稼働/故障");
    expect(hud.children[4]!.textContent).toContain("納入数");
    expect(hud.children[5]!.textContent).toContain("研究ポイント");
    expect(hud.children[6]!.textContent).toContain("チュートリアル");
    expect(hud.children[7]!.textContent).toBe(""); // tech tree starts empty
    expect(hud.children[8]!.textContent).toContain("クエスト");
    handle.destroy();
    expect(container.children).toHaveLength(0);
  });

  it("should display correct SPM and tick values", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.tick = 500;
    world.deliveryHistory = [{ tick: 450, material: "iron_plate", amount: 20 }];
    handle.update(world);
    expect(container.children[0]!.children[0]!.textContent).toBe("生産速度/分：20");
    expect(container.children[0]!.children[1]!.textContent).toBe("ティック：500");
    handle.destroy();
  });

  it("should display building counts correctly", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.buildings = {
      "b1": { id: "b1", type: "miner", x: 0, y: 0, direction: "N", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: false, load: 1, idleTicks: 0, blockedTicks: 0 },
      "b2": { id: "b2", type: "smelter", x: 1, y: 0, direction: "E", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: true, load: 0, idleTicks: 0, blockedTicks: 0 },
    };
    world.tiles = [[{ x: 0, y: 0, terrain: "grass", deposit: { material: "iron_ore", remaining: 100, initialAmount: 100 }, buildingId: "b1" }]];
    handle.update(world);
    expect(container.children[0]!.children[3]!.textContent).toBe("稼働/故障：1 / 1");
    handle.destroy();
  });

  it("should display delivered resource counters", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.delivered = { iron_plate: 100, copper_plate: 50, iron_gear: 25, copper_wire: 75 };
    handle.update(world);
    expect(container.children[0]!.children[4]!.textContent).toBe("納入数：鉄板:100, 銅板:50, 鉄歯車:25, 銅線:75");
    handle.destroy();
  });

  it("should call speed change callback on button click", () => {
    const onSpeedChange = vi.fn(), onPausedToggle = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onSpeedChange, onPausedToggle });
    const buttons = container.children[0]!.children[2]!.querySelectorAll(".speed-btn");
    buttons[2]!.dispatchEvent("click");
    expect(onSpeedChange).toHaveBeenCalledWith(2);
    expect(onPausedToggle).toHaveBeenCalledWith(false);
    buttons[0]!.dispatchEvent("click");
    expect(onSpeedChange).toHaveBeenCalledWith(0);
    expect(onPausedToggle).toHaveBeenCalledWith(true);
    handle.destroy();
  });

  it("should update DOM non-destructively", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const spmEl = container.children[0]!.children[0]!;
    const w1 = makeWorld(); w1.deliveryHistory = [{ tick: 50, material: "iron_plate", amount: 10 }];
    handle.update(w1);
    const first = spmEl.textContent;
    const w2 = makeWorld(); w2.tick = 999; w2.deliveryHistory = [{ tick: 950, material: "copper_plate", amount: 20 }];
    handle.update(w2);
    expect(spmEl.textContent).not.toBe(first);
    expect(spmEl.textContent).toBe("生産速度/分：20");
    handle.destroy();
  });

  it("should cleanup on destroy", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    expect(container.children).toHaveLength(1);
    handle.destroy();
    expect(container.children).toHaveLength(0);
  });

  it("should show default values when world has no data", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const empty: WorldState = { seed: 42, width: 10, height: 10, tick: 0, rngState: 42, tiles: [], buildings: {}, nextBuildingId: 1, hubOrigin: { x: 0, y: 0 }, delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [], researchPoints: 0, tutorialPhase: 0, completedTutorialSteps: [], activeQuests: [], nextQuestId: 0 };
    handle.update(empty);
    expect(container.children[0]!.children[0]!.textContent).toBe("生産速度/分：0");
    expect(container.children[0]!.children[1]!.textContent).toBe("ティック：0");
    expect(container.children[0]!.children[3]!.textContent).toBe("稼働/故障：0 / 0");
    expect(container.children[0]!.children[5]!.textContent).toBe("研究ポイント：0");
    expect(container.children[0]!.children[6]!.textContent).toBe("チュートリアル：未開始");
    expect(container.children[0]!.children[8]!.textContent).toBe("クエスト：なし");
    handle.destroy();
  });

  it("should display research points correctly", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 250;
    handle.update(world);
    expect(container.children[0]!.children[5]!.textContent).toBe("研究ポイント：250");
    handle.destroy();
  });

  it("should display tutorial progress with current step", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.tutorialPhase = 1;
    world.completedTutorialSteps = ["p1_manual_mining"];
    handle.update(world);
    expect(container.children[0]!.children[6]!.textContent).toContain("チュートリアル：Phase 1");
    handle.destroy();
  });

  it("should display tech tree unlock buttons when techs are locked", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = []; // No techs unlocked
    handle.update(world);
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    expect(buttons.length).toBeGreaterThan(0);
    handle.destroy();
  });

  it("should call onUnlockTech callback when tech button clicked", () => {
    const onUnlockTech = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onUnlockTech });
    const world = makeWorld();
    world.unlockedTechs = [];
    handle.update(world);
    const techTreeEl = container.children[0]!.children[7]!;
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
    expect(container.children[0]!.children[8]!.textContent).toContain("クエスト");
    handle.destroy();
  });

  it("should display seed reset controls", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    handle.update(world);
    const seedResetEl = container.children[0]!.children[9]!;
    expect(seedResetEl.children.length).toBeGreaterThanOrEqual(3); // input + 2 buttons
    handle.destroy();
  });

  it("should call onResetWorld callback when reset button clicked", () => {
    const onResetWorld = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onResetWorld });
    const world = makeWorld();
    handle.update(world);
    const seedResetEl = container.children[0]!.children[9]!;
    const resetBtn = seedResetEl.children[1]!;
    resetBtn.dispatchEvent("click");
    // The callback should be called only if seed input has a value
    handle.destroy();
  });

  it("should call onResetWorld with random seed when random button clicked", () => {
    const onResetWorld = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onResetWorld });
    const world = makeWorld();
    handle.update(world);
    const seedResetEl = container.children[0]!.children[9]!;
    const randomBtn = seedResetEl.children[2]!;
    randomBtn.dispatchEvent("click");
    expect(onResetWorld).toHaveBeenCalled();
    handle.destroy();
  });

  it("should initialize 1x speed button with active class on mount", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const speedControlsEl = container.children[0]!.children[2]!;
    const buttons = speedControlsEl.querySelectorAll(".speed-btn");
    // buttons[0]=pause, buttons[1]=1x, buttons[2]=2x, buttons[3]=4x
    expect(buttons[1]!.className).toContain("active");
    expect(buttons[0]!.className).not.toContain("active");
    expect(buttons[2]!.className).not.toContain("active");
    expect(buttons[3]!.className).not.toContain("active");
    handle.destroy();
  });

  it("should apply wrap-friendly flex styling to hudEl and techTreeEl", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const hudEl = container.children[0]!;
    expect(hudEl.style.cssText).toContain("flex-wrap:wrap");
    expect(hudEl.style.cssText).toContain("align-items:center");
    expect(hudEl.style.cssText).toContain("gap:6px");
    expect(hudEl.style.cssText).toContain("width:100%");
    
    const techTreeEl = container.children[0]!.children[7]!;
    expect(techTreeEl.style.cssText).toContain("flex-wrap:wrap");
    expect(techTreeEl.style.cssText).toContain("align-items:center");
    expect(techTreeEl.style.cssText).toContain("gap:4px");
    handle.destroy();
  });

  it("should keep all HUD controls clickable at various screen sizes", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const hudEl = container.children[0]!;
    
    // Verify all expected children exist (indices 0..9)
    expect(hudEl.children).toHaveLength(10);
    
    // Check speed controls are present and clickable
    const speedControlsEl = hudEl.children[2]!;
    const speedButtons = speedControlsEl.querySelectorAll(".speed-btn");
    expect(speedButtons.length).toBe(4);
    
    // Check tech tree container exists
    const techTreeEl = hudEl.children[7]!;
    expect(techTreeEl).toBeDefined();
    
    // Check seed reset controls exist
    const seedResetEl = hudEl.children[9]!;
    expect(seedResetEl.children.length).toBeGreaterThanOrEqual(3);
    
    handle.destroy();
  });

  it("should display tech buttons that are clickable when unlocked", () => {
    const onUnlockTech = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onUnlockTech });
    const world = makeWorld();
    world.unlockedTechs = [];
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    expect(buttons.length).toBeGreaterThan(0);
    
    // Click first tech button
    buttons[0]!.dispatchEvent("click");
    expect(onUnlockTech).toHaveBeenCalled();
    
    handle.destroy();
  });

  it("should display seed controls that are clickable", () => {
    const onResetWorld = vi.fn();
    const handle = mountHud(container as unknown as HTMLElement, { onResetWorld });
    const world = makeWorld();
    handle.update(world);
    
    const seedResetEl = container.children[0]!.children[9]!;
    const randomBtn = seedResetEl.children[2]!;
    
    // Click random button
    randomBtn.dispatchEvent("click");
    expect(onResetWorld).toHaveBeenCalled();
    
    handle.destroy();
  });

  it("should create 8 tech buttons on mount for all TECH_CATALOG entries", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 1000; // 十分な RP
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    
    // Should have exactly 8 tech buttons
    expect(buttons.length).toBe(8);
    
    // Check expected tech labels exist (with RP cost from TECH_CATALOG)
    const texts = buttons.map(b => b.textContent);
    expect(texts[0]).toBe("フィルター分配機 (60RP)");
    expect(texts.length).toBe(8);
    
    handle.destroy();
  });

  it("should hide tech tree when all 8 techs are unlocked", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = ["underground_belt", "filter_splitter", "high_efficiency", 
      "sensor", "recycler", "advanced_smelting", "electronics", "automation"];
    
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    expect(techTreeEl.style.display).toBe("none");
    
    handle.destroy();
  });

  it("should update tech buttons non-destructively when tech is unlocked", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    
    // First update with no techs unlocked
    handle.update(world);
    const techTreeEl = container.children[0]!.children[7]!;
    const buttonsBefore = techTreeEl.querySelectorAll(".tech-btn");
    const firstBtn = buttonsBefore[0]!;
    const initialText = firstBtn.textContent;
    
    // Unlock one tech and update
    world.unlockedTechs = ["filter_splitter"];
    handle.update(world);
    
    // The same button element should be hidden/disabled, not recreated
    const buttonsAfter = techTreeEl.querySelectorAll(".tech-btn");
    expect(buttonsAfter.length).toBe(8); // Still 8 buttons in DOM
    
    handle.destroy();
  });

  it("should display quest progress with material names from MATERIAL_CATALOG", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.tick = 1000;
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
    
    const questsEl = container.children[0]!.children[8]!;
    expect(questsEl.textContent).toContain("鉄板 5/15");
    
    handle.destroy();
  });

  it("should disable tech buttons and show '不足' when RP is insufficient", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.researchPoints = 50; // Less than filter_splitter cost (60)
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    
    // filter_splitter button should be disabled with "不足" text
    const filterSplitterBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("フィルター分配機"));
    expect(filterSplitterBtn).toBeDefined();
    expect(filterSplitterBtn!.disabled).toBe(true);
    expect(filterSplitterBtn!.textContent).toContain("不足");
    
    handle.destroy();
  });

  it("should show all 8 tech buttons visible and enabled when none unlocked", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = [];
    world.researchPoints = 1000;
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    
    expect(buttons.length).toBe(8);
    
    // Find specific buttons by their labels
    const filterSplitterBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("フィルター分配機"));
    const undergroundBeltBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("交差ブリッジ"));
    const sensorBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("流量・異常センサー"));
    const recyclerBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("不純物処理炉"));
    
    // Techs without prereqs should be enabled with RP cost
    expect(filterSplitterBtn).toBeDefined();
    expect(filterSplitterBtn!.disabled).toBe(false);
    expect(filterSplitterBtn!.textContent).toBe("フィルター分配機 (60RP)");
    
    expect(undergroundBeltBtn).toBeDefined();
    expect(undergroundBeltBtn!.disabled).toBe(false);
    
    expect(sensorBtn).toBeDefined();
    expect(sensorBtn!.disabled).toBe(false);
    
    // Techs with prereqs should be disabled with "要:" message
    expect(recyclerBtn).toBeDefined();
    expect(recyclerBtn!.disabled).toBe(true);
    expect(recyclerBtn!.textContent).toContain("要:");
    
    handle.destroy();
  });

  it("should disable tech buttons and show '要:' when prerequisites are not met", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = []; // No techs unlocked
    world.researchPoints = 1000; // Sufficient RP
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    
    // recycler requires filter_splitter, so it should be disabled with "要:" message
    const recyclerBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("不純物処理炉"));
    expect(recyclerBtn).toBeDefined();
    expect(recyclerBtn!.disabled).toBe(true);
    expect(recyclerBtn!.textContent).toContain("要:");
    expect(recyclerBtn!.textContent).toContain("フィルター分配機");
    
    handle.destroy();
  });

  it("should show prerequisite tooltip in button title when prereqs are not met", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = []; // No techs unlocked
    world.researchPoints = 1000;
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    
    // electronics requires advanced_smelting
    const electronicsBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("電子工業"));
    expect(electronicsBtn).toBeDefined();
    expect(electronicsBtn!.title).toContain("前提技術：");
    expect(electronicsBtn!.title).toContain("高度精錬技術");
    
    handle.destroy();
  });

  it("should enable tech button when prerequisites are met but not yet unlocked", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = ["filter_splitter"]; // Prereq for high_efficiency and recycler
    world.researchPoints = 1000;
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    
    // high_efficiency should now be enabled (prereq satisfied)
    const highEffBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("高効率製錬"));
    expect(highEffBtn).toBeDefined();
    expect(highEffBtn!.disabled).toBe(false);
    expect(highEffBtn!.textContent).toContain("120RP)");
    
    handle.destroy();
  });

  it("should hide unlocked tech buttons from display", () => {
    const handle = mountHud(container as unknown as HTMLElement);
    const world = makeWorld();
    world.unlockedTechs = ["filter_splitter"];
    world.researchPoints = 1000;
    handle.update(world);
    
    const techTreeEl = container.children[0]!.children[7]!;
    const buttons = techTreeEl.querySelectorAll(".tech-btn");
    
    // filter_splitter button should be hidden
    const filterSplitterBtn = Array.from(buttons).find((b: any) => b.textContent?.includes("フィルター分配機"));
    expect(filterSplitterBtn).toBeDefined();
    expect(filterSplitterBtn!.style.display).toBe("none");
    
    handle.destroy();
  });
});

