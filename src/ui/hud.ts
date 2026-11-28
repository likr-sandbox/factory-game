// HUD UI for Japanese slim top bar with collapsible Tech Tree and Seed popovers
// Pure TypeScript - DOM elements via container.ownerDocument only

import type { WorldState, MaterialId } from "../sim/types";
import { getFactorySummary } from "../sim/query";
import { getTutorialProgress, getTechTreeStatus, getMissingPrerequisites, type TechId } from "../sim/progression";
import { QUEST_DURATION_TICKS, getActiveQuests, getQuestProgress } from "../sim/quests";
import { MATERIAL_CATALOG, TECH_CATALOG } from "../sim/catalog";
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

  // Create HUD container
  const hudEl = doc.createElement("div");
  hudEl.className = "hud-bar";
  hudEl.style.cssText = "display:flex;flex-wrap:nowrap;align-items:center;gap:8px;width:100%;height:100%";

  // SPM display
  const spmEl = doc.createElement("span");
  spmEl.className = "hud-item spm-display";
  spmEl.textContent = "SPM:--";

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

  // Research points display
  const rpEl = doc.createElement("span");
  rpEl.className = "hud-item research-points";
  rpEl.textContent = "RP:0";

  // Tutorial progress display
  const tutorialEl = doc.createElement("span");
  tutorialEl.className = "hud-item tutorial-display";
  tutorialEl.textContent = "チュートリアル：未開始";

  // Quests display
  const questsEl = doc.createElement("span");
  questsEl.className = "hud-item quests-display";
  questsEl.textContent = "クエスト：なし";

  // Tech toggle button
  const techToggleBtn = doc.createElement("button");
  techToggleBtn.className = "tech-toggle-btn";
  techToggleBtn.textContent = "研究";
  techToggleBtn.setAttribute("aria-expanded", "false");
  techToggleBtn.title = "研究ツリーを開く";

  // Tech badge for unlockable count
  const techBadge = doc.createElement("span");
  techBadge.className = "tech-badge";
  techBadge.style.display = "none";
  techBadge.textContent = "0";

  techToggleBtn.appendChild(techBadge);

  // Tech drawer (popover)
  const techDrawerEl = doc.createElement("div");
  techDrawerEl.className = "tech-drawer hud-popover";
  techDrawerEl.style.display = "none";
  techDrawerEl.setAttribute("aria-hidden", "true");

  // Seed toggle button
  const seedToggleBtn = doc.createElement("button");
  seedToggleBtn.className = "seed-toggle-btn";
  seedToggleBtn.textContent = "シード";
  seedToggleBtn.title = "シードリセット";

  // Seed popover
  const seedPopoverEl = doc.createElement("div");
  seedPopoverEl.className = "seed-popover hud-popover";
  seedPopoverEl.style.display = "none";
  seedPopoverEl.setAttribute("aria-hidden", "true");

  const seedInput = doc.createElement("input");
  seedInput.type = "number";
  seedInput.className = "seed-input";
  seedInput.placeholder = "シード値";

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

  seedPopoverEl.appendChild(seedInput);
  seedPopoverEl.appendChild(resetBtn);
  seedPopoverEl.appendChild(randomBtn);

  // Append to HUD bar
  hudEl.appendChild(spmEl);
  hudEl.appendChild(speedControlsEl);
  hudEl.appendChild(countEl);
  hudEl.appendChild(rpEl);
  hudEl.appendChild(tutorialEl);
  hudEl.appendChild(questsEl);
  hudEl.appendChild(techToggleBtn);
  hudEl.appendChild(seedToggleBtn);

  container.appendChild(hudEl);

  // Initialize tech buttons for all TECH_CATALOG entries (one-time generation)
  const techButtonMap: Record<string, { btn: HTMLButtonElement }> = {};
  for (const [techId, tech] of Object.entries(TECH_CATALOG)) {
    const btn = doc.createElement("button");
    btn.className = "tech-btn";
    btn.textContent = `${tech.nameJa} (アンロック)`;
    btn.title = `${tech.nameJa} - RP コスト：${tech.cost}`;
    btn.addEventListener("click", () => {
      options.onUnlockTech?.(techId as keyof typeof TECH_CATALOG);
    });
    techButtonMap[techId] = { btn };
    techDrawerEl.appendChild(btn);
  }

  // Append popovers to container (absolute positioned)
  container.appendChild(techDrawerEl);
  container.appendChild(seedPopoverEl);

  let currentSpeed: SpeedValue = 1;
  let isTechDrawerOpen = false;
  let isSeedPopoverOpen = false;

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

  function countUnlockableTechs(world: WorldState): number {
    const unlockedTechs = new Set(world.unlockedTechs || []);
    let count = 0;
    for (const [techId, tech] of Object.entries(TECH_CATALOG)) {
      if (!unlockedTechs.has(techId) && (world.researchPoints ?? 0) >= tech.cost) {
        // Check prerequisites - only count if all prereqs are met
        const missingPrereqs = getMissingPrerequisites(world, techId as TechId);
        if (missingPrereqs.length === 0) {
          count++;
        }
      }
    }
    return count;
  }

  // Toggle handlers
  techToggleBtn.addEventListener("click", () => {
    isTechDrawerOpen = !isTechDrawerOpen;
    techDrawerEl.style.display = isTechDrawerOpen ? "" : "none";
    techDrawerEl.setAttribute("aria-hidden", isTechDrawerOpen ? "false" : "true");
    techToggleBtn.setAttribute("aria-expanded", isTechDrawerOpen ? "true" : "false");
    
    // Close seed popover if open
    if (isSeedPopoverOpen) {
      isSeedPopoverOpen = false;
      seedPopoverEl.style.display = "none";
      seedPopoverEl.setAttribute("aria-hidden", "true");
      seedToggleBtn.classList.remove("active");
    }
    
    techToggleBtn.classList.toggle("active", isTechDrawerOpen);
  });

  seedToggleBtn.addEventListener("click", () => {
    isSeedPopoverOpen = !isSeedPopoverOpen;
    seedPopoverEl.style.display = isSeedPopoverOpen ? "" : "none";
    seedPopoverEl.setAttribute("aria-hidden", isSeedPopoverOpen ? "false" : "true");
    
    // Close tech drawer if open
    if (isTechDrawerOpen) {
      isTechDrawerOpen = false;
      techDrawerEl.style.display = "none";
      techDrawerEl.setAttribute("aria-hidden", "true");
      techToggleBtn.setAttribute("aria-expanded", "false");
      techToggleBtn.classList.remove("active");
    }
    
    seedToggleBtn.classList.toggle("active", isSeedPopoverOpen);
  });

  return {
    update(world: WorldState): void {
      const summary = getFactorySummary(world);

      // Update SPM
      spmEl.textContent = `SPM:${summary.spm}`;

      // Update building counts
      countEl.textContent = `稼働/故障：${summary.activeCount} / ${summary.faultedCount}`;

      // Update research points
      rpEl.textContent = `RP:${summary.researchPoints}`;

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
      
      // Check if all techs are unlocked
      const allUnlocked = Object.keys(TECH_CATALOG).every(techId => unlockedTechs.has(techId));
      
      if (allUnlocked) {
        // All techs unlocked - hide the tech drawer
        techDrawerEl.style.display = "none";
        techToggleBtn.style.display = "none";
      } else {
        techToggleBtn.style.display = "";
        // Non-destructive update: disable buttons and update labels/costs
        
        // Update each tech button
        const updateTechBtn = (techId: string) => {
          const entry = techButtonMap[techId];
          if (!entry) return;
          const { btn } = entry;
          const tech = TECH_CATALOG[techId];
          if (!tech) return; // Guard against missing catalog entry
          const cost = tech.cost;
          
          // Check for missing prerequisites
          const missingPrereqs = getMissingPrerequisites(world, techId as TechId);
          
          if (unlockedTechs.has(techId)) {
            // Already unlocked - hide button
            btn.disabled = true;
            btn.style.display = "none";
          } else if (missingPrereqs.length > 0) {
            // Prerequisites not met - disable with prerequisite message
            btn.disabled = true;
            btn.style.display = "";
            const prereqLabels = missingPrereqs.map(p => TECH_CATALOG[p]?.nameJa ?? p).join(", ");
            btn.textContent = `${tech.nameJa} (要:${prereqLabels})`;
            btn.title = `${tech.nameJa} - 前提技術：${prereqLabels}（未解放）`;
          } else if ((world.researchPoints ?? 0) < cost) {
            // RP 不足で無効化
            btn.disabled = true;
            btn.style.display = "";
            btn.textContent = `${tech.nameJa} (${cost}RP - 不足)`;
            btn.title = `${tech.nameJa} - RP コスト：${cost}（現在：${world.researchPoints ?? 0}）`;
          } else {
            btn.disabled = false;
            btn.style.display = "";
            btn.textContent = `${tech.nameJa} (${cost}RP)`;
            btn.title = `${tech.nameJa} - RP コスト：${cost}`;
          }
        };
        
        // Update all tech buttons from TECH_CATALOG
        for (const techId of Object.keys(TECH_CATALOG)) {
          updateTechBtn(techId);
        }

        // Update unlockable badge
        const unlockableCount = countUnlockableTechs(world);
        if (unlockableCount > 0 && !allUnlocked) {
          techBadge.textContent = String(unlockableCount);
          techBadge.style.display = "";
          techToggleBtn.classList.add("has-unlockable");
        } else {
          techBadge.style.display = "none";
          techToggleBtn.classList.remove("has-unlockable");
        }
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
      if (techDrawerEl.parentNode === container) {
        container.removeChild(techDrawerEl);
      }
      if (seedPopoverEl.parentNode === container) {
        container.removeChild(seedPopoverEl);
      }
    },
  };
}
