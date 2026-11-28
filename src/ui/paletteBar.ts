// Japanese bottom building palette bar for building selection and actions
import type { WorldState, BuildingType, RecipeId, MaterialId, Direction } from "../sim/types";
import type { InputState } from "../game/input";
import type { InspectorHandle } from "./inspector";
import { isBuildingUnlocked } from "../sim/progression";

export interface PaletteBarOptions {
  onBuildingSelect: (building: "miner" | "belt" | "splitter" | "filter_splitter" | "underground_belt" | "smelter" | "assembler" | "recycler" | "sensor") => void;
  onRotate: () => void;
  onDemolish: () => void;
  onInspectToggle: () => void;
}

export interface PaletteBarHandle {
  sync: (world: WorldState, inputState: InputState) => void;
  setFeedback: (message: string | null) => void;
  destroy: () => void;
}

const BUILDING_LABELS: Record<string, string> = {
  miner: "採掘機", belt: "コンベア", splitter: "分配器",
  filter_splitter: "フィルター分配機", underground_belt: "交差ブリッジ",
  smelter: "溶鉱炉", assembler: "組立機", recycler: "不純物処理炉", sensor: "センサー",
};

const ACTION_LABELS = {
  rotate: "回転 [R]", demolish: "撤去 [X]", inspect: "調査",
};

export function mountPaletteBar(container: HTMLElement, options: PaletteBarOptions): PaletteBarHandle {
  const doc = container.ownerDocument;
  container.innerHTML = "";

  const wrapper = doc.createElement("div");
  wrapper.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:6px;width:100%";
  container.appendChild(wrapper);

  const buildingGroup = doc.createElement("div");
  buildingGroup.style.cssText = "display:flex;gap:6px;flex-shrink:0";
  wrapper.appendChild(buildingGroup);

  const buildingButtons: Record<string, HTMLButtonElement> = {};
  const buildingTypes: Array<"miner" | "belt" | "splitter" | "filter_splitter" | "underground_belt" | "smelter" | "assembler" | "recycler" | "sensor"> = ["miner", "belt", "splitter", "filter_splitter", "underground_belt", "smelter", "assembler", "recycler", "sensor"];

  for (const type of buildingTypes) {
    const btn = doc.createElement("button");
    btn.textContent = BUILDING_LABELS[type] ?? type;
    btn.className = "palette-btn";
    btn.style.cssText = "padding:6px 10px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:12px;font-family:'Segoe UI',sans-serif;white-space:nowrap";
    btn.addEventListener("click", () => options.onBuildingSelect(type));
    buildingGroup.appendChild(btn);
    buildingButtons[type] = btn;
  }

  const actionGroup = doc.createElement("div");
  actionGroup.style.cssText = "display:flex;gap:6px;flex-shrink:0;align-items:center";
  wrapper.appendChild(actionGroup);

  const directionIndicator = doc.createElement("span");
  directionIndicator.className = "direction-indicator";
  directionIndicator.style.cssText = "font-size:12px;color:#eaeaea;margin-right:4px";
  actionGroup.appendChild(directionIndicator);

  const rotateBtn = doc.createElement("button");
  rotateBtn.textContent = ACTION_LABELS.rotate;
  rotateBtn.style.cssText = "padding:6px 10px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:12px";
  rotateBtn.addEventListener("click", options.onRotate);
  actionGroup.appendChild(rotateBtn);

  const demolishBtn = doc.createElement("button");
  demolishBtn.textContent = ACTION_LABELS.demolish;
  demolishBtn.style.cssText = "padding:6px 10px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:12px";
  demolishBtn.addEventListener("click", options.onDemolish);
  actionGroup.appendChild(demolishBtn);

  const inspectBtn = doc.createElement("button");
  inspectBtn.textContent = ACTION_LABELS.inspect;
  inspectBtn.style.cssText = "padding:6px 10px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:12px";
  inspectBtn.addEventListener("click", options.onInspectToggle);
  actionGroup.appendChild(inspectBtn);

  const feedbackElement = doc.createElement("span");
  feedbackElement.className = "palette-feedback";
  feedbackElement.style.cssText = "font-size:12px;color:#ff6b6b;margin-left:8px";
  wrapper.appendChild(feedbackElement);

  function updateClasses(inputState: InputState): void {
    for (const type of buildingTypes) {
      const btn = buildingButtons[type];
      if (!btn) continue;
      if (inputState.selectedBuilding === type && inputState.mode === "place") {
        btn.classList.add("selected");
        btn.style.borderColor = "#e94560";
        btn.style.boxShadow = "0 0 8px #e94560";
      } else {
        btn.classList.remove("selected");
        btn.style.borderColor = "";
        btn.style.boxShadow = "";
      }
    }

    const isInspect = inputState.mode === "inspect";
    inspectBtn.style.borderColor = isInspect ? "#e94560" : "";
    inspectBtn.style.boxShadow = isInspect ? "0 0 8px #e94560" : "";
    inspectBtn.classList.toggle("selected", isInspect);

    const isDemolish = inputState.mode === "demolish";
    demolishBtn.style.borderColor = isDemolish ? "#e94560" : "";
    demolishBtn.style.boxShadow = isDemolish ? "0 0 8px #e94560" : "";
    demolishBtn.classList.toggle("selected", isDemolish);
  }

  function sync(world: WorldState, inputState: InputState): void {
    updateClasses(inputState);

    // Update direction indicator
    directionIndicator.textContent = `向き：${inputState.direction}`;

    // Handle locked building buttons
    for (const type of buildingTypes) {
      const btn = buildingButtons[type];
      if (!btn) continue;
      const unlocked = isBuildingUnlocked(world, type);
      btn.disabled = !unlocked;
      btn.classList.toggle("locked", !unlocked);
      if (!unlocked) {
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.title = "未解放（テック研究が必要）";
      } else {
        btn.style.opacity = "";
        btn.style.cursor = "";
        btn.title = "";
      }
    }
  }

  function setFeedback(message: string | null): void {
    feedbackElement.textContent = message ?? "";
  }

  function destroy(): void {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }

  return { sync, setFeedback, destroy };
}
