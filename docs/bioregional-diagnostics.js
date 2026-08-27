import { loadCsv, toNumber } from "./pivot-data.js";

const DEA_MODELS = {
  dea_theta_vrs: {
    label: "Technical VRS",
    efficientKey: "efficient_vrs",
    note: "Input-oriented technical-efficiency prototype using N input, crop-protection intensity and soil-operation intensity against yield.",
  },
  dea_theta_crs: {
    label: "Technical CRS",
    efficientKey: "efficient_crs",
    note: "Constant-returns-to-scale sensitivity for the same technical input-output model.",
  },
  dea_theta_non_ch4_climate_adjusted_vrs: {
    label: "Non-CH4 climate-adjusted VRS",
    efficientKey: "efficient_non_ch4_climate_adjusted_vrs",
    note: "Environmental sensitivity excluding CH4 because methane is common per hectare in the central LCA model.",
  },
  dea_theta_environmental_selected_undesirable_vrs: {
    label: "Selected-undesirable environmental VRS",
    efficientKey: "efficient_environmental_selected_undesirable_vrs",
    note: "Prototype environmental DEA using selected undesirable outputs; not a definitive environmental-efficiency ranking.",
  },
};

const COLORS = ["#0f766e", "#c2410c", "#7c3aed", "#2563eb", "#b45309"];

const state = {
  deaSummary: [],
  deaDetail: [],
  pcaSensitivity: [],
  pcaLoo: [],
  pcaLoadings: [],
  pcaLabels: [],
  filters: {
    variant: "winsor_p95",
    year: "all",
    deaModel: "dea_theta_vrs",
  },
};

const elements = {
  variant: document.getElementById("variant-filter"),
  year: document.getElementById("year-filter"),
  deaModel: document.getElementById("dea-model-filter"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  scatterCount: document.getElementById("scatter-count"),
  scatter: document.getElementById("pca-scatter"),
  deaCount: document.getElementById("dea-count"),
  deaSummaryTable: document.getElementById("dea-summary-table"),
  pcaCount: document.getElementById("pca-count"),
  pcaSummaryTable: document.getElementById("pca-summary-table"),
  loadingCount: document.getElementById("loading-count"),
  loadingTable: document.getElementById("loading-table"),
  detailCount: document.getElementById("detail-count"),
  detailTable: document.getElementById("detail-table"),
};

init();

async function init() {
  const [
    deaSummary,
    deaDetail,
    technicalLoo,
    pcaSensitivity,
    pcaLoo,
    pcaLoadings,
    pcaLabels,
  ] = await Promise.all([
    loadCsv("./data/diagnostics/dea/dea_exploratory_diagnostics_summary_rounded.csv"),
    loadCsv("./data/diagnostics/dea/dea_model_comparison_scores.csv"),
    loadCsv("./data/diagnostics/dea/technical_dea_leave_one_out_summary.csv"),
    loadCsv("./data/diagnostics/pca_hcpc/pca_hcpc_sensitivity_summary.csv"),
    loadCsv("./data/diagnostics/pca_hcpc/pca_hcpc_leave_one_out_summary.csv"),
    loadCsv("./data/diagnostics/pca_hcpc/pca_hcpc_loadings.csv"),
    loadCsv("./data/diagnostics/pca_hcpc/pca_hcpc_sensitivity_labels.csv"),
  ]);

  state.deaSummary = deaSummary;
  state.deaDetail = deaDetail;
  state.technicalLoo = technicalLoo;
  state.pcaSensitivity = pcaSensitivity;
  state.pcaLoo = pcaLoo;
  state.pcaLoadings = pcaLoadings;
  state.pcaLabels = pcaLabels;

  hydrateFilters();
  attachEvents();
  render();
}

function hydrateFilters() {
  fillSelect(elements.variant, unique(state.pcaLabels.map((row) => row.variant)).sort(), null);
  if (!unique(state.pcaLabels.map((row) => row.variant)).includes(state.filters.variant)) {
    state.filters.variant = elements.variant.options[0]?.value || "uncapped";
  }
  elements.variant.value = state.filters.variant;

  fillSelect(elements.year, unique(state.pcaLabels.map((row) => row.year)).sort(), "All years");
  elements.year.value = state.filters.year;
  elements.deaModel.value = state.filters.deaModel;
}

function attachEvents() {
  elements.variant.addEventListener("change", () => {
    state.filters.variant = elements.variant.value;
    render();
  });
  elements.year.addEventListener("change", () => {
    state.filters.year = elements.year.value;
    render();
  });
  elements.deaModel.addEventListener("change", () => {
    state.filters.deaModel = elements.deaModel.value;
    render();
  });
}

function render() {
  const scatterRows = filteredPcaRows();
  renderActive(scatterRows);
  renderStats(scatterRows);
  renderScatter(scatterRows);
  renderDeaSummary();
  renderPcaSummary();
  renderLoadings();
  renderDetail(scatterRows);
}

function filteredPcaRows() {
  return state.pcaLabels.filter((row) => {
    if (row.variant !== state.filters.variant) return false;
    if (state.filters.year !== "all" && `${row.year}` !== state.filters.year) return false;
    return Number.isFinite(toNumber(row.PC1)) && Number.isFinite(toNumber(row.PC2));
  });
}

function renderActive(rows) {
  const model = DEA_MODELS[state.filters.deaModel];
  const parts = [
    `PCA ${variantLabel(state.filters.variant)}`,
    state.filters.year === "all" ? "All years" : `Year ${state.filters.year}`,
    model.label,
  ];
  elements.active.textContent = `${parts.join(" | ")} | ${rows.length} farmer-years shown`;
}

function renderStats(rows) {
  const pca = state.pcaSensitivity.find((row) => row.variant === state.filters.variant);
  const pcaLoo = state.pcaLoo[0] || {};
  const deaTechnical = state.deaSummary.find((row) => row.analysis === "Technical DEA" && row.model === "VRS input-oriented");
  const selectedModel = DEA_MODELS[state.filters.deaModel];
  const detailValues = mergedDetail(rows)
    .map((row) => toNumber(row.deaScore))
    .filter(Number.isFinite);
  const efficientCount = mergedDetail(rows).filter((row) => row.efficient).length;
  const stats = [
    {
      label: "Displayed sample",
      value: `${rows.length} farmer-years`,
      sub: "Availability sample; exploratory only",
    },
    {
      label: "PCA PC1 + PC2",
      value: `${formatNumber(toNumber(pca?.pc1_pc2_cumulative) * 100, 1)}%`,
      sub: `Silhouette ${formatNumber(toNumber(pca?.silhouette_pc1_pc2), 2)}`,
    },
    {
      label: "PCA leave-one-out",
      value: `ARI ${formatNumber(toNumber(pcaLoo.mean_ari_among_remaining_dmus), 2)}`,
      sub: `Max changed ${formatNumber(toNumber(pcaLoo.max_remaining_dmus_changed_cluster_n), 0)} DMUs`,
    },
    {
      label: "Technical DEA VRS",
      value: `Mean ${formatNumber(toNumber(deaTechnical?.mean_score), 2)}`,
      sub: `${formatNumber(toNumber(deaTechnical?.frontier_or_efficient_dmus), 0)} efficient DMUs`,
    },
    {
      label: selectedModel.label,
      value: `Median ${formatNumber(median(detailValues), 2)}`,
      sub: `${efficientCount} efficient in displayed selection`,
    },
  ];
  elements.statGrid.innerHTML = stats.map(statCard).join("");
}

function renderScatter(rows) {
  elements.scatterCount.textContent = `${rows.length} points`;
  if (!rows.length) {
    elements.scatter.innerHTML = `<p class="empty">No PCA rows match this filter.</p>`;
    return;
  }
  const width = 860;
  const height = 460;
  const margin = { top: 28, right: 34, bottom: 58, left: 64 };
  const xs = rows.map((row) => toNumber(row.PC1)).filter(Number.isFinite);
  const ys = rows.map((row) => toNumber(row.PC2)).filter(Number.isFinite);
  const xDomain = paddedDomain(xs);
  const yDomain = paddedDomain(ys);
  const xScale = (value) => margin.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * (width - margin.left - margin.right);
  const yScale = (value) => height - margin.bottom - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * (height - margin.top - margin.bottom);
  const clusters = unique(rows.map((row) => row.cluster)).sort((a, b) => Number(a) - Number(b));
  const clusterColor = (cluster) => COLORS[Math.max(0, clusters.indexOf(cluster)) % COLORS.length];
  const yearOpacity = (row) => state.filters.year === "all" ? 0.84 : 0.94;
  const points = rows.map((row) => {
    const x = xScale(toNumber(row.PC1));
    const y = yScale(toNumber(row.PC2));
    const label = `${row.dmu_id} | cluster ${row.cluster} | N ${formatNumber(toNumber(row.n_kg_ha), 1)} kg/ha | AI ${formatNumber(toNumber(row.crop_protection_kg_ai_ha), 2)} kg/ha | yield ${formatNumber(toNumber(row.yield_kg_ha), 0)} kg/ha`;
    return `
      <g class="exploratory-point">
        <circle cx="${x}" cy="${y}" r="6.2" fill="${clusterColor(row.cluster)}" opacity="${yearOpacity(row)}"></circle>
        <title>${escapeHtml(label)}</title>
      </g>
    `;
  }).join("");
  const xTicks = ticks(xDomain, 5);
  const yTicks = ticks(yDomain, 5);
  const legend = clusters.map((cluster) => `
    <span class="legend-item"><span class="legend-swatch" style="background:${clusterColor(cluster)}"></span>Cluster ${cluster}</span>
  `).join("");
  elements.scatter.innerHTML = `
    <div class="exploratory-legend">${legend}</div>
    <svg class="exploratory-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="PCA scatter plot">
      <rect x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}" class="plot-bg"></rect>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${yScale(0)}" y2="${yScale(0)}" class="axis-zero"></line>
      <line x1="${xScale(0)}" x2="${xScale(0)}" y1="${margin.top}" y2="${height - margin.bottom}" class="axis-zero"></line>
      ${xTicks.map((tick) => `
        <line x1="${xScale(tick)}" x2="${xScale(tick)}" y1="${margin.top}" y2="${height - margin.bottom}" class="grid-line"></line>
        <text x="${xScale(tick)}" y="${height - 26}" class="axis-label" text-anchor="middle">${formatNumber(tick, 1)}</text>
      `).join("")}
      ${yTicks.map((tick) => `
        <line x1="${margin.left}" x2="${width - margin.right}" y1="${yScale(tick)}" y2="${yScale(tick)}" class="grid-line"></line>
        <text x="${margin.left - 12}" y="${yScale(tick) + 4}" class="axis-label" text-anchor="end">${formatNumber(tick, 1)}</text>
      `).join("")}
      ${points}
      <text x="${width / 2}" y="${height - 8}" class="axis-title" text-anchor="middle">PC1</text>
      <text x="18" y="${height / 2}" class="axis-title vertical" text-anchor="middle">PC2</text>
    </svg>
  `;
}

function renderDeaSummary() {
  const rows = state.deaSummary.map((row) => ({
    analysis: row.analysis,
    model: row.model,
    inputs: row.inputs_or_undesirables,
    output: row.desirable_output,
    n: row.n_dmus,
    mean: row.mean_score,
    median: row.median_score,
    min: row.min_score,
    max: row.max_score,
    frontier: row.frontier_or_efficient_dmus,
    note: row.interpretation,
  }));
  elements.deaCount.textContent = `${rows.length} checks`;
  elements.deaSummaryTable.innerHTML = renderTable(rows, [
    ["analysis", "Analysis"],
    ["model", "Model"],
    ["inputs", "Inputs or undesirable outputs"],
    ["output", "Desirable output"],
    ["n", "n"],
    ["mean", "Mean"],
    ["median", "Median"],
    ["min", "Min"],
    ["max", "Max"],
    ["frontier", "Frontier / efficient"],
    ["note", "Interpretation"],
  ]);
}

function renderPcaSummary() {
  const rows = state.pcaSensitivity.map((row) => ({
    variant: variantLabel(row.variant),
    cap: row.cap_quantile,
    pc1: `${formatNumber(toNumber(row.pc1_explained_variance) * 100, 1)}%`,
    pc2: `${formatNumber(toNumber(row.pc2_explained_variance) * 100, 1)}%`,
    pc12: `${formatNumber(toNumber(row.pc1_pc2_cumulative) * 100, 1)}%`,
    silhouette: row.silhouette_pc1_pc2,
    ari: row.ari_vs_winsor_p95,
    sizes: row.cluster_sizes,
  }));
  const loo = state.pcaLoo[0] || {};
  rows.push({
    variant: "Leave-one-out",
    cap: "Recomputed after excluding each farmer-year",
    pc1: "",
    pc2: "",
    pc12: "",
    silhouette: "",
    ari: `mean ${formatNumber(toNumber(loo.mean_ari_among_remaining_dmus), 2)}; min ${formatNumber(toNumber(loo.min_ari_among_remaining_dmus), 2)}`,
    sizes: `mean changed ${formatNumber(toNumber(loo.mean_remaining_dmus_changed_cluster_n), 1)}; max changed ${formatNumber(toNumber(loo.max_remaining_dmus_changed_cluster_n), 0)}`,
  });
  elements.pcaCount.textContent = `${rows.length} rows`;
  elements.pcaSummaryTable.innerHTML = renderTable(rows, [
    ["variant", "Variant"],
    ["cap", "Preprocessing / check"],
    ["pc1", "PC1"],
    ["pc2", "PC2"],
    ["pc12", "PC1 + PC2"],
    ["silhouette", "Silhouette"],
    ["ari", "ARI"],
    ["sizes", "Cluster sizes / stability"],
  ]);
}

function renderLoadings() {
  const rows = state.pcaLoadings
    .filter((row) => row.variant === state.filters.variant && ["1", "2"].includes(String(row.pc)))
    .map((row) => ({
      feature: readableFeature(row.feature),
      pc: `PC${row.pc}`,
      loading: row.loading,
      direction: toNumber(row.loading) >= 0 ? "positive" : "negative",
    }))
    .sort((a, b) => a.pc.localeCompare(b.pc) || Math.abs(toNumber(b.loading)) - Math.abs(toNumber(a.loading)));
  elements.loadingCount.textContent = `${rows.length} loadings`;
  elements.loadingTable.innerHTML = renderTable(rows, [
    ["feature", "Variable"],
    ["pc", "Component"],
    ["loading", "Loading"],
    ["direction", "Direction"],
  ]);
}

function renderDetail(rows) {
  const merged = mergedDetail(rows)
    .sort((a, b) => a.year.localeCompare(b.year) || a.dmu_id.localeCompare(b.dmu_id));
  const model = DEA_MODELS[state.filters.deaModel];
  elements.detailCount.textContent = `${merged.length} farmer-years`;
  elements.detailTable.innerHTML = renderTable(merged, [
    ["dmu_id", "Farmer-year"],
    ["year", "Year"],
    ["cluster", "PCA cluster"],
    ["pc1", "PC1"],
    ["pc2", "PC2"],
    ["n", "N kg/ha"],
    ["ai", "kg a.i./ha"],
    ["machinery", "ha worked/ha"],
    ["yield", "Yield kg/ha"],
    ["deaScore", model.label],
    ["efficientLabel", "Efficient"],
  ]);
}

function mergedDetail(rows) {
  const deaByDmu = new Map(state.deaDetail.map((row) => [row.dmu_id, row]));
  const model = DEA_MODELS[state.filters.deaModel];
  return rows.map((row) => {
    const dea = deaByDmu.get(row.dmu_id) || {};
    const efficient = parseBool(dea[model.efficientKey]);
    return {
      dmu_id: row.dmu_id,
      year: String(row.year),
      cluster: row.cluster,
      pc1: toNumber(row.PC1),
      pc2: toNumber(row.PC2),
      n: toNumber(row.n_kg_ha),
      ai: toNumber(row.crop_protection_kg_ai_ha),
      machinery: toNumber(row.soil_operation_intensity_ha_ha),
      yield: toNumber(row.yield_kg_ha),
      deaScore: toNumber(dea[state.filters.deaModel]),
      efficient,
      efficientLabel: efficient == null ? "" : efficient ? "Yes" : "No",
    };
  });
}

function renderTable(rows, columns) {
  if (!rows.length) return `<p class="empty">No diagnostic values found.</p>`;
  return `
    <table>
      <thead>
        <tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${columns.map(([key]) => `<td>${formatCell(row[key])}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function statCard(stat) {
  return `
    <div class="stat">
      <small>${escapeHtml(stat.label)}</small>
      <strong>${escapeHtml(stat.value)}</strong>
      <small>${escapeHtml(stat.sub)}</small>
    </div>
  `;
}

function fillSelect(select, values, allLabel = "All") {
  select.innerHTML = "";
  if (allLabel) {
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = allLabel;
    select.appendChild(all);
  }
  values.filter(Boolean).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "all" ? "All" : variantLabel(value);
    select.appendChild(option);
  });
}

function paddedDomain(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

function ticks(domain, count) {
  const [min, max] = domain;
  const step = (max - min) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value != null && value !== "")));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseBool(value) {
  if (value === true || value === "True" || value === "true") return true;
  if (value === false || value === "False" || value === "false") return false;
  return null;
}

function readableFeature(feature) {
  const names = {
    n_kg_ha: "Nitrogen input",
    crop_protection_kg_ai_ha: "Crop-protection intensity",
    soil_operation_intensity_ha_ha: "Soil-operation intensity",
    yield_kg_ha: "Yield",
  };
  return names[feature] || feature;
}

function variantLabel(value) {
  const labels = {
    uncapped: "Uncapped",
    winsor_p90: "Winsor p90",
    winsor_p95: "Winsor p95",
    winsor_p99: "Winsor p99",
  };
  return labels[value] || value;
}

function formatCell(value) {
  const numeric = typeof value === "number" ? value : toNumber(value);
  if (Number.isFinite(numeric) && String(value).trim?.() !== "") return formatNumber(numeric, 3);
  return escapeHtml(value ?? "");
}

function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if ((abs >= 1e6 || (abs > 0 && abs < 0.001)) && digits >= 2) return value.toExponential(2);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
