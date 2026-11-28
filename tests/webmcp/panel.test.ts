// WebMCP Panel Tests - Lightweight Node stubs, no jsdom or Phaser
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountWebMcpPanel } from "../../src/ui/webmcpPanel";
import { registerFactoryWebMcpTools } from "../../src/webmcp/bridge";
import { createWorld } from "../../src/sim/world";
import type { WebMcpHandle } from "../../src/webmcp/types";

// Lightweight MockDocument / MockElement Stubs
class MockElement {
  public children: MockElement[] = [];
  public textContent: string = "";
  public style: Record<string, string> = {};
  public attributes: Map<string, string> = new Map();
  public parentNode: MockElement | null = null;
  public ownerDocument: MockDocument | null = null;
  private _classListSet: Set<string> = new Set();
  private _className: string = "";

  set className(val: string) {
    this._classListSet.clear();
    if (val) {
      for (const cls of val.split(" ")) {
        if (cls) this._classListSet.add(cls);
      }
    }
    this._className = val;
  }
  get className(): string {
    return this._className;
  }

  get classList(): { contains(cls: string): boolean; add(cls: string): void; remove(cls: string): void; toggle(cls: string): void } {
    return {
      contains: (cls: string) => this._classListSet.has(cls),
      add: (cls: string) => this._classListSet.add(cls),
      remove: (cls: string) => { this._classListSet.delete(cls); },
      toggle: (cls: string) => {
        if (this._classListSet.has(cls)) {
          this._classListSet.delete(cls);
          return false;
        } else {
          this._classListSet.add(cls);
          return true;
        }
      }
    };
  }

  appendChild(child: MockElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  removeChild(child: MockElement): void {
    const idx = this.children.indexOf(child);
    if (idx !== -1) { this.children.splice(idx, 1); child.parentNode = null; }
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  addEventListener(event: string, handler: (e: unknown) => void): void {
    (this as unknown as Record<string, unknown>)[`on${event}`] = handler;
  }
  dispatchEvent(event: string): void {
    const handler = (this as unknown as Record<string, unknown>)[`on${event}`];
    if (typeof handler === "function") handler({});
  }
}

class MockDocument {
  createElement(tag: string): MockElement {
    const el = new MockElement();
    el.ownerDocument = this;
    return el;
  }
}

describe("mountWebMcpPanel", () => {
  let container: MockElement;
  let doc: MockDocument;

  beforeEach(() => {
    doc = new MockDocument();
    container = doc.createElement("div");
  });

  it("should render panel with Japanese title and toggle button in collapsed state", () => {
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42), env: { document: {} } });
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    expect(container.children).toHaveLength(1);
    const panel = container.children[0]!;
    expect(panel.className).toBe("webmcp-panel");
    expect(panel.classList.contains("collapsed")).toBe(true);
    expect(panel.children).toHaveLength(2);
    const header = panel.children[0]!;
    expect(header.children).toHaveLength(2);
    expect(header.children[0]!.textContent).toBe("WebMCP 連携");
    expect(header.children[1]!.textContent).toBe("展開");
    expect(header.children[1]!.getAttribute("aria-expanded")).toBe("false");
    unsubscribe();
  });

  it("should show '接続済み' badge and 'WebMCP 接続済み' when detected is true", () => {
    const mockContext = { registerTool: vi.fn() };
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42), env: { document: { modelContext: mockContext } } });
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    const panel = container.children[0]!;
    const content = panel.children[1]!;
    const badge = content.children[0]!;
    const status = content.children[1]!;
    expect(badge.textContent).toBe("接続済み");
    expect(status.textContent).toContain("WebMCP 接続済み");
    expect(status.textContent).toContain("document.modelContext");
    unsubscribe();
  });

  it("should show '手動' badge and 'WebMCP 未検出（手動プレイモード）' when detected is false", () => {
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42) });
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    const panel = container.children[0]!;
    const content = panel.children[1]!;
    const badge = content.children[0]!;
    const status = content.children[1]!;
    expect(badge.textContent).toBe("手動");
    expect(status.textContent).toBe("WebMCP 未検出（手動プレイモード）");
    unsubscribe();
  });

  it("should collapse/expand on toggle button click", () => {
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42), env: { document: {} } });
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    const panel = container.children[0]!;
    const toggleBtn = panel.children[0]!.children[1]!;
    const content = panel.children[1]!;
    // Initial collapsed state
    expect(panel.classList.contains("collapsed")).toBe(true);
    expect(content.style.display).toBe("none");
    expect(toggleBtn.textContent).toBe("展開");
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    // Expand
    toggleBtn.dispatchEvent("click");
    expect(panel.classList.contains("collapsed")).toBe(false);
    expect(content.style.display || "").toBe("");
    expect(toggleBtn.textContent).toBe("折りたたみ");
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
    // Collapse again
    toggleBtn.dispatchEvent("click");
    expect(panel.classList.contains("collapsed")).toBe(true);
    expect(content.style.display).toBe("none");
    expect(toggleBtn.textContent).toBe("展開");
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    unsubscribe();
  });

  it("should render existing logs on mount", () => {
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42) });
    handle.invokeTool("get_factory_summary", {});
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    const logList = container.children[0]!.children[1]!.children[2]!;
    expect(logList.children).toHaveLength(1);
    expect(logList.children[0]!.children[2]!.textContent).toBe("成功");
    unsubscribe();
  });

  it("should add new log entries in real-time via subscription", async () => {
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42) });
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    const logList = container.children[0]!.children[1]!.children[2]!;
    expect(logList.children).toHaveLength(0);
    await handle.invokeTool("get_metrics", {});
    expect(logList.children).toHaveLength(1);
    expect(logList.children[0]!.children[1]!.textContent).toBe("get_metrics");
    expect(logList.children[0]!.children[2]!.textContent).toBe("成功");
    unsubscribe();
  });

  it("should mark failed tool calls with '失敗'", async () => {
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42) });
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    await handle.invokeTool("place_building", { x: 31, y: 31, type: "miner", direction: "N" });
    const logList = container.children[0]!.children[1]!.children[2]!;
    expect(logList.children[0]!.children[2]!.textContent).toBe("失敗");
    unsubscribe();
  });

  it("should cleanup on returned unsubscribe call", () => {
    const handle = registerFactoryWebMcpTools({ getWorld: () => createWorld(42), env: { document: {} } });
    const unsubscribe = mountWebMcpPanel(container as unknown as HTMLElement, handle as WebMcpHandle);
    expect(container.children).toHaveLength(1);
    unsubscribe();
    expect(container.children).toHaveLength(0);
  });
});
