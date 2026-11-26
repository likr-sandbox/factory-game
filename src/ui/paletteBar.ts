// Japanese bottom building palette bar for building selection and actions
import type { WorldState, BuildingType, RecipeId, MaterialId, Direction } from "../sim/types";
import type { InputState } from "../game/input";
import type { InspectorHandle } from "./inspector";

export interface PaletteBarOptions {
  onBuildingSelect: (building: "miner" | "belt" | "splitter" | "smelter" | "assembler") => void;
  onRotate: () => void;
  onDemolish: () => void;
  onInspectToggle: () => void;
}

export interface PaletteBarHandle {
  sync: (world: WorldState, inputState: InputState) => void;
  destroy: () => void;
}

const BUILDING_LABELS: Record<string, string> = {
  miner: "採掘機", belt: "コンベア", splitter: "分配器",
  smelter: "精錬炉", assembler: "組立機",
};

const ACTION_LABELS = {
  rotate: "回転 [R]", demolish: "撤去 [X]", inspect: "調査",
};

export function mountPaletteBar(container: HTMLElement, options: PaletteBarOptions): PaletteBarHandle {
  const doc = container.ownerDocument;
  container.innerHTML = "";

  const wrapper = doc.createElement("div");
  wrapper.style.cssText = "display:flex;align-items:center;gap:12px;width:100%";
  container.appendChild(wrapper);

  const buildingGroup = doc.createElement("div");
  buildingGroup.style.cssText = "display:flex;gap:8px;flex-shrink:0";
  wrapper.appendChild(buildingGroup);

  const buildingButtons: Record<string, HTMLButtonElement> = {};
  const buildingTypes: Array<"miner" | "belt" | "splitter" | "smelter" | "assembler"> = ["miner", "belt", "splitter", "smelter", "assembler"];

  for (const type of buildingTypes) {
    const btn = doc.createElement("button");
    btn.textContent = BUILDING_LABELS[type] ?? type;
    btn.className = "palette-btn";
    btn.style.cssText = "padding:8px 16px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:13px;font-family:'Segoe UI',sans-serif;white-space:nowrap";
    btn.addEventListener("click", () => options.onBuildingSelect(type));
    buildingGroup.appendChild(btn);
    buildingButtons[type] = btn;
  }

  const actionGroup = doc.createElement("div");
  actionGroup.style.cssText = "display:flex;gap:8px;margin-left:16px;flex-shrink:0";
  wrapper.appendChild(actionGroup);

  const rotateBtn = doc.createElement("button");
  rotateBtn.textContent = ACTION_LABELS.rotate;
  rotateBtn.style.cssText = "padding:8px 12px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:13px";
  rotateBtn.addEventListener("click", options.onRotate);
  actionGroup.appendChild(rotateBtn);

  const demolishBtn = doc.createElement("button");
  demolishBtn.textContent = ACTION_LABELS.demolish;
  demolishBtn.style.cssText = "padding:8px 12px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:13px";
  demolishBtn.addEventListener("click", options.onDemolish);
  actionGroup.appendChild(demolishBtn);

  const inspectBtn = doc.createElement("button");
  inspectBtn.textContent = ACTION_LABELS.inspect;
  inspectBtn.style.cssText = "padding:8px 12px;background:#0f3460;color:#eaeaea;border:2px solid #4a4a6a;border-radius:4px;cursor:pointer;font-size:13px";
  inspectBtn.addEventListener("click", options.onInspectToggle);
  actionGroup.appendChild(inspectBtn);

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
  }

  function destroy(): void {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }

  return { sync, destroy };
}
