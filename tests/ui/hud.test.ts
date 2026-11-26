// HUD tests - Lightweight Node stubs, no jsdom or happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountHud } from "../../src/ui/hud";
import { createWorld } from "../../src/sim/world";
import type { WorldState } from "../../src/sim/types";

class MockElement {
  public children: MockElement[] = [];
  public textContent: string = "";
  public style: Record<string, string> = {};
  public attributes: Map<string, string> = new Map();
  public className: string = "";
  public id: string = "";
  public parentNode: MockElement | null = null;
  public ownerDocument: MockDocument | null = null;

  appendChild(child: MockElement): void { child.parentNode = this; this.children.push(child); }
  removeChild(child: MockElement): void { const idx = this.children.indexOf(child); if (idx !== -1) { this.children.splice(idx, 1); child.parentNode = null; } }
  querySelectorAll(sel: string): MockElement[] { return sel === ".speed-btn" ? this.children.filter(c => c.className === "speed-btn") : []; }
  classList = { add: (cls: string) => { if (!this.className.includes(cls)) this.className += ` ${cls}`; }, remove: (cls: string) => { this.className = this.className.replace(cls, "").trim(); } };
  addEventListener(event: string, handler: (e: unknown) => void): void { (this as unknown as Record<string, unknown>)[`on${event}`] = handler; }
  dispatchEvent(event: string): void { const h = (this as unknown as Record<string, unknown>)[`on${event}`]; if (typeof h === "function") h({}); }
}

class MockDocument {
  createElement(tag: string): MockElement { const el = new MockElement(); el.ownerDocument = this; return el; }
}

function makeWorld(): WorldState {
  const w = createWorld(42);
  w.tick = 100;
  w.delivered = { iron_plate: 10, copper_plate: 5, iron_gear: 3, copper_wire: 8 };
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
    expect(container.children[0]!.children[4]!.textContent).toBe("納入数：鉄板:100, 銅板:50, 鉄ギア:25, 銅線:75");
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
    const empty: WorldState = { seed: 42, width: 10, height: 10, tick: 0, rngState: 42, tiles: [], buildings: {}, nextBuildingId: 1, hubOrigin: { x: 0, y: 0 }, delivered: {}, deliveryHistory: [], unlockedTechs: [], completedQuests: [] };
    handle.update(empty);
    expect(container.children[0]!.children[0]!.textContent).toBe("生産速度/分：0");
    expect(container.children[0]!.children[1]!.textContent).toBe("ティック：0");
    expect(container.children[0]!.children[3]!.textContent).toBe("稼働/故障：0 / 0");
    handle.destroy();
  });
});
