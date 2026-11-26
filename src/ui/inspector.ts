// Japanese building inspector panel with repair button and recipe selector
import type { WorldState, BuildingState, RecipeId } from "../sim/types";
import { RECIPE_CATALOG } from "../sim/catalog";
import { setRecipe } from "../sim/actions";

export interface InspectorCallbacks {
  onRepair: (x: number, y: number) => void;
  onSetRecipe: (x: number, y: number, recipeId: RecipeId) => void;
}

export interface InspectorHandle {
  update: (world: WorldState, coord: { x: number; y: number } | null) => void;
  destroy: () => void;
}

const LABELS = {
  repair: "修理",
  recipe: "レシピ選択",
  none: "建物なし",
  faulted: "(故障)",
  blank: "- なし -",
};

const BUILDING_NAMES: Record<string, string> = {
  smelter: "溶鉱炉", assembler: "組立機", miner: "採掘ドリル",
  belt: "コンベアベルト", splitter: "分配機", hub: "中枢納品ハブ",
};

export function createInspector(container: HTMLElement, callbacks: InspectorCallbacks): InspectorHandle {
  const doc = container.ownerDocument;
  const panel = doc.createElement("div");
  panel.style.cssText = "background:rgba(22,33,62,0.95);border:2px solid #4a4a6a;border-radius:8px;padding:12px;min-width:200px;color:#eaeaea;font-family:'Segoe UI',sans-serif";
  container.appendChild(panel);

  const infoDiv = doc.createElement("div");
  infoDiv.style.cssText = "margin-bottom:12px;padding:8px;background:rgba(15,52,96,0.9);border-radius:4px;min-height:24px";
  panel.appendChild(infoDiv);

  const repairBtn = doc.createElement("button");
  repairBtn.textContent = LABELS.repair;
  repairBtn.style.cssText = "display:none;width:100%;padding:8px;margin-bottom:8px;background:#e94560;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px";
  repairBtn.addEventListener("click", () => currentCoord && callbacks.onRepair(currentCoord.x, currentCoord.y));
  panel.appendChild(repairBtn);

  const recipeLabel = doc.createElement("div");
  recipeLabel.textContent = LABELS.recipe;
  recipeLabel.style.cssText = "display:none;font-size:12px;margin-bottom:4px;color:#b8b8b8";
  panel.appendChild(recipeLabel);

  const recipeSelect = doc.createElement("select");
  recipeSelect.style.cssText = "display:none;width:100%;padding:6px;background:rgba(15,52,96,0.9);color:#eaeaea;border:1px solid #4a4a6a;border-radius:4px;font-size:13px";
  recipeSelect.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    currentCoord && target.value && callbacks.onSetRecipe(currentCoord.x, currentCoord.y, target.value as RecipeId);
  });
  panel.appendChild(recipeSelect);

  let currentCoord: { x: number; y: number } | null = null;

  function populateRecipes(buildingType: "smelter" | "assembler"): void {
    recipeSelect.innerHTML = "";
    const empty = doc.createElement("option");
    empty.value = ""; empty.textContent = LABELS.blank;
    recipeSelect.appendChild(empty);
    for (const [id, recipe] of Object.entries(RECIPE_CATALOG)) {
      if (recipe.building === buildingType) {
        const opt = doc.createElement("option");
        opt.value = id; opt.textContent = recipe.nameJa;
        recipeSelect.appendChild(opt);
      }
    }
  }

  function updateBuildingInfo(building: BuildingState | null): void {
    if (!building) {
      infoDiv.textContent = LABELS.none;
      repairBtn.style.display = recipeLabel.style.display = recipeSelect.style.display = "none";
      return;
    }
    infoDiv.textContent = BUILDING_NAMES[building.type] + (building.faulted ? ` ${LABELS.faulted}` : "");
    repairBtn.style.display = building.faulted ? "block" : "none";

    if (building.type === "smelter" || building.type === "assembler") {
      recipeLabel.style.display = recipeSelect.style.display = "block";
      populateRecipes(building.type);
      recipeSelect.value = building.recipeId ?? "";
    } else {
      recipeLabel.style.display = recipeSelect.style.display = "none";
    }
  }

  function update(world: WorldState, coord: { x: number; y: number } | null): void {
    currentCoord = coord;
    let building: BuildingState | null = null;
    if (coord && coord.x >= 0 && coord.x < world.width && coord.y >= 0 && coord.y < world.height) {
      const tile = world.tiles[coord.y]?.[coord.x];
      if (tile?.buildingId) building = world.buildings[tile.buildingId] ?? null;
    }
    updateBuildingInfo(building);
  }

  function destroy(): void { if (panel.parentNode) panel.parentNode.removeChild(panel); }
  return { update, destroy };
}
