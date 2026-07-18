import { loadCsv, toNumber } from "./pivot-data.js";

const SOURCES = [
  { key: "crop_protection", label: "Crop protection", totalColumn: "crop_protection_total_impact" },
  { key: "sowing", label: "Sowing", totalColumn: "sowing_total_impact" },
  { key: "fertilisation", label: "Fertilisation", totalColumn: "fertilisation_total_impact" },
  { key: "machines", label: "Machinery", totalColumn: "machines_total_impact" },
  { key: "water", label: "Water", totalColumn: "water_total_impact" },
  { key: "field_emissions", label: "Field emissions", totalColumn: "field_emissions_impact" },
];

const state = {
  rows: [],
  filters: {
    season: "all",
    basis: "ha",
    score: "chara",
    category: "",
    sort: "value_desc",
  },
};

const elements = {
  season: document.getElementById("season-filter"),
  basis: document.getElementById("basis-filter"),
  score: document.getElementById("score-filter"),
  category: document.getElementById("category-filter"),
  sort: document.getElementById("sort-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  benchmarkCount: document.getElementById("benchmark-count"),
  benchmarkChart: document.getElementById("benchmark-chart"),
  detailCount: document.getElementById("detail-count"),
  detailTable: document.getElementById("detail-table"),
};

init();

async function init() {
  state.rows = await Promise.all(SOURCES.flatMap((source) => loadSource(source))).then((groups) => groups.flat());
  hydrateFilters();
  attachEvents();
  render();
}

async function loadSource(source) {
  const variants = [
    { score: "single", folder: "single_score", basis: "ha", suffix: "ha" },
    { score: "single", folder: "single_score", basis: "tonne", suffix: "tonne" },
    { score: "chara", folder: "characterisation", basis: "ha", suffix: "ha" },
    { score: "chara", folder: "characterisation", basis: "tonne", suffix: "tonne" },
  ];
  return Promise.all(
    variants.map(async (variant) => {
      const path = `./data/clean_lca/${source.key}/${variant.folder}/${source.key}_${variant.folder}_by_dmu_${variant.suffix}.csv`;
      const rows = await loadCsv(path);
      return rows.map((row) => ({
        dmu_id: row.dmu_id || "",
        farmer_id: row.farmer_id || "",
        season: row.year || "",
        basis: row.basis || variant.basis,
        score: variant.score,
        category: row.impact_category || "",
        unit: row.impact_unit || "",
        source: sourceIdentity(source, row),
        value: toNumber(row[source.totalColumn]) || 0,
      }));
    })
  ).then((groups) => groups.flat());
}

function sourceIdentity(source, row) {
  if (source.key !== "field_emissions") return source.label;
  const gas = String(row.gas || "").toLowerCase();
  if (gas === "ch4") return "Methane (CH4)";
  if (gas === "n2o") return "N2O emissions";
  if (gas === "co2") return "Urea CO2";
  return "Other field emissions";
}

function hydrateFilters() {
  fillSelect(elements.season, uniqueValues(state.rows, "season").sort((a, b) => `${b}`.localeCompare(`${a}`)), "Year");
  hydrateCategoryFilter();
}

function hydrateCategoryFilter() {
  const current = state.filters.category;
  const rows = state.rows.filter((row) => row.score === state.filters.score && row.basis === state.filters.basis);
  const categories = uniqueValues(rows, "category").sort((a, b) => a.localeCompare(b));
  elements.category.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.appendChild(option);
  });
  const preferred = categories.includes(current)
    ? current
    : categories.includes("Climate change")
      ? "Climate change"
      : categories[0] || "";
  state.filters.category = preferred;
  elements.category.value = preferred;
}

function attachEvents() {
  elements.season.addEventListener("change", () => {
    state.filters.season = elements.season.value;
    render();
  });
  elements.basis.addEventListener("change", () => {
    state.filters.basis = elements.basis.value;
    hydrateCategoryFilter();
    render();
  });
  elements.score.addEventListener("change", () => {
    state.filters.score = elements.score.value;
    hydrateCategoryFilter();
    render();
  });
  elements.category.addEventListener("change", () => {
    state.filters.category = elements.category.value;
    render();
  });
  elements.sort.addEventListener("change", () => {
    state.filters.sort = elements.sort.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, {
      season: "all",
      basis: "ha",
      score: "chara",
      category: "",
      sort: "value_desc",
    });
    elements.season.value = "all";
    elements.basis.value = "ha";
    elements.score.value = "chara";
    elements.sort.value = "value_desc";
    hydrateCategoryFilter();
    render();
  });
}

function render() {
  const rows = filteredRows();
  const totals = sortRows(buildDmuTotals(rows));
  const values = totals.map((row) => row.total).filter(Number.isFinite);
  const med = median(values);
  renderActive(rows.length, totals.length);
  renderStats(totals, med);
  renderBenchmark(totals, med);
  renderDetail(totals, med);
}

function filteredRows() {
  return state.rows.filter((row) => {
    if (row.score !== state.filters.score) return false;
    if (row.basis !== state.filters.basis) return false;
    if (row.category !== state.filters.category) return false;
    if (state.filters.season !== "all" && `${row.season}` !== state.filters.season) return false;
    return true;
  });
}

function buildDmuTotals(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const current = map.get(row.dmu_id) || {
      dmu_id: row.dmu_id,
      farmer_id: row.farmer_id,
      season: row.season,
      unit: row.unit,
      total: 0,
      sources: new Map(),
    };
    current.total += row.value;
    current.sources.set(row.source, (current.sources.get(row.source) || 0) + row.value);
    if (!current.unit && row.unit) current.unit = row.unit;
    map.set(row.dmu_id, current);
  });
  return Array.from(map.values()).map((row) => {
    const mainSource = Array.from(row.sources.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      ...row,
      main_source: mainSource ? mainSource[0] : "",
      main_source_value: mainSource ? mainSource[1] : 0,
    };
  });
}

function sortRows(rows) {
  const sorted = [...rows];
  if (state.filters.sort === "value_asc") return sorted.sort((a, b) => a.total - b.total);
  if (state.filters.sort === "farmer") {
    return sorted.sort((a, b) => `${a.farmer_id}_${a.season}`.localeCompare(`${b.farmer_id}_${b.season}`));
  }
  return sorted.sort((a, b) => b.total - a.total);
}

function renderActive(sourceRows, dmuCount) {
  const parts = [];
  if (state.filters.season !== "all") parts.push(`Year ${state.filters.season}`);
  parts.push(state.filters.basis === "ha" ? "Per hectare" : "Per tonne");
  parts.push(state.filters.score === "single" ? "Single score" : "Characterisation");
  parts.push(state.filters.category || "No category");
  elements.active.textContent = `${parts.join(" • ")} - ${dmuCount} farmer-years, ${sourceRows} source rows`;
}

function renderStats(rows, med) {
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No benchmark values match these filters.</p>`;
    return;
  }
  const values = rows.map((row) => row.total).filter(Number.isFinite);
  const highest = rows.reduce((best, row) => (!best || row.total > best.total ? row : best), null);
  const lowest = rows.reduce((best, row) => (!best || row.total < best.total ? row : best), null);
  const unit = rows.find((row) => row.unit)?.unit || "";
  const stats = [
    { label: "Farmer-years", value: formatNumber(rows.length, 0), sub: "Current selection" },
    { label: "Regional median", value: `${formatNumber(med, 3)} ${unit}`, sub: "Benchmark reference" },
    { label: "Highest value", value: highest ? highest.dmu_id : "-", sub: highest ? `${formatNumber(highest.total, 3)} ${unit}` : "" },
    { label: "Lowest value", value: lowest ? lowest.dmu_id : "-", sub: lowest ? `${formatNumber(lowest.total, 3)} ${unit}` : "" },
    { label: "Range", value: `${formatNumber(Math.min(...values), 3)} - ${formatNumber(Math.max(...values), 3)}`, sub: unit },
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

function renderBenchmark(rows, med) {
  elements.benchmarkCount.textContent = `${rows.length} farmer-years`;
  if (!rows.length) {
    elements.benchmarkChart.innerHTML = `<p class="empty">No benchmark values match these filters.</p>`;
    return;
  }
  const max = Math.max(...rows.map((row) => row.total), med, 1);
  const medianPct = percent(med, max);
  elements.benchmarkChart.innerHTML = rows
    .map((row) => {
      const pct = percent(row.total, max);
      const diff = med ? ((row.total - med) / med) * 100 : 0;
      const diffClass = diff >= 0 ? "above" : "below";
      return `
        <div class="benchmark-row" title="${row.dmu_id}: ${formatNumber(row.total, 3)} ${row.unit}; ${formatSigned(diff, 1)}% versus median">
          <div class="benchmark-label">
            <strong>${row.dmu_id}</strong>
            <span>${row.main_source}</span>
          </div>
          <div class="benchmark-track">
            <span class="benchmark-median" style="left:${medianPct}%"></span>
            <span class="benchmark-fill ${diffClass}" style="width:${pct}%"></span>
            <span class="benchmark-value">${formatNumber(row.total, 3)} ${row.unit} (${formatSigned(diff, 1)}%)</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDetail(rows, med) {
  elements.detailCount.textContent = `${rows.length} rows`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No benchmark values match these filters.</p>`;
    return;
  }
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>DMU</th>
          <th>Farmer</th>
          <th>Year</th>
          <th>Total impact</th>
          <th>Regional median</th>
          <th>Difference</th>
          <th>Main source</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const diff = med ? ((row.total - med) / med) * 100 : 0;
            return `
              <tr>
                <td>${row.dmu_id}</td>
                <td>${row.farmer_id}</td>
                <td>${row.season}</td>
                <td>${formatNumber(row.total, 4)} ${row.unit}</td>
                <td>${formatNumber(med, 4)} ${row.unit}</td>
                <td>${formatSigned(diff, 1)}%</td>
                <td>${row.main_source}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function fillSelect(select, values, label) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = `All ${label.toLowerCase()}s`;
  select.appendChild(all);
  values.forEach((value) => {
    if (value === undefined || value === null || value === "") return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
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

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percent(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
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

function formatSigned(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  const formatted = formatNumber(value, digits);
  return value > 0 ? `+${formatted}` : formatted;
}
