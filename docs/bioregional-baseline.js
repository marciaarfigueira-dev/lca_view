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
  dmus: [],
  filters: {
    season: "all",
    basis: "ha",
    score: "chara",
    limit: "12",
  },
};

const elements = {
  season: document.getElementById("season-filter"),
  basis: document.getElementById("basis-filter"),
  score: document.getElementById("score-filter"),
  limit: document.getElementById("limit-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  yearCount: document.getElementById("year-count"),
  yearChart: document.getElementById("year-chart"),
  driverCount: document.getElementById("driver-count"),
  driverTable: document.getElementById("driver-table"),
};

init();

async function init() {
  const [rows, dmus] = await Promise.all([
    Promise.all(SOURCES.flatMap((source) => loadSource(source))).then((groups) => groups.flat()),
    loadDmus(),
  ]);
  state.rows = rows;
  state.dmus = dmus;
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
        ...sourceIdentity(source, row),
        dmu_id: row.dmu_id || "",
        farmer_id: row.farmer_id || "",
        season: row.year || "",
        basis: row.basis || variant.basis,
        score: variant.score,
        impact_category: row.impact_category || "",
        impact_unit: row.impact_unit || "",
        value: toNumber(row[source.totalColumn]) || 0,
      }));
    })
  ).then((groups) => groups.flat());
}

function sourceIdentity(source, row) {
  if (source.key !== "field_emissions") {
    return { source: source.key, sourceLabel: source.label };
  }
  const gas = String(row.gas || "").toLowerCase();
  if (gas === "ch4") return { source: "field_emissions_ch4", sourceLabel: "Methane (CH4)" };
  if (gas === "n2o") return { source: "field_emissions_n2o", sourceLabel: "N2O emissions" };
  if (gas === "co2") return { source: "field_emissions_co2", sourceLabel: "Urea CO2" };
  return { source: "field_emissions_other", sourceLabel: "Other field emissions" };
}

async function loadDmus() {
  const rows = await loadCsv("./data/clean_lca/crop_protection/inventory/crop_protection_inventory_by_dmu.csv");
  return rows.map((row) => {
    const area = toNumber(row.area_ha);
    const production = toNumber(row.production_t);
    return {
      dmu_id: row.dmu_id || "",
      farmer_id: row.farmer_id || "",
      season: row.year || "",
      area_ha: area,
      production_t: production,
      yield_kg_ha: area && production ? (production / area) * 1000 : null,
    };
  });
}

function hydrateFilters() {
  fillSelect(elements.season, uniqueValues(state.dmus, "season").sort((a, b) => `${b}`.localeCompare(`${a}`)), "Year");
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
  elements.score.addEventListener("change", () => {
    state.filters.score = elements.score.value;
    render();
  });
  elements.limit.addEventListener("change", () => {
    state.filters.limit = elements.limit.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, {
      season: "all",
      basis: "ha",
      score: "chara",
      limit: "12",
    });
    elements.season.value = "all";
    elements.basis.value = "ha";
    elements.score.value = "chara";
    elements.limit.value = "12";
    render();
  });
}

function render() {
  const rows = filteredRows();
  const comparisonRows = comparisonFilteredRows();
  const dmus = filteredDmus();
  const dmuCategoryTotals = buildDmuCategoryTotals(rows);
  const distributions = buildDistributions(dmuCategoryTotals);
  const comparisonTotals = buildDmuCategoryBasisTotals(comparisonRows);
  const comparisonDistributions = buildDistributions(comparisonTotals);
  const categories = distributions.length
    ? distributions.map((row) => row.category)
    : comparisonDistributions.map((row) => row.category);
  const yearComparison = buildYearComparison(comparisonTotals, categories);
  const drivers = buildDrivers(rows, categories);
  renderActive(rows.length, dmus.length);
  renderStats(dmus, distributions);
  renderYearComparison(yearComparison);
  renderDrivers(drivers);
}

function filteredRows() {
  return state.rows.filter((row) => {
    if (row.score !== state.filters.score) return false;
    if (row.basis !== state.filters.basis) return false;
    if (state.filters.season !== "all" && `${row.season}` !== state.filters.season) return false;
    return row.impact_category !== "";
  });
}

function comparisonFilteredRows() {
  return state.rows.filter((row) => {
    if (row.score !== state.filters.score) return false;
    return row.impact_category !== "";
  });
}

function filteredDmus() {
  return state.dmus.filter((row) => state.filters.season === "all" || `${row.season}` === state.filters.season);
}

function buildDmuCategoryTotals(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.dmu_id}|${row.impact_category}`;
    const current = map.get(key) || {
      dmu_id: row.dmu_id,
      category: row.impact_category,
      unit: row.impact_unit,
      value: 0,
    };
    current.value += row.value;
    if (!current.unit && row.impact_unit) current.unit = row.impact_unit;
    map.set(key, current);
  });
  return Array.from(map.values());
}

function buildDmuCategoryBasisTotals(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.dmu_id}|${row.impact_category}|${row.basis}`;
    const current = map.get(key) || {
      dmu_id: row.dmu_id,
      season: row.season,
      category: row.impact_category,
      basis: row.basis,
      unit: row.impact_unit,
      value: 0,
    };
    current.value += row.value;
    if (!current.unit && row.impact_unit) current.unit = row.impact_unit;
    map.set(key, current);
  });
  return Array.from(map.values());
}

function buildDistributions(rows) {
  const byCategory = groupBy(rows, "category");
  let distributions = Array.from(byCategory.entries()).map(([category, categoryRows]) => {
    const values = categoryRows.map((row) => row.value).filter((value) => Number.isFinite(value));
    return {
      category,
      unit: categoryRows.find((row) => row.unit)?.unit || valueUnit(),
      n: values.length,
      mean: mean(values),
      median: quantile(values, 0.5),
      q1: quantile(values, 0.25),
      q3: quantile(values, 0.75),
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });
  distributions = distributions
    .filter((row) => row.n > 0 && Number.isFinite(row.median))
    .sort((a, b) => Math.abs(b.median) - Math.abs(a.median));
  if (state.filters.limit === "all") return distributions;
  return distributions.slice(0, Number(state.filters.limit));
}

function buildYearComparison(rows, categories) {
  const allowed = new Set(categories);
  const byCategoryYearBasis = new Map();
  rows.forEach((row) => {
    if (!allowed.has(row.category)) return;
    const year = row.season || String(row.dmu_id).match(/(\d{4})$/)?.[1] || "";
    if (!year) return;
    const key = `${row.category}|${year}|${row.basis}`;
    const current = byCategoryYearBasis.get(key) || {
      category: row.category,
      year,
      basis: row.basis,
      unit: row.unit,
      values: [],
    };
    current.values.push(row.value);
    byCategoryYearBasis.set(key, current);
  });

  const years = uniqueValues(Array.from(byCategoryYearBasis.values()), "year").sort();
  return categories.map((category) => {
    const values = years.flatMap((year) =>
      ["ha", "tonne"].map((basis) => {
        const item = byCategoryYearBasis.get(`${category}|${year}|${basis}`);
        return {
          year,
          basis,
          unit: item?.unit || (basis === "ha" ? "per ha" : "per tonne"),
          mean: item ? mean(item.values) : null,
          median: item ? quantile(item.values, 0.5) : null,
          min: item ? Math.min(...item.values) : null,
          max: item ? Math.max(...item.values) : null,
          q1: item ? quantile(item.values, 0.25) : null,
          q3: item ? quantile(item.values, 0.75) : null,
          n: item ? item.values.length : 0,
        };
      })
    );
    return { category, years, values };
  });
}

function buildDrivers(rows, categories) {
  const allowed = new Set(categories);
  const byCategorySource = new Map();
  rows.forEach((row) => {
    if (!allowed.has(row.impact_category)) return;
    const key = `${row.impact_category}|${row.source}`;
    const current = byCategorySource.get(key) || {
      category: row.impact_category,
      source: row.sourceLabel,
      unit: row.impact_unit || valueUnit(),
      valuesByDmu: new Map(),
    };
    current.valuesByDmu.set(row.dmu_id, (current.valuesByDmu.get(row.dmu_id) || 0) + row.value);
    byCategorySource.set(key, current);
  });

  const byCategory = groupBy(Array.from(byCategorySource.values()), "category");
  return Array.from(byCategory.entries()).flatMap(([category, sourceRows]) => {
    const sourceMeans = sourceRows.map((row) => {
      const values = Array.from(row.valuesByDmu.values());
      return {
        category,
        source: row.source,
        unit: row.unit,
        mean: mean(values),
      };
    });
    const total = sourceMeans.reduce((sum, row) => sum + row.mean, 0);
    return sourceMeans
      .filter((row) => row.mean !== 0)
      .map((row) => ({ ...row, share: total ? (row.mean / total) * 100 : 0 }))
      .sort((a, b) => b.mean - a.mean);
  });
}

function renderActive(rowCount, dmuCount) {
  const parts = [];
  if (state.filters.season !== "all") parts.push(`Year ${state.filters.season}`);
  parts.push(state.filters.basis === "ha" ? "Per hectare" : "Per tonne");
  parts.push(state.filters.score === "single" ? "Single score" : "Characterisation");
  elements.active.textContent = `${parts.join(" • ")} - ${dmuCount} farmer-years, ${rowCount} source rows`;
}

function renderStats(dmus, distributions) {
  const yields = dmus.map((row) => row.yield_kg_ha).filter((value) => Number.isFinite(value));
  const areas = dmus.map((row) => row.area_ha).filter((value) => Number.isFinite(value));
  const productions = dmus.map((row) => row.production_t).filter((value) => Number.isFinite(value));
  const stats = [
    { label: "Farmer-years", value: formatNumber(dmus.length, 0) },
    { label: "Impact categories", value: formatNumber(distributions.length, 0) },
    { label: "Median yield", value: `${formatNumber(quantile(yields, 0.5), 0)} kg/ha` },
    { label: "Area represented", value: `${formatNumber(sum(areas), 1)} ha` },
    { label: "Production represented", value: `${formatNumber(sum(productions), 1)} t` },
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

function renderYearComparison(rows) {
  elements.yearCount.textContent = `${rows.length} categories`;
  if (!rows.length) {
    elements.yearChart.innerHTML = `<p class="empty">No year values match these filters.</p>`;
    return;
  }
  elements.yearChart.innerHTML = rows
    .map((row) => {
      const rowMax = chartMax(row.values);
      return `
        <div class="year-card">
          <div class="year-card-header">
            <h3>${categoryLabel(row)}</h3>
            <span>Median with Q1-Q3 spread</span>
          </div>
          <div class="basis-legend">
            <span><i class="basis-swatch ha"></i>ha</span>
            <span><i class="basis-swatch tonne"></i>tonne</span>
          </div>
          <div class="basis-plot">
            <div class="basis-scale" aria-hidden="true">
              ${scaleTicks(rowMax).map((tick) => `<span>${formatAxisNumber(tick)}</span>`).join("")}
            </div>
            <div class="basis-chart">
              ${row.years
                .map((year) => renderYearGroup(row, year, rowMax))
                .join("")}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderYearGroup(row, year, rowMax) {
  const items = ["ha", "tonne"].map((basis) => row.values.find((value) => value.year === year && value.basis === basis));
  return `
    <div class="basis-year-group">
      <div class="basis-bars">
        ${items
          .map((item) => {
            const value = item?.median || 0;
            const q1 = item?.q1 || 0;
            const q3 = item?.q3 || 0;
            const barHeight = Math.max(2, percent(value, rowMax));
            const low = percent(q1, rowMax);
            const high = percent(q3, rowMax);
            const errorTop = Math.max(0, 100 - high);
            const errorHeight = Math.max(1, high - low);
            const label = item?.basis === "ha" ? "ha" : "tonne";
            return `
              <div class="basis-bar-wrap" title="${year} ${label}: median ${formatNumber(value, 3)} ${item?.unit || ""}; Q1 ${formatNumber(q1, 3)}; Q3 ${formatNumber(q3, 3)}; mean ${formatNumber(item?.mean, 3)}; min ${formatNumber(item?.min, 3)}; max ${formatNumber(item?.max, 3)}">
                <span class="basis-error" style="top:${errorTop}%; height:${errorHeight}%"></span>
                <span class="basis-bar ${label}" style="height:${barHeight}%"></span>
              </div>
            `;
          })
          .join("")}
      </div>
      <div class="basis-year-label">${year}</div>
    </div>
  `;
}


function renderDrivers(rows) {
  elements.driverCount.textContent = `${rows.length} source values`;
  if (!rows.length) {
    elements.driverTable.innerHTML = `<p class="empty">No source contributions match these filters.</p>`;
    return;
  }
  elements.driverTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Impact category</th>
          <th>Input source</th>
          <th>Mean contribution</th>
          <th>Share of mean category impact</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.category}</td>
                <td>${row.source}</td>
                <td>${formatNumber(row.mean, 3)} ${row.unit}</td>
                <td>${formatNumber(row.share, 1)}%</td>
              </tr>
            `
          )
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

function groupBy(rows, key) {
  return rows.reduce((map, row) => {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
    return map;
  }, new Map());
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  return values.length ? sum(values) / values.length : null;
}

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function valueUnit() {
  if (state.filters.score === "single") return state.filters.basis === "ha" ? "Pt/ha" : "Pt/t";
  return state.filters.basis === "ha" ? "impact/ha" : "impact/t";
}

function categoryLabel(row) {
  const units = uniqueValues(row.values, "unit").filter(Boolean);
  if (!units.length) return row.category;
  return `${row.category} (${units.join("; ")})`;
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

function formatAxisNumber(value) {
  if (value == null || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 100000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (abs < 0.01) return value.toExponential(1);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: abs < 1 ? 3 : 1,
  }).format(value);
}

function percent(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max === 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function chartMax(values) {
  const candidates = values
    .flatMap((value) => [value.median, value.q3])
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!candidates.length) return 1;
  return tightMax(Math.max(...candidates));
}

function scaleTicks(max) {
  return [max, max * 0.75, max * 0.5, max * 0.25, 0];
}

function tightMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const padded = value * 1.08;
  const exponent = Math.floor(Math.log10(padded));
  const step = 10 ** (exponent - 1);
  return Math.ceil(padded / step) * step;
}
