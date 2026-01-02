import { loadCsv, toNumber } from "./pivot-data.js";

const state = {
  rows: [],
  categories: [],
  unitMap: new Map(),
  filters: {
    basis: "ha",
    category: "all",
  },
};

const elements = {
  category: document.getElementById("category-filter"),
  basis: document.getElementById("basis-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  chartContext: document.getElementById("chart-context"),
  relativeBars: document.getElementById("relative-bars"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
  download: document.getElementById("download-csv"),
};

const clusterColors = {
  1: "#f97316",
  2: "#22c55e",
  3: "#3b82f6",
};

const categoryOrder = [
  "Climate change",
  "Ozone depletion",
  "Ionising radiation",
  "Photochemical ozone formation",
  "Particulate matter",
  "Human toxicity, non-cancer",
  "Human toxicity, cancer",
  "Acidification",
  "Eutrophication, freshwater",
  "Eutrophication, marine",
  "Eutrophication, terrestrial",
  "Ecotoxicity, freshwater",
  "Land use",
  "Water use",
  "Resource use, fossils",
  "Resource use, minerals and metals",
  "Climate change - Fossil",
  "Climate change - Biogenic",
  "Climate change - Land use and LU change",
  "Human toxicity, non-cancer - organics",
  "Human toxicity, non-cancer - inorganics",
  "Human toxicity, non-cancer - metals",
  "Human toxicity, cancer - organics",
  "Human toxicity, cancer - inorganics",
  "Human toxicity, cancer - metals",
  "Ecotoxicity, freshwater - organics",
  "Ecotoxicity, freshwater - inorganics",
  "Ecotoxicity, freshwater - metals",
];

init();

async function init() {
  const [haRows, tonneRows, totals] = await Promise.all([
    loadCsv("./data/cluster_impacts/impacts_relative_burden_ha.csv"),
    loadCsv("./data/cluster_impacts/impacts_relative_burden_tonne.csv"),
    loadCsv("./data/cluster_impacts/lca_cluster_totals_sum.csv"),
  ]);
  state.rows = [...haRows, ...tonneRows]
    .map((row) => ({
      impact_category: row.impact_category,
      basis: row.basis,
      cluster: toNumber(row.cluster),
      total_mean: toNumber(row.total_mean),
      relative_to_cluster2: toNumber(row.relative_to_cluster2),
      percent_diff_vs_cluster2: toNumber(row.percent_diff_vs_cluster2),
    }))
    .filter((row) => row.impact_category && row.basis && Number.isFinite(row.cluster));

  totals.forEach((row) => {
    if (!row.impact_category || !row.unit) return;
    if (!state.unitMap.has(row.impact_category)) {
      state.unitMap.set(row.impact_category, row.unit);
    }
  });

  hydrateFilters();
  attachEvents();
  render();
}

function hydrateFilters() {
  const categories = uniqueValues(state.rows, "impact_category");
  const ordered = sortCategories(categories);
  state.categories = ordered;
  elements.category.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All categories";
  elements.category.appendChild(optAll);
  ordered.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    elements.category.appendChild(opt);
  });
  if (ordered.length) {
    state.filters.category = ordered[0];
    elements.category.value = ordered[0];
  }
}

function attachEvents() {
  elements.category.addEventListener("change", () => {
    state.filters.category = elements.category.value;
    render();
  });
  elements.basis.addEventListener("change", () => {
    state.filters.basis = elements.basis.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    state.filters = { basis: "ha", category: state.categories[0] || "all" };
    elements.basis.value = "ha";
    elements.category.value = state.filters.category;
    render();
  });
  if (elements.download) {
    elements.download.addEventListener("click", downloadCsv);
  }
}

function render() {
  renderActive();
  renderStats();
  renderBars();
  renderDetail();
}

function renderActive() {
  const parts = [];
  parts.push(state.filters.category === "all" ? "All categories" : state.filters.category);
  parts.push(state.filters.basis === "tonne" ? "Per tonne" : "Per hectare");
  elements.active.textContent = parts.join(" • ");
}

function renderStats() {
  if (state.filters.category === "all") {
    elements.statGrid.innerHTML = `<p class="empty">Select a category to compare clusters.</p>`;
    return;
  }
  const rows = filteredRows();
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No data for this selection.</p>`;
    return;
  }
  const unit = state.unitMap.get(state.filters.category) || "";
  const basisSuffix = state.filters.basis === "ha" ? "ha" : "tonne";
  const clusters = rows.map((row) => row.cluster).sort((a, b) => a - b);
  elements.statGrid.innerHTML = clusters
    .map((cluster) => {
      const row = rows.find((r) => r.cluster === cluster);
      if (!row) return "";
      const pct = formatSignedPercent(row.percent_diff_vs_cluster2);
      const ratio = formatNumber(row.relative_to_cluster2, 2);
      return `
        <div class="stat">
          <small>Cluster ${cluster}</small>
          <strong>${formatNumber(row.total_mean, 2)}</strong>
          <small>${unit} per ${basisSuffix} | ${pct} vs C2 | Ratio ${ratio}x</small>
        </div>
      `;
    })
    .join("");
}

function renderBars() {
  if (state.filters.category === "all") {
    elements.relativeBars.innerHTML = `<p class="empty">Select a category to view percent differences.</p>`;
    elements.chartContext.textContent = "";
    return;
  }
  const rows = filteredRows().sort((a, b) => a.cluster - b.cluster);
  if (!rows.length) {
    elements.relativeBars.innerHTML = `<p class="empty">No data for this selection.</p>`;
    elements.chartContext.textContent = "";
    return;
  }
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.percent_diff_vs_cluster2 || 0)), 1);
  elements.chartContext.textContent = `Cluster 2 baseline`;
  elements.relativeBars.innerHTML = rows
    .map((row) => {
      const pct = row.percent_diff_vs_cluster2 || 0;
      const width = Math.abs(pct) / maxAbs * 100;
      const color = clusterColors[row.cluster] || "#64748b";
      const opacity = pct < 0 ? 0.45 : 0.9;
      return `
        <div class="bar-row">
          <div class="bar-label">
            <div>Cluster ${row.cluster}</div>
            <small>${formatSignedPercent(pct)} vs cluster 2 · Ratio ${formatNumber(
              row.relative_to_cluster2,
              2
            )}x</small>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%; background:${color}; opacity:${opacity}"></div>
            <span class="bar-value">${formatSignedPercent(pct)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDetail() {
  const rows = filteredRows(state.filters.category !== "all");
  elements.detailCount.textContent = `${rows.length} rows`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No rows for this selection.</p>`;
    return;
  }
  const basisSuffix = state.filters.basis === "ha" ? "ha" : "tonne";
  const rowsHtml = rows
    .slice()
    .sort((a, b) => {
      const catOrder = categoryIndex(a.impact_category) - categoryIndex(b.impact_category);
      if (catOrder !== 0) return catOrder;
      return a.cluster - b.cluster;
    })
    .map((row) => {
      const unit = state.unitMap.get(row.impact_category) || "";
      return `
        <tr>
          <td>${row.impact_category}</td>
          <td>${row.cluster}</td>
          <td>${formatNumber(row.total_mean, 2)}</td>
          <td>${unit}</td>
          <td>${basisSuffix}</td>
          <td>${formatNumber(row.relative_to_cluster2, 2)}x</td>
          <td>${formatSignedPercent(row.percent_diff_vs_cluster2)}</td>
        </tr>
      `;
    })
    .join("");
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Impact category</th>
          <th>Cluster</th>
          <th>Total mean</th>
          <th>Unit</th>
          <th>Basis</th>
          <th>Ratio vs C2</th>
          <th>% diff vs C2</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function downloadCsv() {
  const rows = filteredRows(state.filters.category !== "all");
  if (!rows.length) return;
  const header = [
    "impact_category",
    "basis",
    "cluster",
    "total_mean",
    "relative_to_cluster2",
    "percent_diff_vs_cluster2",
    "unit",
  ];
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.impact_category,
        row.basis,
        row.cluster,
        row.total_mean,
        row.relative_to_cluster2,
        row.percent_diff_vs_cluster2,
        state.unitMap.get(row.impact_category) || "",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cluster_relative_burdens.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function filteredRows(onlyCategory = true) {
  return state.rows.filter((row) => {
    if (row.basis !== state.filters.basis) return false;
    if (onlyCategory && state.filters.category !== "all" && row.impact_category !== state.filters.category) {
      return false;
    }
    return true;
  });
}

function uniqueValues(rows, key) {
  return Array.from(
    rows.reduce((set, row) => {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") set.add(row[key]);
      return set;
    }, new Set())
  );
}

function sortCategories(categories) {
  const order = new Map(categoryOrder.map((cat, idx) => [cat, idx]));
  return categories.slice().sort((a, b) => {
    const aIdx = order.has(a) ? order.get(a) : Number.POSITIVE_INFINITY;
    const bIdx = order.has(b) ? order.get(b) : Number.POSITIVE_INFINITY;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.localeCompare(b);
  });
}

function categoryIndex(cat) {
  const idx = categoryOrder.indexOf(cat);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

function formatNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSignedPercent(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${formatNumber(value, 1)}%`;
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
