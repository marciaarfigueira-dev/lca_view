import { baseFarmerId, extractSeason, loadCsv, toNumber } from "./pivot-data.js";

const STORAGE_KEY = "mlSetsFarmer";
const VIEW_KEY = "mlSetsFarmerView";

const state = {
  farmer: "",
  data: [],
  clusterAverages: new Map(),
  farmerAverage: null,
  filters: {
    season: "all",
    metric: "crop_protection",
    view: "internal",
  },
};

const elements = {
  title: document.getElementById("farmer-title"),
  subtitle: document.getElementById("farmer-subtitle"),
  pill: document.getElementById("farmer-pill"),
  missing: document.getElementById("missing-panel"),
  dashboard: document.getElementById("dashboard"),
  season: document.getElementById("season-filter"),
  metric: document.getElementById("metric-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  chartTitle: document.getElementById("chart-title"),
  chartContext: document.getElementById("chart-context"),
  metricBars: document.getElementById("metric-bars"),
  narrativePanel: document.getElementById("narrative-panel"),
  narrativeContent: document.getElementById("narrative-content"),
  narrativeCount: document.getElementById("narrative-count"),
  comparisonTable: document.getElementById("comparison-table"),
  comparisonCount: document.getElementById("comparison-count"),
  comparisonTitle: document.getElementById("comparison-title"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
  download: document.getElementById("download-csv"),
};

const metricMap = {
  crop_protection: {
    label: "Crop protection (kg/ha)",
    key: "Pesticide_load_kg_ha",
    unit: "kg/ha",
  },
  yield: { label: "Yield (kg/ha)", key: "Yield_kg_ha", unit: "kg/ha" },
  n_rate: { label: "N rate (kg/ha)", key: "N_rate_kg_ha", unit: "kg/ha" },
  machinery: { label: "Machinery ratio", key: "Machinery_area_ratio", unit: "" },
  dea: { label: "DEA theta", key: "dea_theta", unit: "" },
};

init();

async function init() {
  state.farmer = getSelectedFarmer();
  state.filters.view = getSelectedView();
  if (!state.farmer) {
    showMissing();
    return;
  }
  updateHeader(state.farmer);
  const [clusterRows, deaRows] = await Promise.all([
    loadCsv("./data/clusters/dea_clusters_hcpc_full.csv"),
    loadCsv("./data/clusters/dea_results_hcpc.csv"),
  ]);
  const deaByDmu = new Map(
    deaRows
      .map((row) => {
        const key = String(row.dmu_id || "").trim();
        if (!key) return null;
        return [
          key,
          {
            theta: toNumber(row.dea_theta_hcpc),
            efficient: toBool(row.efficient_hcpc),
          },
        ];
      })
      .filter(Boolean)
  );
  const allRows = clusterRows
    .map((row) => {
      const dmuId = row.dmu_id || "";
      const season = extractSeason(row);
      const dea = deaByDmu.get(String(dmuId).trim());
      return {
        dmu_id: dmuId,
        farmer_id: baseFarmerId(dmuId) || dmuId,
        season: season ? Number(season) : season,
        mode: row.mode || "—",
        cluster: toNumber(row.cluster_hcpc_full),
        N_rate_kg_ha: toNumber(row.n_kg_ha),
        Pesticide_load_kg_ha: toNumber(row.total_crop_protection_kg_ha),
        Machinery_area_ratio: toNumber(row.mach_ratio_soil),
        Yield_kg_ha: toNumber(row.yield_kg_ha),
        pc1: toNumber(row.PC1),
        pc2: toNumber(row.PC2),
        dea_theta: dea ? dea.theta : null,
        dea_efficient: dea ? dea.efficient : null,
      };
    });
  state.clusterAverages = buildClusterAverages(allRows);
  state.data = allRows.filter((row) => row.farmer_id === state.farmer);
  if (!state.data.length) {
    showMissing(
      "No data for this farmer.",
      "We could not find any records for this selection. Choose another farmer to continue."
    );
    return;
  }
  hydrateFilters();
  attachEvents();
  render();
}

function getSelectedFarmer() {
  const params = new URLSearchParams(window.location.search);
  const param = params.get("farmer");
  if (param) return param;
  return localStorage.getItem(STORAGE_KEY) || "";
}

function getSelectedView() {
  const params = new URLSearchParams(window.location.search);
  const param = params.get("view");
  if (param === "benchmark" || param === "internal") return param;
  if (param === "bioregional") return "benchmark";
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === "benchmark") return "benchmark";
  if (saved === "bioregional") return "benchmark";
  return "internal";
}

function updateHeader(farmer) {
  elements.title.textContent = `Farmer ${farmer}`;
  elements.subtitle.textContent = `Season-by-season metrics and clustering results for ${farmer}.`;
  elements.pill.textContent = `Farmer ${farmer}`;
}

function showMissing(title, message) {
  elements.dashboard.style.display = "none";
  elements.missing.style.display = "block";
  if (title) {
    const h2 = elements.missing.querySelector("h2");
    if (h2) h2.textContent = title;
  }
  if (message) {
    const p = elements.missing.querySelector("p");
    if (p) p.textContent = message;
  }
}

function hydrateFilters() {
  fillSelect(elements.season, uniqueValues(state.data, "season").sort((a, b) => b - a), "Season");
}

function fillSelect(select, values, label) {
  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = `All ${label.toLowerCase()}s`;
  select.appendChild(optAll);
  values.forEach((val) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  });
}

function attachEvents() {
  elements.season.addEventListener("change", () => {
    state.filters.season = elements.season.value;
    render();
  });
  elements.metric.addEventListener("change", () => {
    state.filters.metric = elements.metric.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    state.filters = { season: "all", metric: "crop_protection", view: state.filters.view };
    elements.season.value = "all";
    elements.metric.value = "crop_protection";
    render();
  });
  if (elements.download) {
    elements.download.addEventListener("click", downloadCsv);
  }
}

function render() {
  const filtered = state.data.filter((row) => {
    if (state.filters.season !== "all" && `${row.season}` !== state.filters.season) return false;
    return true;
  });
  renderActive(filtered.length);
  renderStats(filtered);
  renderNarrative(filtered);
  renderComparison(filtered);
  renderChart(filtered);
  renderDetail(filtered);
}

function renderActive(count) {
  const parts = [];
  if (state.filters.season !== "all") parts.push(`Season ${state.filters.season}`);
  parts.push(metricMap[state.filters.metric]?.label || "Metric");
  parts.push(state.filters.view === "benchmark" ? "Best-cluster view" : "Internal view");
  if (state.filters.season !== "all") {
    const selected = state.data.find((row) => `${row.season}` === state.filters.season);
    if (selected?.cluster != null) parts.push(`Cluster ${selected.cluster}`);
  }
  elements.active.textContent = `${parts.join(" • ")} — ${count} records`;
}

function renderStats(rows) {
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No data for this selection.</p>`;
    return;
  }
  const avg = (key) => {
    const vals = rows.map((r) => r[key]).filter(Number.isFinite);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  const stats = [
    { label: "Seasons", value: formatNumber(rows.length, 0) },
    { label: "Yield (kg/ha)", value: formatNumber(avg("Yield_kg_ha"), 0) },
    { label: "N rate (kg/ha)", value: formatNumber(avg("N_rate_kg_ha"), 1) },
    { label: "Pest load (kg/ha)", value: formatNumber(avg("Pesticide_load_kg_ha"), 2) },
    { label: "Machinery ratio", value: formatNumber(avg("Machinery_area_ratio"), 2) },
    { label: "DEA theta", value: formatNumber(avg("dea_theta"), 2) },
  ];
  elements.statGrid.innerHTML = stats
    .map(
      (stat) => `
        <div class="stat">
          <small>${stat.label}</small>
          <strong>${stat.value}</strong>
        </div>
      `
    )
    .join("");
}

function renderChart(rows) {
  const metric = metricMap[state.filters.metric] || metricMap.yield;
  elements.chartTitle.textContent = `${metric.label} by season`;
  if (!rows.length) {
    elements.metricBars.innerHTML = `<p class="empty">No data for chart.</p>`;
    elements.chartContext.textContent = "";
    return;
  }
  const grouped = new Map();
  rows.forEach((row) => {
    const season = row.season;
    const value = row[metric.key];
    if (!Number.isFinite(value)) return;
    if (!grouped.has(season)) grouped.set(season, []);
    grouped.get(season).push(value);
  });
  const entries = Array.from(grouped.entries())
    .map(([season, values]) => ({
      season,
      value: values.reduce((s, v) => s + v, 0) / values.length,
    }))
    .sort((a, b) => b.season - a.season);
  const maxVal = Math.max(...entries.map((e) => e.value), 1);
  elements.chartContext.textContent = metric.unit ? `Unit: ${metric.unit}` : "Unitless metric";
  elements.metricBars.innerHTML = entries
    .map((entry) => {
      const width = (entry.value / maxVal) * 100;
      return `
        <div class="bar-row">
          <div class="bar-label">
            <div>${entry.season}</div>
            <small>${formatNumber(entry.value, 2)} ${metric.unit || ""}</small>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%"></div>
            <span class="bar-value">${formatNumber(entry.value, 2)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderComparison(rows) {
  if (!elements.comparisonTable || !elements.comparisonCount) return;
  const view = state.filters.view;
  elements.comparisonTitle.textContent =
    view === "benchmark" ? "Inputs vs best cluster" : "Inputs vs your own baseline";
  elements.comparisonCount.textContent =
    view === "benchmark" ? `${rows.length} seasons • diff vs best cluster` : `${rows.length} seasons • diff vs farmer average`;
  if (!rows.length) {
    elements.comparisonTable.innerHTML = `<p class="empty">No comparison data for this selection.</p>`;
    return;
  }
  if (!state.farmerAverage) {
    state.farmerAverage = computeOverallAverage(state.data);
  }
  const rowsHtml = rows
    .slice()
    .sort((a, b) => b.season - a.season)
    .map((row) => {
      return `
        <tr>
          <td>${row.season}</td>
          <td>${row.cluster ?? "—"}</td>
          <td>
            ${view === "benchmark"
              ? formatCompareBest(row.season, row.Yield_kg_ha, "Yield_kg_ha", 0)
              : formatCompare(row.Yield_kg_ha, state.farmerAverage?.Yield_kg_ha, 0)}
          </td>
          <td>
            ${view === "benchmark"
              ? formatCompareBest(row.season, row.N_rate_kg_ha, "N_rate_kg_ha", 1)
              : formatCompare(row.N_rate_kg_ha, state.farmerAverage?.N_rate_kg_ha, 1)}
          </td>
          <td>
            ${view === "benchmark"
              ? formatCompareBest(row.season, row.Pesticide_load_kg_ha, "Pesticide_load_kg_ha", 2)
              : formatCompare(row.Pesticide_load_kg_ha, state.farmerAverage?.Pesticide_load_kg_ha, 2)}
          </td>
          <td>
            ${view === "benchmark"
              ? formatCompareBest(row.season, row.Machinery_area_ratio, "Machinery_area_ratio", 2)
              : formatCompare(row.Machinery_area_ratio, state.farmerAverage?.Machinery_area_ratio, 2)}
          </td>
        </tr>
      `;
    })
    .join("");
  elements.comparisonTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Season</th>
          <th>Cluster</th>
          <th>Yield (kg/ha)</th>
          <th>N rate (kg/ha)</th>
          <th>Crop protection (kg/ha)</th>
          <th>Mach ratio</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function renderNarrative(rows) {
  if (!elements.narrativePanel || !elements.narrativeContent || !elements.narrativeCount) return;
  if (state.filters.view !== "benchmark") {
    elements.narrativePanel.style.display = "none";
    return;
  }
  elements.narrativePanel.style.display = "block";
  if (!rows.length) {
    elements.narrativeContent.innerHTML = `<p class="empty">No narrative available for this selection.</p>`;
    elements.narrativeCount.textContent = "";
    return;
  }
  const summaries = buildSeasonSummaries(rows);
  elements.narrativeCount.textContent = `${summaries.length} seasons`;
  elements.narrativeContent.innerHTML = summaries
    .map((summary) => renderNarrativeCard(summary))
    .join("");
}

function renderDetail(rows) {
  elements.detailCount.textContent = `${rows.length} records`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No records for this selection.</p>`;
    return;
  }
  const rowsHtml = rows
    .slice()
    .sort((a, b) => b.season - a.season)
    .map((row) => {
      return `
        <tr>
          <td>${row.season}</td>
          <td>${row.cluster ?? "—"}</td>
          <td>${row.mode || "—"}</td>
          <td>${formatNumber(row.Yield_kg_ha, 0)}</td>
          <td>${formatNumber(row.N_rate_kg_ha, 1)}</td>
          <td>${formatNumber(row.Pesticide_load_kg_ha, 2)}</td>
          <td>${formatNumber(row.Machinery_area_ratio, 2)}</td>
          <td>${formatNumber(row.dea_theta, 2)}</td>
          <td>${row.dea_efficient == null ? "—" : row.dea_efficient ? "Yes" : "No"}</td>
        </tr>
      `;
    })
    .join("");
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Season</th>
          <th>Cluster</th>
          <th>Mode</th>
          <th>Yield (kg/ha)</th>
          <th>N (kg/ha)</th>
          <th>Pest (kg/ha)</th>
          <th>Mach ratio</th>
          <th>DEA theta</th>
          <th>Efficient</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function downloadCsv() {
  const rows = state.data.filter((row) => {
    if (state.filters.season !== "all" && `${row.season}` !== state.filters.season) return false;
    return true;
  });
  if (!rows.length) return;
  const header = [
    "season",
    "cluster",
    "mode",
    "yield_kg_ha",
    "n_kg_ha",
    "pest_kg_ha",
    "machinery_ratio",
    "dea_theta",
    "efficient",
  ];
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.season,
        row.cluster,
        row.mode,
        row.Yield_kg_ha,
        row.N_rate_kg_ha,
        row.Pesticide_load_kg_ha,
        row.Machinery_area_ratio,
        row.dea_theta,
        row.dea_efficient,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `farmer_${state.farmer || "selection"}_metrics.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function uniqueValues(rows, key) {
  return Array.from(
    rows.reduce((set, row) => {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") set.add(row[key]);
      return set;
    }, new Set())
  );
}

function buildClusterAverages(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!Number.isFinite(row.season) || !Number.isFinite(row.cluster)) return;
    const key = `${row.season}|${row.cluster}`;
    if (!map.has(key)) {
      map.set(key, {
        season: row.season,
        cluster: row.cluster,
        sums: {
          Yield_kg_ha: 0,
          N_rate_kg_ha: 0,
          Pesticide_load_kg_ha: 0,
          Machinery_area_ratio: 0,
        },
        counts: {
          Yield_kg_ha: 0,
          N_rate_kg_ha: 0,
          Pesticide_load_kg_ha: 0,
          Machinery_area_ratio: 0,
        },
      });
    }
    const rec = map.get(key);
    addMetric(rec, "Yield_kg_ha", row.Yield_kg_ha);
    addMetric(rec, "N_rate_kg_ha", row.N_rate_kg_ha);
    addMetric(rec, "Pesticide_load_kg_ha", row.Pesticide_load_kg_ha);
    addMetric(rec, "Machinery_area_ratio", row.Machinery_area_ratio);
  });
  const avgMap = new Map();
  map.forEach((rec, key) => {
    avgMap.set(key, {
      season: rec.season,
      cluster: rec.cluster,
      Yield_kg_ha: average(rec, "Yield_kg_ha"),
      N_rate_kg_ha: average(rec, "N_rate_kg_ha"),
      Pesticide_load_kg_ha: average(rec, "Pesticide_load_kg_ha"),
      Machinery_area_ratio: average(rec, "Machinery_area_ratio"),
    });
  });
  return avgMap;
}

function buildSeasonSummaries(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!Number.isFinite(row.season)) return;
    const key = row.season;
    if (!map.has(key)) {
      map.set(key, {
        season: row.season,
        cluster: row.cluster,
        values: {
          Yield_kg_ha: [],
          N_rate_kg_ha: [],
          Pesticide_load_kg_ha: [],
          Machinery_area_ratio: [],
        },
      });
    }
    const rec = map.get(key);
    if (rec.cluster == null && row.cluster != null) rec.cluster = row.cluster;
    pushValue(rec, "Yield_kg_ha", row.Yield_kg_ha);
    pushValue(rec, "N_rate_kg_ha", row.N_rate_kg_ha);
    pushValue(rec, "Pesticide_load_kg_ha", row.Pesticide_load_kg_ha);
    pushValue(rec, "Machinery_area_ratio", row.Machinery_area_ratio);
  });
  return Array.from(map.values())
    .map((rec) => ({
      season: rec.season,
      cluster: rec.cluster,
      metrics: {
        Yield_kg_ha: averageList(rec.values.Yield_kg_ha),
        N_rate_kg_ha: averageList(rec.values.N_rate_kg_ha),
        Pesticide_load_kg_ha: averageList(rec.values.Pesticide_load_kg_ha),
        Machinery_area_ratio: averageList(rec.values.Machinery_area_ratio),
      },
    }))
    .sort((a, b) => b.season - a.season);
}

function renderNarrativeCard(summary) {
  const season = summary.season;
  const cluster = summary.cluster;
  const metrics = [
    {
      key: "Pesticide_load_kg_ha",
      label: "Crop protection",
      unit: "kg/ha",
      digits: 2,
      direction: "lower",
    },
    { key: "N_rate_kg_ha", label: "N rate", unit: "kg/ha", digits: 1, direction: "lower" },
    { key: "Yield_kg_ha", label: "Yield", unit: "kg/ha", digits: 0, direction: "higher" },
    { key: "Machinery_area_ratio", label: "Machinery ratio", unit: "", digits: 2, direction: "lower" },
  ];
  const lines = metrics
    .map((metric) => {
      const value = summary.metrics[metric.key];
      if (value == null || !Number.isFinite(value)) return null;
      const clusterAvg = cluster != null ? state.clusterAverages.get(`${season}|${cluster}`) : null;
      const best = bestClusterForSeason(season, metric.key, metric.direction);
      const valText = formatMetric(value, metric.unit, metric.digits);
      const clusterText = clusterAvg?.[metric.key];
      const bestText = best?.value;
      const clusterLine =
        clusterAvg && Number.isFinite(clusterText)
          ? `Cluster ${cluster} avg ${formatMetric(clusterText, metric.unit, metric.digits)} (${diffText(
              value,
              clusterText,
              metric.unit,
              metric.digits
            )}).`
          : "Cluster average unavailable.";
      const bestLine =
        best && Number.isFinite(bestText)
          ? `Best cluster is ${best.cluster} at ${formatMetric(bestText, metric.unit, metric.digits)} (${diffText(
              value,
              bestText,
              metric.unit,
              metric.digits
            )}).`
          : "Best cluster unavailable.";
      return `<p><strong>${metric.label}:</strong> You are at ${valText}. ${clusterLine} ${bestLine}</p>`;
    })
    .filter(Boolean)
    .join("");
  return `
    <div class="narrative-card">
      <h3>Season ${season} · Cluster ${cluster ?? "—"}</h3>
      ${lines || "<p>No inputs available for this season.</p>"}
    </div>
  `;
}

function bestClusterForSeason(season, key, direction) {
  const entries = Array.from(state.clusterAverages.values()).filter(
    (rec) => rec.season === season && Number.isFinite(rec[key])
  );
  if (!entries.length) return null;
  const sorted = entries.slice().sort((a, b) => {
    return direction === "lower" ? a[key] - b[key] : b[key] - a[key];
  });
  const best = sorted[0];
  return { cluster: best.cluster, value: best[key] };
}

function pushValue(rec, key, value) {
  if (!Number.isFinite(value)) return;
  rec.values[key].push(value);
}

function averageList(list) {
  if (!list.length) return null;
  return list.reduce((sum, val) => sum + val, 0) / list.length;
}

function computeOverallAverage(rows) {
  const rec = {
    sums: {
      Yield_kg_ha: 0,
      N_rate_kg_ha: 0,
      Pesticide_load_kg_ha: 0,
      Machinery_area_ratio: 0,
    },
    counts: {
      Yield_kg_ha: 0,
      N_rate_kg_ha: 0,
      Pesticide_load_kg_ha: 0,
      Machinery_area_ratio: 0,
    },
  };
  rows.forEach((row) => {
    addMetric(rec, "Yield_kg_ha", row.Yield_kg_ha);
    addMetric(rec, "N_rate_kg_ha", row.N_rate_kg_ha);
    addMetric(rec, "Pesticide_load_kg_ha", row.Pesticide_load_kg_ha);
    addMetric(rec, "Machinery_area_ratio", row.Machinery_area_ratio);
  });
  return {
    Yield_kg_ha: average(rec, "Yield_kg_ha"),
    N_rate_kg_ha: average(rec, "N_rate_kg_ha"),
    Pesticide_load_kg_ha: average(rec, "Pesticide_load_kg_ha"),
    Machinery_area_ratio: average(rec, "Machinery_area_ratio"),
  };
}

function addMetric(rec, key, value) {
  if (!Number.isFinite(value)) return;
  rec.sums[key] += value;
  rec.counts[key] += 1;
}

function average(rec, key) {
  const denom = rec.counts[key];
  return denom ? rec.sums[key] / denom : null;
}

function formatNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCompare(value, avg, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  const valueText = formatNumber(value, digits);
  if (avg == null || !Number.isFinite(avg)) return `${valueText} (diff —)`;
  const diff = value - avg;
  const sign = diff > 0 ? "+" : "";
  return `${valueText} (diff ${sign}${formatNumber(diff, digits)})`;
}

function formatCompareBest(season, value, key, digits) {
  if (value == null || !Number.isFinite(value)) return "—";
  const best = bestClusterForSeason(season, key, key === "Yield_kg_ha" ? "higher" : "lower");
  if (!best || !Number.isFinite(best.value)) return formatNumber(value, digits);
  const diff = value - best.value;
  const sign = diff > 0 ? "+" : "";
  return `${formatNumber(value, digits)} (best C${best.cluster} ${sign}${formatNumber(diff, digits)})`;
}
function formatMetric(value, unit, digits) {
  const number = formatNumber(value, digits);
  return unit ? `${number} ${unit}` : number;
}

function diffText(value, compare, unit, digits) {
  if (compare == null || !Number.isFinite(compare)) return "diff —";
  const diff = value - compare;
  const sign = diff > 0 ? "+" : "";
  const amount = formatNumber(Math.abs(diff), digits);
  return `diff ${sign}${amount}${unit ? ` ${unit}` : ""}`;
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toBool(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}
