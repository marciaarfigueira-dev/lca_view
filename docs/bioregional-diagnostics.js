import { loadCsv, toNumber } from "./pivot-data.js";

const elements = {
  statGrid: document.getElementById("stat-grid"),
  deaCount: document.getElementById("dea-count"),
  deaSummaryTable: document.getElementById("dea-summary-table"),
  pcaCount: document.getElementById("pca-count"),
  pcaSummaryTable: document.getElementById("pca-summary-table"),
  loadingTable: document.getElementById("loading-table"),
};

init();

async function init() {
  const [
    technicalSummary,
    looSummary,
    nonCh4Summary,
    climateSummary,
    pcaSensitivity,
    pcaLoo,
    loadings,
  ] = await Promise.all([
    loadCsv("./data/diagnostics/dea/technical_dea_vrs_crs_summary.csv"),
    loadCsv("./data/diagnostics/dea/technical_dea_leave_one_out_summary.csv"),
    loadCsv("./data/diagnostics/dea/non_ch4_climate_adjusted_dea_summary.csv"),
    loadCsv("./data/diagnostics/dea/climate_adjusted_dea_summary.csv"),
    loadCsv("./data/diagnostics/pca_hcpc/pca_hcpc_sensitivity_summary.csv"),
    loadCsv("./data/diagnostics/pca_hcpc/pca_hcpc_leave_one_out_summary.csv"),
    loadCsv("./data/diagnostics/pca_hcpc/pca_hcpc_loadings.csv"),
  ]);

  renderStats({ technicalSummary, looSummary, nonCh4Summary, climateSummary, pcaSensitivity, pcaLoo });
  renderDea({ technicalSummary, looSummary, nonCh4Summary, climateSummary });
  renderPca({ pcaSensitivity, pcaLoo });
  renderLoadings(loadings);
}

function renderStats(data) {
  const vrs = data.technicalSummary.find((row) => row.model === "VRS");
  const crs = data.technicalSummary.find((row) => row.model === "CRS");
  const nonCh4 = summaryMap(data.nonCh4Summary);
  const baselinePca = data.pcaSensitivity.find((row) => row.variant === "winsor_p95");
  const pcaLoo = data.pcaLoo[0] || {};
  const technicalLoo = data.looSummary[0] || {};
  const stats = [
    {
      label: "Technical DEA VRS",
      value: `${formatNumber(toNumber(vrs?.efficient_dmus), 0)} efficient`,
      sub: `Mean theta ${formatNumber(toNumber(vrs?.mean), 2)}`,
    },
    {
      label: "Technical DEA CRS",
      value: `${formatNumber(toNumber(crs?.efficient_dmus), 0)} efficient`,
      sub: `Mean theta ${formatNumber(toNumber(crs?.mean), 2)}`,
    },
    {
      label: "Leave-one-out DEA",
      value: `${formatNumber(toNumber(technicalLoo.super_efficient), 0)} super-efficient`,
      sub: `${formatNumber(toNumber(technicalLoo.infeasible), 0)} infeasible peer tests`,
    },
    {
      label: "Non-CH4 climate DEA",
      value: `Mean ${formatNumber(nonCh4.get("mean"), 2)}`,
      sub: `Min ${formatNumber(nonCh4.get("min"), 2)} | Max ${formatNumber(nonCh4.get("max"), 2)}`,
    },
    {
      label: "PCA baseline",
      value: `${formatNumber(toNumber(baselinePca?.pc1_pc2_cumulative) * 100, 1)}% PC1-PC2`,
      sub: `Silhouette ${formatNumber(toNumber(baselinePca?.silhouette_pc1_pc2), 2)}`,
    },
    {
      label: "PCA leave-one-out",
      value: `ARI ${formatNumber(toNumber(pcaLoo.mean_ari_among_remaining_dmus), 2)}`,
      sub: `Max changed ${formatNumber(toNumber(pcaLoo.max_remaining_dmus_changed_cluster_n), 0)} DMUs`,
    },
  ];
  elements.statGrid.innerHTML = stats
    .map(
      (stat) => `
        <div class="stat">
          <small>${stat.label}</small>
          <strong>${stat.value}</strong>
          <small>${stat.sub}</small>
        </div>
      `
    )
    .join("");
}

function renderDea(data) {
  const rows = [
    ...data.technicalSummary.map((row) => ({
      check: `Technical DEA ${row.model}`,
      metric: "Same inputs/output; returns-to-scale robustness",
      count: row.count,
      mean: row.mean,
      median: row.median,
      min: row.min,
      max: row.max,
      note: `${row.efficient_dmus} efficient DMUs`,
    })),
    {
      check: "Technical DEA leave-one-out",
      metric: "VRS peer-frontier sensitivity",
      count: data.looSummary[0]?.dmus,
      mean: data.looSummary[0]?.mean_feasible_loo_theta,
      median: data.looSummary[0]?.median_feasible_loo_theta,
      min: "",
      max: "",
      note: `${data.looSummary[0]?.super_efficient} super-efficient; ${data.looSummary[0]?.infeasible} infeasible`,
    },
    {
      check: "Climate-adjusted DEA, without CH4",
      metric: "N, crop protection, non-CH4 climate pressure, yield",
      ...summaryRow(data.nonCh4Summary),
      note: "Preferred environmental sensitivity because CH4 is constant per hectare",
    },
    {
      check: "Climate-adjusted DEA, total climate",
      metric: "N, crop protection, total climate pressure, yield",
      ...summaryRow(data.climateSummary),
      note: "Sensitivity including CH4",
    },
  ];
  elements.deaCount.textContent = `${rows.length} checks`;
  elements.deaSummaryTable.innerHTML = renderTable(rows, [
    ["check", "Check"],
    ["metric", "Model basis"],
    ["count", "n"],
    ["mean", "Mean"],
    ["median", "Median"],
    ["min", "Min"],
    ["max", "Max"],
    ["note", "Interpretation note"],
  ]);
}

function renderPca(data) {
  const rows = data.pcaSensitivity.map((row) => ({
    variant: row.variant,
    cap: row.cap_quantile,
    pc12: `${formatNumber(toNumber(row.pc1_pc2_cumulative) * 100, 1)}%`,
    silhouette: row.silhouette_pc1_pc2,
    ari: row.ari_vs_winsor_p95,
    sizes: row.cluster_sizes,
  }));
  const loo = data.pcaLoo[0] || {};
  rows.push({
    variant: "leave_one_out",
    cap: "recompute 34 times",
    pc12: "",
    silhouette: "",
    ari: `mean ${formatNumber(toNumber(loo.mean_ari_among_remaining_dmus), 2)}; min ${formatNumber(
      toNumber(loo.min_ari_among_remaining_dmus),
      2
    )}`,
    sizes: `mean changed ${formatNumber(toNumber(loo.mean_remaining_dmus_changed_cluster_n), 1)}; max changed ${formatNumber(
      toNumber(loo.max_remaining_dmus_changed_cluster_n),
      0
    )}`,
  });
  elements.pcaCount.textContent = `${rows.length} sensitivity rows`;
  elements.pcaSummaryTable.innerHTML = renderTable(rows, [
    ["variant", "Variant"],
    ["cap", "Winsorisation"],
    ["pc12", "PC1+PC2"],
    ["silhouette", "Silhouette"],
    ["ari", "ARI"],
    ["sizes", "Cluster sizes / stability"],
  ]);
}

function renderLoadings(loadings) {
  const rows = loadings
    .filter((row) => row.variant === "winsor_p95" && ["1", "2"].includes(String(row.pc)))
    .map((row) => ({
      feature: readableFeature(row.feature),
      pc: `PC${row.pc}`,
      loading: row.loading,
      sign: toNumber(row.loading) >= 0 ? "positive" : "negative",
    }));
  elements.loadingTable.innerHTML = renderTable(rows, [
    ["feature", "Variable"],
    ["pc", "Component"],
    ["loading", "Loading"],
    ["sign", "Direction"],
  ]);
}

function renderTable(rows, columns) {
  if (!rows.length) return `<p class="empty">No diagnostic values found.</p>`;
  return `
    <table>
      <thead>
        <tr>${columns.map(([, label]) => `<th>${label}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                ${columns.map(([key]) => `<td>${formatCell(row[key])}</td>`).join("")}
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function summaryMap(rows) {
  return rows.reduce((map, row) => {
    map.set(row.index, toNumber(row.value));
    return map;
  }, new Map());
}

function summaryRow(rows) {
  const map = summaryMap(rows);
  return {
    count: map.get("count"),
    mean: map.get("mean"),
    median: map.get("50%"),
    min: map.get("min"),
    max: map.get("max"),
  };
}

function readableFeature(feature) {
  const names = {
    n_kg_ha: "Nitrogen input",
    crop_protection_kg_ai_ha: "Crop protection intensity",
    soil_operation_intensity_ha_ha: "Soil-related machinery operations",
    yield_kg_ha: "Yield",
  };
  return names[feature] || feature;
}

function formatCell(value) {
  const numeric = toNumber(value);
  if (numeric != null && `${value}`.trim() !== "") return formatNumber(numeric, 3);
  return value ?? "";
}

function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}
