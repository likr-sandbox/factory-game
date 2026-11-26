// HUD UI for Japanese top status bar
// Pure TypeScript - DOM elements via container.ownerDocument only

import type { WorldState } from "../sim/types";
import { getFactorySummary } from "../sim/query";

export interface HudOptions {
  onSpeedChange?: (speed: number) => void;
  onPausedToggle?: (paused: boolean) => void;
}

export interface HudHandle {
  update(world: WorldState): void;
  destroy(): void;
}

const SPEEDS = [0, 1, 2, 4] as const;
type SpeedValue = (typeof SPEEDS)[number];

let speedToClass: Record<SpeedValue, string> = {
  0: "speed-0",
  1: "speed-1",
  2: "speed-2",
  4: "speed-4",
};

export function mountHud(container: HTMLElement, options: HudOptions = {}): HudHandle {
  const doc = container.ownerDocument;
  if (!doc) {
    throw new Error("Container must have an ownerDocument");
  }

  // Create HUD elements
  const hudEl = doc.createElement("div");
  hudEl.className = "hud-bar";

  // SPM display
  const spmEl = doc.createElement("span");
  spmEl.className = "hud-item spm-display";
  spmEl.textContent = "生産速度/分：--";

  // Tick display
  const tickEl = doc.createElement("span");
  tickEl.className = "hud-item tick-display";
  tickEl.textContent = "ティック：0";

  // Speed controls
  const speedControlsEl = doc.createElement("span");
  speedControlsEl.className = "hud-item speed-controls";

  const pauseBtn = doc.createElement("button");
  pauseBtn.className = "speed-btn";
  pauseBtn.textContent = "一時停止";
  pauseBtn.addEventListener("click", () => {
    options.onPausedToggle?.(true);
    setActiveSpeedButton(speedControlsEl, 0);
    options.onSpeedChange?.(0);
  });

  const speed1Btn = doc.createElement("button");
  speed1Btn.className = "speed-btn";
  speed1Btn.textContent = "1x";
  speed1Btn.addEventListener("click", () => {
    options.onPausedToggle?.(false);
    setActiveSpeedButton(speedControlsEl, 1);
    options.onSpeedChange?.(1);
  });

  const speed2Btn = doc.createElement("button");
  speed2Btn.className = "speed-btn";
  speed2Btn.textContent = "2x";
  speed2Btn.addEventListener("click", () => {
    options.onPausedToggle?.(false);
    setActiveSpeedButton(speedControlsEl, 2);
    options.onSpeedChange?.(2);
  });

  const speed4Btn = doc.createElement("button");
  speed4Btn.className = "speed-btn";
  speed4Btn.textContent = "4x";
  speed4Btn.addEventListener("click", () => {
    options.onPausedToggle?.(false);
    setActiveSpeedButton(speedControlsEl, 4);
    options.onSpeedChange?.(4);
  });

  speedControlsEl.appendChild(pauseBtn);
  speedControlsEl.appendChild(speed1Btn);
  speedControlsEl.appendChild(speed2Btn);
  speedControlsEl.appendChild(speed4Btn);

  // Active/Faulted building counts
  const countEl = doc.createElement("span");
  countEl.className = "hud-item building-counts";
  countEl.textContent = "稼働/故障：0 / 0";

  // Delivered resource counters
  const deliveredEl = doc.createElement("span");
  deliveredEl.className = "hud-item delivered-counters";
  deliveredEl.textContent = "納入数：--";

  hudEl.appendChild(spmEl);
  hudEl.appendChild(tickEl);
  hudEl.appendChild(speedControlsEl);
  hudEl.appendChild(countEl);
  hudEl.appendChild(deliveredEl);

  container.appendChild(hudEl);

  let currentSpeed: SpeedValue = 1;

  function setActiveSpeedButton(parent: HTMLElement, speed: SpeedValue): void {
    const buttons = parent.querySelectorAll(".speed-btn");
    buttons.forEach((btn, idx) => {
      const btnEl = btn as HTMLElement;
      btnEl.classList.remove("active");
      if (SPEEDS[idx] === speed) {
        btnEl.classList.add("active");
      }
    });
  }

  return {
    update(world: WorldState): void {
      const summary = getFactorySummary(world);

      // Update SPM
      spmEl.textContent = `生産速度/分：${summary.spm}`;

      // Update tick
      tickEl.textContent = `ティック：${summary.tick}`;

      // Update building counts
      countEl.textContent = `稼働/故障：${summary.activeCount} / ${summary.faultedCount}`;

      // Update delivered counters - show key materials
      const keyMaterials: Array<{ id: string; label: string }> = [
        { id: "iron_plate", label: "鉄板" },
        { id: "copper_plate", label: "銅板" },
        { id: "iron_gear", label: "鉄ギア" },
        { id: "copper_wire", label: "銅線" },
      ];
      const deliveredParts: string[] = [];
      for (const m of keyMaterials) {
        const amount = summary.delivered[m.id as keyof typeof summary.delivered] ?? 0;
        deliveredParts.push(`${m.label}:${amount}`);
      }
      deliveredEl.textContent = `納入数：${deliveredParts.join(", ")}`;
    },

    destroy(): void {
      if (hudEl.parentNode === container) {
        container.removeChild(hudEl);
      }
    },
  };
}
