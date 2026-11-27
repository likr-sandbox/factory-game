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
  private classListArr: string[] = [];

  get classList(): { add(...cls: string[]): void; remove(...cls: string[]): void; toggle(cls: string, force?: boolean): void } {
    return {
      add: (...cls) => { cls.forEach(c => { if (!this.classListArr.includes(c)) this.classListArr.push(c); }); },
      remove: (...cls) => { cls.forEach(c => { const i = this.classListArr.indexOf(c); if (i !== -1) this.classListArr.splice(i, 1); }); },
      toggle: (c, force) => { if (force !== undefined) force ? !this.classListArr.includes(c) && this.classListArr.push(c) : this.classListArr.splice(this.classListArr.indexOf(c), 1); else { const i = this.classListArr.indexOf(c); i === -1 ? this.classListArr.push(c) : this.classListArr.splice(i, 1); } },
    };
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
    for (const c of this.children) checkMatch(c);
    return res;
  }
  addEventListener(evt: string, h: (e: unknown) => void): void { (this as unknown as Record<string, unknown>)["on" + evt] = h; }
  dispatchEvent(evt: string): void { const h = (this as unknown as Record<string, unknown>)["on" + evt]; if (typeof h === "function") h({}); }
  tagName = "DIV";
}

class MockDocument {
  createElement(tag: string): MockElement { const el = new MockElement(); el.ownerDocument = this; el.tagName = tag.toUpperCase(); return el; }
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
    const allBtns = container.querySelectorAll("button");
    const beltBtn = Array.from(allBtns).find(b => b.textContent === "コンベア") as MockElement;
    expect(beltBtn!.className).toContain("selected");
    inputState.mode = "inspect"; inputState.selectedBuilding = null;
    handle.sync(createWorld(42), inputState);
    const inspectBtn = Array.from(allBtns).find(b => b.textContent === "調査") as MockElement;
    expect(inspectBtn!.className).toContain("selected");
    handle.destroy();
  });

  it("destroy() removes wrapper from parent", () => {
    const handle = mountPaletteBar(container as unknown as HTMLElement, { onBuildingSelect: vi.fn(), onRotate: vi.fn(), onDemolish: vi.fn(), onInspectToggle: vi.fn() });
    expect(container.children.length).toBe(1);
    handle.destroy();
    expect(container.children.length).toBe(0);
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

  it("destroy() removes panel from parent", () => {
    const handle = createInspector(container as unknown as HTMLElement, { onRepair: vi.fn(), onSetRecipe: vi.fn() });
    expect(container.children.length).toBe(1);
    handle.destroy();
    expect(container.children.length).toBe(0);
  });
});
