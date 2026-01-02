import { baseFarmerId, loadCsv } from "./pivot-data.js";

const elements = {
  select: document.getElementById("farmer-select"),
  save: document.getElementById("save-farmer"),
  enterView: document.getElementById("enter-view"),
  status: document.getElementById("save-status"),
  summary: document.getElementById("selection-summary"),
};

const STORAGE_KEY = "mlSetsFarmer";

init();

async function init() {
  const farmers = await loadFarmers();
  hydrateSelect(farmers);
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && farmers.includes(saved)) {
    elements.select.value = saved;
    updateSummary(saved);
    updateEnterLink(saved);
  } else if (farmers.length) {
    elements.select.value = farmers[0];
    updateSummary(farmers[0]);
    updateEnterLink(farmers[0]);
  }
  elements.select.addEventListener("change", () => {
    const value = elements.select.value;
    updateSummary(value);
    updateEnterLink(value);
    elements.status.textContent = "";
  });
  elements.save.addEventListener("click", () => {
    const value = elements.select.value;
    if (!value) return;
    localStorage.setItem(STORAGE_KEY, value);
    elements.status.textContent = `Saved ${value}.`;
  });
  if (elements.enterView) {
    elements.enterView.addEventListener("click", () => {
      const value = elements.select.value;
      if (value) localStorage.setItem(STORAGE_KEY, value);
    });
  }
}

async function loadFarmers() {
  try {
    const rows = await loadCsv("./data/clusters/dea_clusters_hcpc_full.csv");
    const farmers = rows
      .map((row) => baseFarmerId(row.dmu_id || row.DMU_ID || row.farmer_id || ""))
      .filter(Boolean);
    return Array.from(new Set(farmers)).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error("Unable to load farmer list", err);
    return [];
  }
}

function hydrateSelect(list) {
  elements.select.innerHTML = "";
  if (!list.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No farmers found";
    elements.select.appendChild(opt);
    return;
  }
  list.forEach((farmer) => {
    const opt = document.createElement("option");
    opt.value = farmer;
    opt.textContent = farmer;
    elements.select.appendChild(opt);
  });
}

function updateSummary(value) {
  if (!value) {
    elements.summary.textContent = "No farmer selected yet.";
    return;
  }
  elements.summary.textContent = `You are viewing farmer data for ${value}.`;
}

function updateEnterLink(value) {
  if (!elements.enterView) return;
  const base = "./farmer-view.html";
  elements.enterView.href = value ? `${base}?farmer=${encodeURIComponent(value)}` : base;
}
