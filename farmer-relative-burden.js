import { baseFarmerId, extractSeason, loadCsv, toNumber } from "./pivot-data.js";

const STORAGE_KEY = "mlSetsFarmer";

const state = {
  farmer: "",
  seasonMap: new Map(),
  data: [],
  categories: [],
  unitMap: new Map(),
  clusters: [],
  filters: {
    season: "",
    basis: "ha",
    category: "all",
    compareCluster: "2",
  },
};

const elements = {
  title: document.getElementById("farmer-title"),
  subtitle: document.getElementById("farmer-subtitle"),
  pill: document.getElementById("farmer-pill"),
  missing: document.getElementById("missing-panel"),
  view: document.getElementById("burden-view"),
  season: document.getElementById("season-filter"),
  basis: document.getElementById("basis-filter"),
  category: document.getElementById("category-filter"),
  compare: document.getElementById("compare-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  chartContext: document.getElementById("chart-context"),
  relativeBars: document.getElementById("relative-bars"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
  download: document.getElementById("download-csv"),
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
  state.farmer = getSelectedFarmer();
  if (!state.farmer) {
    showMissing();
    return;
  }
  updateHeader(state.farmer);
  const [clusters, haRows, tonneRows, totals] = await Promise.all([
    loadCsv("./data/clusters/dea_clusters_hcpc_full.csv"),
    loadCsv("./data/cluster_impacts/impacts_relative_burden_ha.csv"),
    loadCsv("./data/cluster_impacts/impacts_relative_burden_tonne.csv"),
    loadCsv("./data/cluster_impacts/lca_cluster_totals_sum.csv"),
  ]);
  buildSeasonMap(clusters);
  if (!state.seasonMap.size) {
    showMissing(
      "No seasons found.",
      "We could not find any seasons for this farmer. Choose another farmer to continue."
    );
    return;
  }
  state.data = [...haRows, ...tonneRows]
    .map((row) => ({
      impact_category: row.impact_category,
      basis: row.basis,
      cluster: toNumber(row.cluster),
      total_mean: toNumber(row.total_mean),
      relative_to_cluster2: toNumber(row.relative_to_cluster2),
      percent_diff_vs_cluster2: toNumber(row.percent_diff_vs_cluster2),
    }))
    .filter((row) => row.impact_category && row.basis && Number.isFinite(row.cluster));
  state.clusters = uniqueValues(state.data, "cluster").sort((a, b) => a - b);
  totals.forEach((row) => {
    if (row.impact_category && row.unit && !state.unitMap.has(row.impact_category)) {
      state.unitMap.set(row.impact_category, row.unit);
    }
  });
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

function updateHeader(farmer) {
  elements.title.textContent = `Farmer ${farmer} · Relative burdens`;
  elements.subtitle.textContent = `Relative burdens for ${farmer} by season and impact category.`;
  elements.pill.textContent = `Farmer ${farmer}`;
}

function showMissing(title, message) {
  elements.view.style.display = "none";
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

function buildSeasonMap(rows) {
  rows.forEach((row) => {
    const dmuId = row.dmu_id || "";
    const farmer = baseFarmerId(dmuId) || dmuId;
    if (farmer !== state.farmer) return;
    const season = extractSeason(row);
    const cluster = toNumber(row.cluster_hcpc_full);
    if (!season || cluster == null) return;
    state.seasonMap.set(String(season), cluster);
  });
}

function hydrateFilters() {
  const seasons = Array.from(state.seasonMap.keys())
    .map((s) => Number(s))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  elements.season.innerHTML = "";
  seasons.forEach((season) => {
    const opt = document.createElement("option");
    opt.value = season;
    opt.textContent = season;
    elements.season.appendChild(opt);
  });
  state.filters.season = String(seasons[0]);
  elements.season.value = state.filters.season;

  const categories = uniqueValues(state.data, "impact_category");
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

  elements.compare.innerHTML = "";
  state.clusters.forEach((cluster) => {
    const opt = document.createElement("option");
    opt.value = `${cluster}`;
    opt.textContent = `Cluster ${cluster}`;
    elements.compare.appendChild(opt);
  });
  if (state.clusters.includes(2)) {
    elements.compare.value = "2";
    state.filters.compareCluster = "2";
  } else if (state.clusters.length) {
    elements.compare.value = `${state.clusters[0]}`;
    state.filters.compareCluster = `${state.clusters[0]}`;
  }
}

function attachEvents() {
  elements.season.addEventListener("change", () => {
    state.filters.season = elements.season.value;
    render();
  });
  elements.basis.addEventListener("change", () => {
    state.filters.basis = elements.basis.value;
    render();
  });
  elements.category.addEventListener("change", () => {
    state.filters.category = elements.category.value;
    render();
  });
  elements.compare.addEventListener("change", () => {
    state.filters.compareCluster = elements.compare.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    const seasons = Array.from(state.seasonMap.keys())
      .map((s) => Number(s))
      .filter(Number.isFinite)
      .sort((a, b) => b - a);
    state.filters = {
      season: String(seasons[0]),
      basis: "ha",
      category: "all",
      compareCluster: state.filters.compareCluster || "2",
    };
    elements.season.value = state.filters.season;
    elements.basis.value = "ha";
    elements.category.value = "all";
    elements.compare.value = state.filters.compareCluster;
    render();
  });
  if (elements.download) {
    elements.download.addEventListener("click", downloadCsv);
  }
}

function render() {
  const cluster = state.seasonMap.get(state.filters.season);
  const rows = filteredRows(cluster);
  renderActive(cluster, rows.length);
  renderStats(rows, cluster);
  renderChart(rows, cluster);
  renderDetail(rows, cluster);
}

function renderActive(cluster, count) {
  const parts = [];
  parts.push(`Season ${state.filters.season}`);
  if (cluster != null) parts.push(`Cluster ${cluster}`);
  if (state.filters.compareCluster) parts.push(`Compare to C${state.filters.compareCluster}`);
  parts.push(state.filters.basis === "tonne" ? "Per tonne" : "Per hectare");
  if (state.filters.category !== "all") parts.push(state.filters.category);
  elements.active.textContent = `${parts.join(" • ")} — ${count} categories`;
}

function renderStats(rows, cluster) {
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No data for this selection.</p>`;
    return;
  }
  const compareCluster = Number(state.filters.compareCluster);
  const compareRows = rowsForCompare(compareCluster);
  if (state.filters.category !== "all") {
    const row = rows[0];
    const compareRow = compareRows.find((r) => r.impact_category === row.impact_category);
    const ratioToCompare = compareRow ? ratio(row.total_mean, compareRow.total_mean) : null;
    const diffToCompare = compareRow ? diffPercent(row.total_mean, compareRow.total_mean) : null;
    const unit = state.unitMap.get(row.impact_category) || "";
    const basis = state.filters.basis === "tonne" ? "tonne" : "ha";
    const stats = [
      { label: "Cluster", value: cluster != null ? `Cluster ${cluster}` : "—" },
      { label: "Total mean", value: formatMetric(row.total_mean, unit, 2, basis) },
      {
        label: `Relative to C${compareCluster}`,
        value: ratioToCompare == null ? "—" : `${formatNumber(ratioToCompare, 2)}x`,
      },
      {
        label: `Percent diff vs C${compareCluster}`,
        value: diffToCompare == null ? "—" : formatSignedPercent(diffToCompare),
      },
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
    return;
  }
  const diffs = rows
    .map((row) => {
      const compareRow = compareRows.find((r) => r.impact_category === row.impact_category);
      return compareRow ? diffPercent(row.total_mean, compareRow.total_mean) : null;
    })
    .filter((val) => val != null);
  const ratios = rows
    .map((row) => {
      const compareRow = compareRows.find((r) => r.impact_category === row.impact_category);
      return compareRow ? ratio(row.total_mean, compareRow.total_mean) : null;
    })
    .filter((val) => val != null);
  const meanRatio = average(ratios);
  const meanDiff = average(diffs);
  const maxRow = rows.reduce((a, b) => {
    const aComp = compareRows.find((r) => r.impact_category === a.impact_category);
    const bComp = compareRows.find((r) => r.impact_category === b.impact_category);
    const aDiff = aComp ? diffPercent(a.total_mean, aComp.total_mean) : -Infinity;
    const bDiff = bComp ? diffPercent(b.total_mean, bComp.total_mean) : -Infinity;
    return bDiff > aDiff ? b : a;
  });
  const minRow = rows.reduce((a, b) => {
    const aComp = compareRows.find((r) => r.impact_category === a.impact_category);
    const bComp = compareRows.find((r) => r.impact_category === b.impact_category);
    const aDiff = aComp ? diffPercent(a.total_mean, aComp.total_mean) : Infinity;
    const bDiff = bComp ? diffPercent(b.total_mean, bComp.total_mean) : Infinity;
    return bDiff < aDiff ? b : a;
  });
  const stats = [
    { label: "Cluster", value: cluster != null ? `Cluster ${cluster}` : "—" },
    { label: "Categories", value: `${rows.length}` },
    { label: `Avg ratio vs C${compareCluster}`, value: meanRatio == null ? "—" : `${formatNumber(meanRatio, 2)}x` },
    { label: `Avg diff vs C${compareCluster}`, value: meanDiff == null ? "—" : formatSignedPercent(meanDiff) },
    {
      label: "Highest burden",
      value: formatExtreme(maxRow, compareRows, "max", compareCluster),
    },
    {
      label: "Lowest burden",
      value: formatExtreme(minRow, compareRows, "min", compareCluster),
    },
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

function renderChart(rows, cluster) {
  if (!rows.length) {
    elements.relativeBars.innerHTML = `<p class="empty">No data for this selection.</p>`;
    elements.chartContext.textContent = "";
    return;
  }
  const compareCluster = Number(state.filters.compareCluster);
  const compareRows = rowsForCompare(compareCluster);
  const entries = rows
    .map((row) => {
      const compareRow = compareRows.find((r) => r.impact_category === row.impact_category);
      const diff = compareRow ? diffPercent(row.total_mean, compareRow.total_mean) : null;
      const ratioValue = compareRow ? ratio(row.total_mean, compareRow.total_mean) : null;
      return {
        category: row.impact_category,
        diff,
        ratio: ratioValue,
      };
    })
    .filter((row) => row.diff != null)
    .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0));
  const maxAbs = Math.max(...entries.map((e) => Math.abs(e.diff ?? 0)), 1);
  elements.chartContext.textContent = cluster != null ? `Cluster ${cluster} vs C${compareCluster}` : "Cluster";
  elements.relativeBars.innerHTML = entries
    .map((entry) => {
      const diff = entry.diff ?? 0;
      const width = (Math.abs(diff) / maxAbs) * 100;
      const color = diff >= 0 ? "#d9703e" : "#1d7c72";
      return `
        <div class="bar-row">
          <div class="bar-label">
            <div>${entry.category}</div>
            <small>${formatSignedPercent(diff)} · ${formatNumber(entry.ratio, 2)}x</small>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%; background:${color}"></div>
            <span class="bar-value">${formatSignedPercent(diff)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDetail(rows, cluster) {
  elements.detailCount.textContent = `${rows.length} rows`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No rows for this selection.</p>`;
    return;
  }
  const compareCluster = Number(state.filters.compareCluster);
  const compareRows = rowsForCompare(compareCluster);
  const basis = state.filters.basis === "tonne" ? "tonne" : "ha";
  const rowsHtml = rows
    .slice()
    .sort((a, b) => categoryIndex(a.impact_category) - categoryIndex(b.impact_category))
    .map((row) => {
      const unit = state.unitMap.get(row.impact_category) || "";
      const compareRow = compareRows.find((r) => r.impact_category === row.impact_category);
      const ratioValue = compareRow ? ratio(row.total_mean, compareRow.total_mean) : null;
      const diffValue = compareRow ? diffPercent(row.total_mean, compareRow.total_mean) : null;
      return `
        <tr>
          <td>${row.impact_category}</td>
          <td>${cluster ?? "—"}</td>
          <td>${formatMetric(row.total_mean, unit, 2, basis)}</td>
          <td>${ratioValue == null ? "—" : `${formatNumber(ratioValue, 2)}x`}</td>
          <td>${diffValue == null ? "—" : formatSignedPercent(diffValue)}</td>
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
          <th>Ratio vs C${compareCluster}</th>
          <th>% diff vs C${compareCluster}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function downloadCsv() {
  const cluster = state.seasonMap.get(state.filters.season);
  const compareCluster = Number(state.filters.compareCluster);
  const compareRows = rowsForCompare(compareCluster);
  const rows = filteredRows(cluster);
  if (!rows.length) return;
  const header = [
    "impact_category",
    "season",
    "cluster",
    "compare_cluster",
    "basis",
    "total_mean",
    "relative_to_compare",
    "percent_diff_vs_compare",
  ];
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      (() => {
        const compareRow = compareRows.find((r) => r.impact_category === row.impact_category);
        const ratioValue = compareRow ? ratio(row.total_mean, compareRow.total_mean) : null;
        const diffValue = compareRow ? diffPercent(row.total_mean, compareRow.total_mean) : null;
        return [
          row.impact_category,
          state.filters.season,
          cluster,
          compareCluster,
          row.basis,
          row.total_mean,
          ratioValue,
          diffValue,
        ]
          .map(csvEscape)
          .join(",");
      })()
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `farmer_${state.farmer || "selection"}_relative_burdens.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function filteredRows(cluster) {
  if (cluster == null) return [];
  return state.data.filter((row) => {
    if (row.basis !== state.filters.basis) return false;
    if (row.cluster !== cluster) return false;
    if (state.filters.category !== "all" && row.impact_category !== state.filters.category) return false;
    return true;
  });
}

function rowsForCompare(compareCluster) {
  return state.data.filter((row) => {
    if (row.basis !== state.filters.basis) return false;
    if (row.cluster !== compareCluster) return false;
    if (state.filters.category !== "all" && row.impact_category !== state.filters.category) return false;
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

function categoryIndex(category) {
  const idx = categoryOrder.indexOf(category);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

function average(values) {
  const nums = values.filter((val) => Number.isFinite(val));
  if (!nums.length) return null;
  return nums.reduce((sum, val) => sum + val, 0) / nums.length;
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

function formatMetric(value, unit, digits, basis) {
  if (value == null || !Number.isFinite(value)) return "—";
  const text = formatNumber(value, digits);
  const unitLabel = unit ? `${unit}/${basis}` : "";
  return unitLabel ? `${text} ${unitLabel}` : text;
}

function ratio(value, compare) {
  if (!Number.isFinite(value) || !Number.isFinite(compare) || compare === 0) return null;
  return value / compare;
}

function diffPercent(value, compare) {
  if (!Number.isFinite(value) || !Number.isFinite(compare) || compare === 0) return null;
  return ((value - compare) / compare) * 100;
}

function formatExtreme(row, compareRows, mode, compareCluster) {
  if (!row) return "—";
  const compareRow = compareRows.find((r) => r.impact_category === row.impact_category);
  const diffValue = compareRow ? diffPercent(row.total_mean, compareRow.total_mean) : null;
  const label = row.impact_category;
  if (diffValue == null) return `${label} —`;
  return `${label} ${formatSignedPercent(diffValue)} vs C${compareCluster}`;
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
