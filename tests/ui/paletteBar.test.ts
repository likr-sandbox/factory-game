// Unit tests for Japanese paletteBar and inspector
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountPaletteBar } from "../../src/ui/paletteBar";
import { createInspector } from "../../src/ui/inspector";
import { createWorld } from "../../src/sim/world";
import { createInputState } from "../../src/game/input";

// Lightweight DOM stub with parentNode tracking and recursive querySelector
class MockElement {
  public children: MockElement[] = [];
  public textContent: string = "";
  public style: Record<string, string> = {};
  public parentNode: MockElement | null = null;
  public ownerDocument: MockDocument | null = null;
  public dataset: Record<string, string> = {};
  public disabled: boolean = false;
  public title: string = "";
  public value: string = "";
  private classListArr: string[] = [];
  private _classList: { add(...cls: string[]): void; remove(...cls: string[]): void; toggle(cls: string, force?: boolean): void };

  constructor() {
    this._classList = {
      add: (...cls) => { cls.forEach(c => { if (!this.classListArr.includes(c)) this.classListArr.push(c); }); },
      remove: (...cls) => { cls.forEach(c => { const i = this.classListArr.indexOf(c); if (i !== -1) this.classListArr.splice(i, 1); }); },
      toggle: (c, force) => { if (force !== undefined) force ? !this.classListArr.includes(c) && this.classListArr.push(c) : this.classListArr.splice(this.classListArr.indexOf(c), 1); else { const i = this.classListArr.indexOf(c); i === -1 ? this.classListArr.push(c) : this.classListArr.splice(i, 1); } },
    };
  }

  get classList(): { add(...cls: string[]): void; remove(...cls: string[]): void; toggle(cls: string, force?: boolean): void } {
    return this._classList;
  }
  get className(): string { return this.classListArr.join(" "); }
  set className(v: string) { this.classListArr = v.trim() ? v.split(/\s+/) : []; }

  appendChild(child: MockElement): void { child.parentNode = this; this.children.push(child); }
  removeChild(child: MockElement): void { const i = this.children.indexOf(child); if (i !== -1) { this.children.splice(i, 1); child.parentNode = null; } }
  querySelector(sel: string): MockElement | null {
    if (sel.startsWith(".") && this.className.includes(sel.slice(1))) return this;
    if (sel === "button" && this.tagName === "BUTTON") return this;
    for (const c of this.children) {
      const found = c.querySelector(sel);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(sel: string): MockElement[] {
    const res: MockElement[] = [];
    const checkMatch = (el: MockElement): void => {
      if (sel === "button" && el.tagName === "BUTTON") res.push(el);
      else if (sel.startsWith(".") && el.className.includes(sel.slice(1))) res.push(el);
      for (const c of el.children) checkMatch(c);
    };
    // Start from this element's children, not including self
    for (const c of this.children) checkMatch(c);
    return res;
  }
  addEventListener(evt: string, h: (e: unknown) => void): void { (this as unknown as Record<string, unknown>)["on" + evt] = h; }
  dispatchEvent(evt: string): void { const h = (this as unknown as Record<string, unknown>)["on" + evt]; if (typeof h === "function") h({}); }
  tagName = "DIV";
}

class MockDocument {
  createElement(tag: string): MockElement { 
    const el = new MockElement(); 
    el.ownerDocument = this; 
    el.tagName = tag.toUpperCase(); 
    return el; 
  }
}

describe("mountPaletteBar", () => {
  let container: MockElement; let doc: MockDocument;
  beforeEach(() => { doc = new MockDocument(); container = doc.createElement("div"); });

  it("renders Japanese building buttons including filter_splitter, underground_belt, recycler, and sensor", () => {
    const onBuildingSelect = vi.fn();
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect, onRotate: vi.fn(), onDemolish: vi.fn(), onInspectToggle: vi.fn() });
    const btns = container.querySelectorAll("button");
    expect(btns.length).toBe(12); // 9 building + 3 action
    expect(btns[0]!.textContent).toBe("採掘機");
    expect(btns[1]!.textContent).toBe("コンベア");
    expect(btns[2]!.textContent).toBe("分配器");
    expect(btns[3]!.textContent).toBe("フィルター分配機");
    expect(btns[4]!.textContent).toBe("交差ブリッジ");
    expect(btns[5]!.textContent).toBe("精錬炉");
    expect(btns[6]!.textContent).toBe("組立機");
    expect(btns[7]!.textContent).toBe("不純物処理炉");
    expect(btns[8]!.textContent).toBe("センサー");
    handle.destroy();
  });

  it("toggles rotation [R] and demolish [X] mode on action button clicks", () => {
    let rotateCalled = false, demolishCalled = false;
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect: vi.fn(), onRotate: () => rotateCalled = true, onDemolish: () => demolishCalled = true, onInspectToggle: vi.fn() });
    const rotBtn = Array.from(container.children[0]!.children[1]!.children).find(b => b.textContent === "回転 [R]") as MockElement;
    const demBtn = Array.from(container.children[0]!.children[1]!.children).find(b => b.textContent === "撤去 [X]") as MockElement;
    rotBtn!.dispatchEvent("click"); expect(rotateCalled).toBe(true);
    demBtn!.dispatchEvent("click"); expect(demolishCalled).toBe(true);
    handle.destroy();
  });

  it("highlights selected building and inspect/demolish modes via sync()", () => {
    const inputState = createInputState();
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect: vi.fn(), onRotate: vi.fn(), onDemolish: vi.fn(), onInspectToggle: vi.fn() });
    handle.sync(createWorld(42), inputState);
    // Access belt button directly via buildingGroup (wrapper.children[0])
    const wrapper = container.children[0]!;
    const buildingGroup = wrapper.children[0]!;
    const beltBtn = buildingGroup.children[1] as MockElement; // Second button is "コンベア"
    // Check that belt button has selected styling (borderColor set to #e94560)
    expect(beltBtn.style.borderColor).toBe("#e94560");
    inputState.mode = "inspect"; inputState.selectedBuilding = null;
    handle.sync(createWorld(42), inputState);
    const actionGroup = wrapper.children[1]!;
    const inspectBtn = Array.from(actionGroup.children).find(b => b.textContent === "調査") as MockElement;
    expect(inspectBtn!.className).toContain("selected");
    handle.destroy();
  });

  it("destroy() removes wrapper from parent", () => {
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect: vi.fn(), onRotate: vi.fn(), onDemolish: vi.fn(), onInspectToggle: vi.fn() });
    expect(container.children.length).toBe(1);
    handle.destroy();
    expect(container.children.length).toBe(0);
  });

  it("updates direction indicator with N/E/S/W via sync()", () => {
    const inputState = createInputState();
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect: vi.fn(), onRotate: vi.fn(), onDemolish: vi.fn(), onInspectToggle: vi.fn() });
    
    // Call sync to initialize direction indicator
    handle.sync(createWorld(42), inputState);
    
    // Check initial direction (default is E)
    const wrapper = container.children[0]!;
    const actionGroup = wrapper.children[1]!;
    const directionIndicator = Array.from(actionGroup.children).find(c => c.className.includes("direction-indicator")) as MockElement;
    expect(directionIndicator!.textContent).toContain("向き：E");
    
    // Update to different directions
    inputState.direction = "N";
    handle.sync(createWorld(42), inputState);
    expect(directionIndicator!.textContent).toContain("向き：N");
    
    inputState.direction = "S";
    handle.sync(createWorld(42), inputState);
    expect(directionIndicator!.textContent).toContain("向き：S");
    
    inputState.direction = "W";
    handle.sync(createWorld(42), inputState);
    expect(directionIndicator!.textContent).toContain("向き：W");
    
    handle.destroy();
  });

  it("disables locked building buttons with opacity and tooltip", () => {
    const world = createWorld(42);
    // Only unlock underground_belt tech, so filter_splitter, sensor, recycler remain locked
    world.unlockedTechs = ["underground_belt"];
    
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect: vi.fn(), onRotate: vi.fn(), onDemolish: vi.fn(), onInspectToggle: vi.fn() });
    handle.sync(world, createInputState());
    
    const allBtns = container.querySelectorAll("button");
    const sensorBtn = Array.from(allBtns).find(b => b.textContent === "センサー") as MockElement;
    const recyclerBtn = Array.from(allBtns).find(b => b.textContent === "不純物処理炉") as MockElement;
    
    // Locked buttons should be disabled with dimmed style
    expect(sensorBtn!.disabled).toBe(true);
    expect(sensorBtn!.style.opacity).toBe("0.5");
    expect(sensorBtn!.title).toBe("未解放（テック研究が必要）");
    expect(sensorBtn!.className).toContain("locked");
    
    expect(recyclerBtn!.disabled).toBe(true);
    expect(recyclerBtn!.style.opacity).toBe("0.5");
    
    handle.destroy();
  });

  it("setFeedback displays and clears feedback messages", () => {
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect: vi.fn(), onRotate: vi.fn(), onDemolish: vi.fn(), onInspectToggle: vi.fn() });
    
    const wrapper = container.children[0]!;
    const feedbackElement = Array.from(wrapper.children).find(c => c.className.includes("palette-feedback")) as MockElement;
    
    // Set feedback message
    handle.setFeedback("鉱床外");
    expect(feedbackElement!.textContent).toBe("鉱床外");
    
    // Clear feedback
    handle.setFeedback(null);
    expect(feedbackElement!.textContent).toBe("");
    
    handle.destroy();
  });
});

describe("createInspector", () => {
  let container: MockElement; let doc: MockDocument;
  beforeEach(() => { doc = new MockDocument(); container = doc.createElement("div"); });

  it("shows repair button for faulted building and recipe select for smelter/assembler", () => {
    const onRepair = vi.fn(), onSetRecipe = vi.fn();
    const handle = createInspector(container as unknown as HTMLElement, { onRepair, onSetRecipe });
    const world = createWorld(42);
    world.tiles[31]![31]!.buildingId = "smelter1";
    world.buildings["smelter1"] = { id: "smelter1", type: "smelter", x: 31, y: 31, direction: "N", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: true, load: 0, idleTicks: 0, blockedTicks: 0, recipeId: "iron_plate" };
    handle.update(world, { x: 31, y: 31 });
    const panel = container.children[0]!;
    const repairBtn = panel.children.find(c => c.textContent === "修理") as MockElement;
    expect(repairBtn!.style.display).toBe("block");
    const recipeSel = panel.children.find(c => c.tagName === "SELECT") as MockElement;
    expect(recipeSel).toBeDefined();
    handle.destroy();
  });

  it("displays building name with coordinates and fault status", () => {
    const onRepair = vi.fn(), onSetRecipe = vi.fn();
    const handle = createInspector(container as unknown as HTMLElement, { onRepair, onSetRecipe });
    const world = createWorld(42);
    // Set building at (10, 20) - ensure tile exists and building is linked
    world.tiles[20]![10]!.buildingId = "assembler1";
    world.buildings["assembler1"] = { id: "assembler1", type: "assembler", x: 10, y: 20, direction: "E", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: false, load: 0, idleTicks: 0, blockedTicks: 0, recipeId: "copper_wire" };
    handle.update(world, { x: 10, y: 20 });
    const panel = container.children[0]!;
    const infoDiv = panel.children[0]!;
    expect(infoDiv.textContent).toContain("組立機 (10, 20)");
    handle.destroy();
  });

  it("calls onRepair callback when repair button clicked", () => {
    const onRepair = vi.fn(), onSetRecipe = vi.fn();
    const handle = createInspector(container as unknown as HTMLElement, { onRepair, onSetRecipe });
    const world = createWorld(42);
    world.tiles[5]![5]!.buildingId = "smelter1";
    world.buildings["smelter1"] = { id: "smelter1", type: "smelter", x: 5, y: 5, direction: "N", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: true, load: 0, idleTicks: 0, blockedTicks: 0, recipeId: "iron_plate" };
    handle.update(world, { x: 5, y: 5 });
    const panel = container.children[0]!;
    const repairBtn = panel.children.find(c => c.textContent === "修理") as MockElement;
    repairBtn!.dispatchEvent("click");
    expect(onRepair).toHaveBeenCalledWith(5, 5);
    handle.destroy();
  });

  it("calls onSetRecipe callback when recipe selected", () => {
    const onRepair = vi.fn(), onSetRecipe = vi.fn();
    const handle = createInspector(container as unknown as HTMLElement, { onRepair, onSetRecipe });
    const world = createWorld(42);
    world.tiles[12]![8]!.buildingId = "smelter1";
    world.buildings["smelter1"] = { id: "smelter1", type: "smelter", x: 8, y: 12, direction: "N", inputBuffer: {}, outputBuffer: {}, beltItems: [], craftProgress: 0, roundRobinIndex: 0, faulted: false, load: 0, idleTicks: 0, blockedTicks: 0, recipeId: "iron_plate" };
    handle.update(world, { x: 8, y: 12 });
    const panel = container.children[0]!;
    const recipeSelect = panel.children.find(c => c.tagName === "SELECT") as MockElement;
    // Find an existing recipe option from the populated select
    const options = recipeSelect.querySelectorAll("option");
    if (options.length > 1) {
      // Use second option (first is blank)
      const selOption = options[1]!;
      recipeSelect.value = (selOption as unknown as Record<string, string>).value || "copper_wire";
    } else {
      recipeSelect.value = "copper_wire";
    }
    const handler = (recipeSelect as unknown as Record<string, (e: unknown) => void | undefined>).onchange;
    if (handler) handler({ target: recipeSelect });
    expect(onSetRecipe).toHaveBeenCalledWith(8, 12, recipeSelect.value);
    handle.destroy();
  });

  it("destroy() removes panel from parent", () => {
    const handle = createInspector(container as unknown as HTMLElement, { onRepair: vi.fn(), onSetRecipe: vi.fn() });
    expect(container.children.length).toBe(1);
    handle.destroy();
    expect(container.children.length).toBe(0);
  });
});
