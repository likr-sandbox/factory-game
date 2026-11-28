// Japanese building inspector panel with repair button and recipe selector
import type { WorldState, BuildingState, RecipeId, MaterialId } from "../sim/types";
import { RECIPE_CATALOG, MATERIAL_CATALOG } from "../sim/catalog";
import { setRecipe } from "../sim/actions";
import { isRecipeUnlocked } from "../sim/progression";

export interface InspectorCallbacks {
  onRepair: (x: number, y: number) => void;
  onSetRecipe: (x: number, y: number, recipeId: RecipeId) => void;
  onSetFilter?: (x: number, y: number, material: MaterialId | null) => void;
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
  filter_splitter: "フィルター分配機", underground_belt: "交差ブリッジ",
  recycler: "不純物処理炉", sensor: "センサー",
};

export function createInspector(container: HTMLElement, callbacks: InspectorCallbacks): InspectorHandle {
  const doc = container.ownerDocument;
  const panel = doc.createElement("div");
  panel.className = "inspector-panel";
  panel.style.cssText = "background:rgba(22,33,62,0.95);border:2px solid #4a4a6a;border-radius:8px;padding:12px;min-width:220px;color:#eaeaea;font-family:'Segoe UI',sans-serif";
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

  // Filter material selector for filter_splitter
  const filterLabel = doc.createElement("div");
  filterLabel.textContent = "フィルター素材:";
  filterLabel.style.cssText = "display:none;font-size:12px;margin-bottom:4px;color:#b8b8b8";
  panel.appendChild(filterLabel);

  const filterSelect = doc.createElement("select");
  filterSelect.style.cssText = "display:none;width:100%;padding:6px;background:rgba(15,52,96,0.9);color:#eaeaea;border:1px solid #4a4a6a;border-radius:4px;font-size:13px";
  filterSelect.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    currentCoord && callbacks.onSetFilter?.(currentCoord.x, currentCoord.y, target.value === "" ? null : target.value as MaterialId);
  });
  panel.appendChild(filterSelect);

  // Sensor alert display area
  const sensorAlertLabel = doc.createElement("div");
  sensorAlertLabel.textContent = "センサー情報:";
  sensorAlertLabel.style.cssText = "display:none;font-size:12px;margin-bottom:4px;color:#b8b8b8";
  panel.appendChild(sensorAlertLabel);

  const sensorAlertInfo = doc.createElement("div");
  sensorAlertInfo.style.cssText = "display:none;font-size:11px;color:#ffeb3b;padding:4px;background:rgba(255,235,59,0.1);border-radius:4px;min-height:20px";
  panel.appendChild(sensorAlertInfo);

  let currentCoord: { x: number; y: number } | null = null;
  let lastPopulatedType: "smelter" | "assembler" | null = null;
  let filterMaterialsPopulated = false;

  function populateRecipes(buildingType: "smelter" | "assembler"): void {
    recipeSelect.innerHTML = "";
    const empty = doc.createElement("option");
    empty.value = ""; empty.textContent = LABELS.blank;
    recipeSelect.appendChild(empty);
    for (const [id, recipe] of Object.entries(RECIPE_CATALOG)) {
      if (recipe.building === buildingType) {
        const opt = doc.createElement("option");
        opt.value = id; opt.textContent = recipe.nameJa;
        // Disable options for recipes that are not unlocked
        if (worldStateForRecipeCheck) {
          opt.disabled = !isRecipeUnlocked(worldStateForRecipeCheck, id as RecipeId);
        } else {
          opt.disabled = false; // Default to enabled when no world state available
        }
        recipeSelect.appendChild(opt);
      }
    }
    lastPopulatedType = buildingType;
  }

  // Store world state for recipe unlock checking
  let worldStateForRecipeCheck: WorldState | null = null;

  function populateFilterMaterials(): void {
    filterSelect.innerHTML = "";
    const empty = doc.createElement("option");
    empty.value = ""; empty.textContent = "- なし -";
    filterSelect.appendChild(empty);
    for (const [id, material] of Object.entries(MATERIAL_CATALOG)) {
      if (material.category === "raw" || material.category === "intermediate" || material.category === "part") {
        const opt = doc.createElement("option");
        opt.value = id; opt.textContent = material.nameJa;
        filterSelect.appendChild(opt);
      }
    }
  }

  function updateSensorAlerts(world: WorldState, coord: { x: number; y: number }): void {
    // Check adjacent tiles for alerts (faulted buildings or low flow)
    const directions = ["N", "E", "S", "W"] as const;
    const alerts: string[] = [];
    
    for (const dir of directions) {
      let nx = coord.x, ny = coord.y;
      if (dir === "N") ny--;
      else if (dir === "E") nx++;
      else if (dir === "S") ny++;
      else if (dir === "W") nx--;
      
      if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
        const tile = world.tiles[ny]?.[nx];
        if (tile?.buildingId) {
          const building = world.buildings[tile.buildingId];
          if (building) {
            if (building.faulted) {
              alerts.push(`${dir}:故障`);
            }
            // Could also check belt flow here if needed
          }
        }
      }
    }
    
    if (alerts.length > 0) {
      sensorAlertInfo.textContent = alerts.join(", ");
    } else {
      sensorAlertInfo.textContent = "異常なし";
    }
  }

  function updateBuildingInfo(building: BuildingState | null, coord: { x: number; y: number } | null): void {
    if (!building) {
      infoDiv.textContent = LABELS.none;
      repairBtn.style.display = recipeLabel.style.display = recipeSelect.style.display = "none";
      filterLabel.style.display = filterSelect.style.display = "none";
      sensorAlertLabel.style.display = sensorAlertInfo.style.display = "none";
      lastPopulatedType = null;
      return;
    }
    const coordText = coord ? ` (${coord.x}, ${coord.y})` : "";
    infoDiv.textContent = BUILDING_NAMES[building.type] + coordText + (building.faulted ? ` ${LABELS.faulted}` : "");
    repairBtn.style.display = building.faulted ? "block" : "none";

    if (building.type === "smelter" || building.type === "assembler") {
      recipeLabel.style.display = recipeSelect.style.display = "block";
      filterLabel.style.display = filterSelect.style.display = "none";
      sensorAlertLabel.style.display = sensorAlertInfo.style.display = "none";
      if (building.type !== lastPopulatedType) {
        populateRecipes(building.type);
        lastPopulatedType = building.type;
      }
      const desiredValue = building.recipeId ?? "";
      if (recipeSelect.value !== desiredValue) {
        recipeSelect.value = desiredValue;
      }
    } else if (building.type === "filter_splitter") {
      recipeLabel.style.display = recipeSelect.style.display = "none";
      filterLabel.style.display = filterSelect.style.display = "block";
      sensorAlertLabel.style.display = sensorAlertInfo.style.display = "none";
      if (!filterMaterialsPopulated) {
        populateFilterMaterials();
        filterMaterialsPopulated = true;
      }
      // Set current filter material value
      const currentFilter = building.filterMaterial ?? "";
      if (filterSelect.value !== currentFilter) {
        filterSelect.value = currentFilter;
      }
      lastPopulatedType = null;
    } else if (building.type === "sensor" && coord) {
      recipeLabel.style.display = recipeSelect.style.display = "none";
      filterLabel.style.display = filterSelect.style.display = "none";
      sensorAlertLabel.style.display = sensorAlertInfo.style.display = "block";
      // worldStateForRecipeCheck is not available here, need to get it from update
    } else {
      recipeLabel.style.display = recipeSelect.style.display = "none";
      filterLabel.style.display = filterSelect.style.display = "none";
      sensorAlertLabel.style.display = sensorAlertInfo.style.display = "none";
      lastPopulatedType = null;
    }
  }

  function update(world: WorldState, coord: { x: number; y: number } | null): void {
    currentCoord = coord;
    worldStateForRecipeCheck = world;
    let building: BuildingState | null = null;
    if (coord && coord.x >= 0 && coord.x < world.width && coord.y >= 0 && coord.y < world.height) {
      const tile = world.tiles[coord.y]?.[coord.x];
      if (tile?.buildingId) building = world.buildings[tile.buildingId] ?? null;
    }
    updateBuildingInfo(building, coord);
    
    // Auto-hide panel when no building is selected
    if (!building) {
      panel.style.display = "none";
    } else {
      panel.style.display = "";
    }
    
    // Update sensor alerts if sensor is selected
    if (building?.type === "sensor" && coord) {
      updateSensorAlerts(world, coord);
    }
  }

  function destroy(): void { if (panel.parentNode) panel.parentNode.removeChild(panel); }
  return { update, destroy };
}
