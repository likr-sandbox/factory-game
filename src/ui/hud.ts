// HUD UI for Japanese top status bar
// Pure TypeScript - DOM elements via container.ownerDocument only

import type { WorldState, MaterialId } from "../sim/types";
import { getFactorySummary } from "../sim/query";
import { getTutorialProgress, getTechTreeStatus } from "../sim/progression";
import { getActiveQuests, getQuestProgress } from "../sim/quests";
import { QUEST_DURATION_TICKS } from "../sim/quests";
import { MATERIAL_CATALOG } from "../sim/catalog";
import { TICKS_PER_MINUTE } from "../sim/constants";

export interface HudOptions {
  onSpeedChange?: (speed: number) => void;
  onPausedToggle?: (paused: boolean) => void;
  onUnlockTech?: (techId: string) => void;
  onResetWorld?: (seed: number) => void;
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
  hudEl.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:100%";

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

  // Initialize 1x button as active (default speed)
  speed1Btn.classList.add("active");

  // Active/Faulted building counts
  const countEl = doc.createElement("span");
  countEl.className = "hud-item building-counts";
  countEl.textContent = "稼働/故障：0 / 0";

  // Delivered resource counters
  const deliveredEl = doc.createElement("span");
  deliveredEl.className = "hud-item delivered-counters";
  deliveredEl.textContent = "納入数：--";

  // Research points display
  const rpEl = doc.createElement("span");
  rpEl.className = "hud-item research-points";
  rpEl.textContent = "研究ポイント：0";

  // Tutorial progress display
  const tutorialEl = doc.createElement("span");
  tutorialEl.className = "hud-item tutorial-display";
  tutorialEl.textContent = "チュートリアル：--";

  // Tech tree container (will be populated with 8 tech buttons in mountHud)
  const techTreeEl = doc.createElement("span");
  techTreeEl.className = "hud-item tech-tree";
  techTreeEl.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;align-items:center";

  // Active quests display
  const questsEl = doc.createElement("span");
  questsEl.className = "hud-item quests-display";
  questsEl.textContent = "クエスト：なし";

  // Seed reset controls
  const seedResetEl = doc.createElement("span");
  seedResetEl.className = "hud-item seed-reset";

  const seedInput = doc.createElement("input");
  seedInput.type = "number";
  seedInput.className = "seed-input";
  seedInput.placeholder = "シード値";
  seedInput.style.width = "80px";

  const resetBtn = doc.createElement("button");
  resetBtn.className = "reset-btn";
  resetBtn.textContent = "リセット";
  resetBtn.addEventListener("click", () => {
    const seedVal = parseInt(seedInput.value, 10);
    if (!isNaN(seedVal)) {
      options.onResetWorld?.(seedVal);
    }
  });

  const randomBtn = doc.createElement("button");
  randomBtn.className = "random-btn";
  randomBtn.textContent = "ランダム";
  randomBtn.addEventListener("click", () => {
    const randomSeed = Math.floor(Math.random() * 2147483647);
    seedInput.value = String(randomSeed);
    options.onResetWorld?.(randomSeed);
  });

  seedResetEl.appendChild(seedInput);
  seedResetEl.appendChild(resetBtn);
  seedResetEl.appendChild(randomBtn);

  hudEl.appendChild(spmEl);
  hudEl.appendChild(tickEl);
  hudEl.appendChild(speedControlsEl);
  hudEl.appendChild(countEl);
  hudEl.appendChild(deliveredEl);
  hudEl.appendChild(rpEl);
  hudEl.appendChild(tutorialEl);
  hudEl.appendChild(techTreeEl);
  hudEl.appendChild(questsEl);
  hudEl.appendChild(seedResetEl);

  container.appendChild(hudEl);

  // Initialize tech buttons for all 8 TECH_CATALOG entries (one-time generation)
  const techButtonMap: Record<string, { btn: HTMLButtonElement; cost: number }> = {};
  const TECH_BUTTONS: Array<{ techId: string; label: string; cost: number }> = [
    { techId: "filter_splitter", label: "フィルター分配機", cost: 100 },
    { techId: "underground_belt", label: "交差ブリッジ", cost: 150 },
    { techId: "high_efficiency", label: "高効率製錬", cost: 200 },
    { techId: "sensor", label: "センサー", cost: 150 },
    { techId: "recycler", label: "不純物処理炉", cost: 200 },
    { techId: "advanced_smelting", label: "高度精錬技術", cost: 200 },
    { techId: "electronics", label: "電子工業", cost: 300 },
    { techId: "automation", label: "自動化研究", cost: 500 },
  ];
  for (const t of TECH_BUTTONS) {
    const btn = doc.createElement("button");
    btn.className = "tech-btn";
    btn.textContent = `${t.label} (アンロック)`;
    btn.title = `${t.label} - RP コスト：${t.cost}`;
    btn.addEventListener("click", () => {
      options.onUnlockTech?.(t.techId);
    });
    techButtonMap[t.techId] = { btn, cost: t.cost };
    techTreeEl.appendChild(btn);
  }

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

      // Update delivered counters - show key materials including mid-game items with delivered > 0
      const keyMaterials: Array<{ id: string; label: string }> = [
        { id: "iron_plate", label: "鉄板" },
        { id: "copper_plate", label: "銅板" },
        { id: "iron_gear", label: "鉄歯車" },
        { id: "copper_wire", label: "銅線" },
      ];
      const deliveredParts: string[] = [];
      for (const m of keyMaterials) {
        const amount = summary.delivered[m.id as keyof typeof summary.delivered] ?? 0;
        deliveredParts.push(`${m.label}:${amount}`);
      }
      // Add mid-game materials with delivered > 0
      const midGameMaterials: Array<{ id: string; label: string }> = [
        { id: "steel_plate", label: "鋼板" },
        { id: "silicon_wafer", label: "シリコンウェハ" },
        { id: "circuit_board", label: "電子基板" },
        { id: "microchip", label: "マイクロチップ" },
        { id: "automation_module", label: "自動化モジュール" },
      ];
      for (const m of midGameMaterials) {
        const amount = summary.delivered[m.id as keyof typeof summary.delivered] ?? 0;
        if (amount > 0) {
          deliveredParts.push(`${m.label}:${amount}`);
        }
      }
      deliveredEl.textContent = `納入数：${deliveredParts.join(", ")}`;

      // Update research points
      rpEl.textContent = `研究ポイント：${summary.researchPoints}`;

      // Update tutorial progress
      const tutorialProg = getTutorialProgress(world);
      if (tutorialProg.phase === 0) {
        tutorialEl.textContent = "チュートリアル：未開始";
      } else {
        const phaseLabel = `Phase ${tutorialProg.phase}`;
        if (tutorialProg.currentStep) {
          tutorialEl.textContent = `チュートリアル：${phaseLabel} - ${tutorialProg.currentStep.titleJa}`;
        } else if (tutorialProg.isComplete) {
          tutorialEl.textContent = `チュートリアル：${phaseLabel} 完了`;
        } else {
          tutorialEl.textContent = `チュートリアル：${phaseLabel}`;
        }
      }

      // Update tech tree buttons non-destructively
      const unlockedTechs = new Set(world.unlockedTechs || []);
      const allUnlocked = TECH_BUTTONS.every(t => unlockedTechs.has(t.techId));
      
      if (allUnlocked) {
        // All techs unlocked - hide the tech tree container
        techTreeEl.style.display = "none";
      } else {
        techTreeEl.style.display = "";
        // Non-destructive update: disable buttons and update labels/costs
        
        // Update each tech button
        const updateTechBtn = (techId: string, isUnlocked: boolean) => {
          const entry = techButtonMap[techId];
          if (!entry) return;
          const { btn, cost } = entry;
          const techLabel = TECH_BUTTONS.find(t => t.techId === techId)?.label || techId;
          
          if (isUnlocked) {
            btn.disabled = true;
            btn.style.display = "none";
          } else if ((world.researchPoints ?? 0) < cost) {
            // RP 不足で無効化
            btn.disabled = true;
            btn.style.display = "";
            btn.textContent = `${techLabel} (${cost}RP - 不足)`;
            btn.title = `${techLabel} - RP コスト：${cost}（現在：${world.researchPoints ?? 0}）`;
          } else {
            btn.disabled = false;
            btn.style.display = "";
            btn.textContent = `${techLabel} (${cost}RP)`;
            btn.title = `${techLabel} - RP コスト：${cost}`;
          }
        };
        
        updateTechBtn("filter_splitter", unlockedTechs.has("filter_splitter"));
        updateTechBtn("underground_belt", unlockedTechs.has("underground_belt"));
        updateTechBtn("high_efficiency", unlockedTechs.has("high_efficiency"));
        updateTechBtn("sensor", unlockedTechs.has("sensor"));
        updateTechBtn("recycler", unlockedTechs.has("recycler"));
        updateTechBtn("advanced_smelting", unlockedTechs.has("advanced_smelting"));
        updateTechBtn("electronics", unlockedTechs.has("electronics"));
        updateTechBtn("automation", unlockedTechs.has("automation"));
      }

      // Update active quests with material names from MATERIAL_CATALOG
      const activeQuests = getActiveQuests(world);
      if (activeQuests.length === 0) {
        questsEl.textContent = "クエスト：なし";
      } else {
        const questLabels: string[] = [];
        for (const quest of activeQuests) {
          const progress = getQuestProgress(quest);
          const parts: string[] = [];
          for (const [material, prog] of Object.entries(progress)) {
            // Get material name from MATERIAL_Catalog
            const matEntry = MATERIAL_CATALOG[material as MaterialId];
            const matName = matEntry ? matEntry.nameJa : material;
            parts.push(`${matName} ${prog.current}/${prog.target}`);
          }
          const remainingTicks = Math.max(0, QUEST_DURATION_TICKS - (world.tick - quest.startedAtTick));
          questLabels.push(`[${parts.join(", ")} 残り${Math.ceil(remainingTicks / TICKS_PER_MINUTE)}分]`);
        }
        questsEl.textContent = `クエスト：${questLabels.join(", ")}`;
      }
    },

    destroy(): void {
      if (hudEl.parentNode === container) {
        container.removeChild(hudEl);
      }
    },
  };
}
