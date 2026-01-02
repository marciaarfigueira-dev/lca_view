import { loadCsv, toNumber } from "./pivot-data.js";

const state = {
  totals: [],
  bySource: [],
  categories: [],
  unitsByCategory: new Map(),
  filters: {
    basis: "ha",
    cluster: "all",
    category: "",
  },
};

const elements = {
  category: document.getElementById("category-filter"),
  cluster: document.getElementById("cluster-filter"),
  basis: document.getElementById("basis-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  sourceBars: document.getElementById("source-bars"),
  sourceCount: document.getElementById("source-count"),
  sourceContext: document.getElementById("source-context"),
  sourceLegend: document.getElementById("source-legend"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
  download: document.getElementById("download-csv"),
};

const sourceMeta = {
  crop_protection: { label: "Crop protection", color: "#ef4444" },
  fertilisers: { label: "Fertilisation", color: "#3b82f6" },
  machines: { label: "Machinery", color: "#a855f7" },
  sowing: { label: "Sowing", color: "#22c55e" },
  water: { label: "Water", color: "#0bb7a8" },
  ch4: { label: "CH4", color: "#f59e0b" },
  n2o: { label: "N2O", color: "#10b981" },
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
  const [totalsRows, sourceRows] = await Promise.all([
    loadCsv("./data/cluster_impacts/lca_cluster_totals_sum.csv"),
    loadCsv("./data/cluster_impacts/impacts_all_sources_by_cluster.csv"),
  ]);
  state.totals = totalsRows
    .map((row) => ({
      impact_category: row.impact_category,
      unit: row.unit,
      basis: row.basis,
      cluster: toNumber(row.cluster),
      total_mean: toNumber(row.total_mean),
      n_total: toNumber(row.n_total),
    }))
    .filter((row) => row.impact_category && row.unit && row.basis && Number.isFinite(row.cluster));
  state.bySource = sourceRows
    .map((row) => ({
      impact_category: row.impact_category,
      unit: row.unit,
      basis: row.basis,
      cluster: toNumber(row.cluster),
      source: row.source,
      mean: toNumber(row.mean),
    }))
    .filter(
      (row) =>
        row.impact_category &&
        row.unit &&
        row.basis &&
        Number.isFinite(row.cluster) &&
        row.source
    );
  hydrateFilters();
  attachEvents();
  render();
}

function hydrateFilters() {
  const categories = uniqueValues(state.totals, "impact_category");
  const ordered = sortCategories(categories);
  state.categories = ordered;
  ordered.forEach((cat) => {
    const existing = state.unitsByCategory.get(cat);
    if (!existing) {
      const row = state.totals.find((r) => r.impact_category === cat);
      if (row) state.unitsByCategory.set(cat, row.unit);
    }
  });
  elements.category.innerHTML = "";
  ordered.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    elements.category.appendChild(opt);
  });
  const preferred = ordered.includes("Climate change") ? "Climate change" : ordered[0];
  state.filters.category = preferred;
  elements.category.value = preferred;

  const clusters = uniqueValues(state.totals, "cluster").sort((a, b) => a - b);
  elements.cluster.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All clusters";
  elements.cluster.appendChild(optAll);
  clusters.forEach((cluster) => {
    const opt = document.createElement("option");
    opt.value = `${cluster}`;
    opt.textContent = `Cluster ${cluster}`;
    elements.cluster.appendChild(opt);
  });
}

function attachEvents() {
  elements.category.addEventListener("change", () => {
    state.filters.category = elements.category.value;
    render();
  });
  elements.cluster.addEventListener("change", () => {
    state.filters.cluster = elements.cluster.value;
    render();
  });
  elements.basis.addEventListener("change", () => {
    state.filters.basis = elements.basis.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    state.filters.basis = "ha";
    state.filters.cluster = "all";
    state.filters.category = state.categories[0] || "";
    elements.basis.value = "ha";
    elements.cluster.value = "all";
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
  renderSources();
  renderDetail();
}

function renderActive() {
  const parts = [];
  if (state.filters.category) parts.push(state.filters.category);
  parts.push(`${basisLabel(state.filters.basis)}`);
  if (state.filters.cluster === "all") {
    parts.push("All clusters");
  } else {
    parts.push(`Cluster ${state.filters.cluster}`);
  }
  elements.active.textContent = parts.join(" • ");
}

function renderStats() {
  const rows = state.totals.filter(
    (row) => row.basis === state.filters.basis && row.impact_category === state.filters.category
  );
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No totals available for this selection.</p>`;
    return;
  }
  const clusters = uniqueValues(rows, "cluster").sort((a, b) => a - b);
  const unit = state.unitsByCategory.get(state.filters.category) || rows[0].unit;
  const basisSuffix = state.filters.basis === "ha" ? "ha" : "tonne";
  elements.statGrid.innerHTML = clusters
    .map((cluster) => {
      const row = rows.find((r) => r.cluster === cluster);
      if (!row) return "";
      return `
        <div class="stat">
          <small>Cluster ${cluster}</small>
          <strong>${formatNumber(row.total_mean, 2)}</strong>
          <small>${unit} per ${basisSuffix} | n=${formatNumber(row.n_total, 0)}</small>
        </div>
      `;
    })
    .join("");
}

function renderSources() {
  const basis = state.filters.basis;
  const category = state.filters.category;
  const clusterFilter = state.filters.cluster;
  const matches = state.bySource.filter(
    (row) => row.basis === basis && row.impact_category === category
  );

  let entries = [];
  if (clusterFilter === "all") {
    const grouped = new Map();
    matches.forEach((row) => {
      if (!Number.isFinite(row.mean)) return;
      if (!grouped.has(row.source)) {
        grouped.set(row.source, { sum: 0, count: 0 });
      }
      const rec = grouped.get(row.source);
      rec.sum += row.mean;
      rec.count += 1;
    });
    entries = Array.from(grouped.entries()).map(([source, rec]) => ({
      source,
      value: rec.count ? rec.sum / rec.count : null,
    }));
    elements.sourceContext.textContent = "All clusters (mean)";
  } else {
    const clusterValue = Number(clusterFilter);
    entries = matches
      .filter((row) => row.cluster === clusterValue)
      .map((row) => ({ source: row.source, value: row.mean }));
    elements.sourceContext.textContent = `Cluster ${clusterFilter}`;
  }

  entries = entries.filter((row) => Number.isFinite(row.value)).sort((a, b) => b.value - a.value);
  elements.sourceCount.textContent = `${entries.length} sources`;
  if (!entries.length) {
    elements.sourceBars.innerHTML = `<p class="empty">No source impacts for this selection.</p>`;
    elements.sourceLegend.innerHTML = "";
    return;
  }
  const maxVal = Math.max(...entries.map((entry) => entry.value), 1);
  const unit = state.unitsByCategory.get(category) || (matches[0] ? matches[0].unit : "");
  const basisSuffix = basis === "ha" ? "ha" : "tonne";
  elements.sourceBars.innerHTML = entries
    .map((entry) => {
      const meta = sourceMeta[entry.source] || {
        label: entry.source,
        color: "#64748b",
      };
      const width = (entry.value / maxVal) * 100;
      return `
        <div class="bar-row">
          <div class="bar-label">
            <div>${meta.label}</div>
            <small>${formatNumber(entry.value, 2)} ${unit} per ${basisSuffix}</small>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%; background:${meta.color}"></div>
            <span class="bar-value">${formatNumber(entry.value, 2)}</span>
          </div>
        </div>
      `;
    })
    .join("");
  renderLegend(entries);
}

function renderLegend(entries) {
  const items = entries
    .map((entry) => {
      const meta = sourceMeta[entry.source] || { label: entry.source, color: "#64748b" };
      return `
        <span class="legend-item">
          <span class="legend-swatch" style="background:${meta.color}"></span>
          ${meta.label}
        </span>
      `;
    })
    .join("");
  elements.sourceLegend.innerHTML = items;
}

function renderDetail() {
  const basis = state.filters.basis;
  const category = state.filters.category;
  const clusterFilter = state.filters.cluster;
  const rows = state.bySource.filter((row) => {
    if (row.basis !== basis) return false;
    if (row.impact_category !== category) return false;
    if (clusterFilter !== "all" && row.cluster !== Number(clusterFilter)) return false;
    return true;
  });
  elements.detailCount.textContent = `${rows.length} rows`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No source rows for this selection.</p>`;
    return;
  }
  const basisSuffix = basis === "ha" ? "ha" : "tonne";
  const rowsHtml = rows
    .slice()
    .sort((a, b) => {
      if (a.cluster !== b.cluster) return a.cluster - b.cluster;
      return (a.source || "").localeCompare(b.source || "");
    })
    .map((row) => {
      const meta = sourceMeta[row.source] || { label: row.source };
      return `
        <tr>
          <td>${row.cluster}</td>
          <td>${meta.label}</td>
          <td>${formatNumber(row.mean, 2)}</td>
          <td>${row.unit}</td>
          <td>${basisSuffix}</td>
        </tr>
      `;
    })
    .join("");
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Cluster</th>
          <th>Source</th>
          <th>Mean</th>
          <th>Unit</th>
          <th>Basis</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function downloadCsv() {
  const basis = state.filters.basis;
  const category = state.filters.category;
  const clusterFilter = state.filters.cluster;
  const rows = state.bySource.filter((row) => {
    if (row.basis !== basis) return false;
    if (row.impact_category !== category) return false;
    if (clusterFilter !== "all" && row.cluster !== Number(clusterFilter)) return false;
    return true;
  });
  if (!rows.length) return;
  const header = ["impact_category", "basis", "cluster", "source", "mean", "unit"];
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.impact_category,
        row.basis,
        row.cluster,
        row.source,
        row.mean,
        row.unit,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cluster_characterisation_by_source.csv";
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

function sortCategories(categories) {
  const order = new Map(categoryOrder.map((cat, idx) => [cat, idx]));
  return categories.slice().sort((a, b) => {
    const aIdx = order.has(a) ? order.get(a) : Number.POSITIVE_INFINITY;
    const bIdx = order.has(b) ? order.get(b) : Number.POSITIVE_INFINITY;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.localeCompare(b);
  });
}

function basisLabel(basis) {
  return basis === "tonne" ? "Per tonne" : "Per hectare";
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
