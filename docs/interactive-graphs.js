import { loadCsv, toNumber } from "./pivot-data.js";

const SOURCES = [
  { key: "crop_protection", label: "Crop protection", color: "#0ea5e9", totalColumn: "crop_protection_total_impact" },
  { key: "sowing", label: "Sowing", color: "#22c55e", totalColumn: "sowing_total_impact" },
  { key: "fertilisation", label: "Fertilisation", color: "#f59e0b", totalColumn: "fertilisation_total_impact" },
  { key: "machines", label: "Machinery", color: "#6366f1", totalColumn: "machines_total_impact" },
  { key: "field_emissions", label: "Field emissions", color: "#be123c", totalColumn: "field_emissions_impact" },
];

const DISPLAY_SOURCES = [
  ...SOURCES.filter((source) => source.key !== "field_emissions"),
  { key: "field_emissions_ch4", label: "Methane (CH4)", color: "#be123c" },
  { key: "field_emissions_nitrogen", label: "Nitrogen field emissions", color: "#db2777" },
];

const SCORE_LABELS = {
  chara: "Characterisation",
  single_score: "Single score",
};

const state = {
  rows: [],
  dmuWeights: new Map(),
  filters: {
    season: "all",
    farmer: "all",
    basis: "ha",
    score: "chara",
    scale: "share",
    aggregation: "equal_mean",
    aggregationBeforeLock: "equal_mean",
    limit: "12",
  },
};

const elements = {
  season: document.getElementById("season-filter"),
  farmer: document.getElementById("farmer-filter"),
  basis: document.getElementById("basis-filter"),
  score: document.getElementById("score-filter"),
  scale: document.getElementById("scale-filter"),
  aggregation: document.getElementById("aggregation-filter"),
  aggregationNote: document.getElementById("aggregation-note"),
  limit: document.getElementById("limit-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  chartCount: document.getElementById("chart-count"),
  legend: document.getElementById("legend"),
  chart: document.getElementById("stacked-chart"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
};

init();

async function init() {
  const [rows, dmuWeights] = await Promise.all([
    Promise.all(SOURCES.flatMap((source) => loadSource(source))).then((groups) => groups.flat()),
    loadDmuWeights(),
  ]);
  state.dmuWeights = dmuWeights;
  state.rows = rows.map((row) => {
    const sourceWeights = row.weights || {};
    const fallbackWeights = state.dmuWeights.get(row.dmu_id) || {};
    return {
      ...row,
      area_ha: sourceWeights.area_ha ?? fallbackWeights.area_ha ?? null,
      production_t: sourceWeights.production_t ?? fallbackWeights.production_t ?? null,
    };
  });
  hydrateFilters();
  attachEvents();
  render();
}

async function loadSource(source) {
  const variants = [
    { score: "chara", folder: "characterisation", basis: "ha", suffix: "ha" },
    { score: "chara", folder: "characterisation", basis: "tonne", suffix: "tonne" },
    { score: "single_score", folder: "single_score", basis: "ha", suffix: "ha" },
    { score: "single_score", folder: "single_score", basis: "tonne", suffix: "tonne" },
  ];
  return Promise.all(
    variants.map(async (variant) => {
      const path = `./data/clean_lca/${source.key}/${variant.folder}/${source.key}_${variant.folder}_by_dmu_${variant.suffix}.csv`;
      const rows = await loadCsv(path);
      const weights = await loadSourceWeights(source.key);
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
        weights: weights.get(row.dmu_id || "") || {},
      }));
    })
  ).then((groups) => groups.flat());
}

function sourceIdentity(source, row) {
  if (source.key !== "field_emissions") {
    return { source: source.key, sourceLabel: source.label, color: source.color };
  }
  const gas = String(row.gas || "").toLowerCase();
  if (gas === "ch4") return { source: "field_emissions_ch4", sourceLabel: "Methane (CH4)", color: "#be123c" };
  if (gas === "n2o" || gas === "co2") return { source: "field_emissions_nitrogen", sourceLabel: "Nitrogen field emissions", color: "#db2777" };
  return { source: "field_emissions_other", sourceLabel: "Other field emissions", color: "#9f1239" };
}

async function loadDmuWeights() {
  const maps = await Promise.all(SOURCES.map((source) => loadSourceWeights(source.key)));
  const combined = new Map();
  maps.forEach((map) => {
    map.forEach((weights, dmuId) => {
      const current = combined.get(dmuId) || {};
      combined.set(dmuId, {
        area_ha: current.area_ha ?? weights.area_ha,
        production_t: current.production_t ?? weights.production_t,
      });
    });
  });
  return combined;
}

async function loadSourceWeights(sourceKey) {
  const path = `./data/clean_lca/${sourceKey}/inventory/${sourceKey}_inventory_by_dmu.csv`;
  const rows = await loadCsv(path);
  return rows.reduce((map, row) => {
    const area = toNumber(row.area_ha);
    const production = toNumber(row.production_t);
    const productivity = toNumber(row.productivity_t_ha);
    map.set(row.dmu_id || "", {
      area_ha: area,
      production_t: production ?? (area != null && productivity != null ? area * productivity : null),
    });
    return map;
  }, new Map());
}

function hydrateFilters() {
  fillSelect(elements.season, uniqueValues(state.rows, "season").sort((a, b) => `${b}`.localeCompare(`${a}`)), "Year");
  fillSelect(elements.farmer, uniqueValues(state.rows, "farmer_id").sort(), "Farmer");
}

function attachEvents() {
  elements.season.addEventListener("change", () => {
    state.filters.season = elements.season.value;
    syncAggregationForScope();
    render();
  });
  elements.farmer.addEventListener("change", () => {
    state.filters.farmer = elements.farmer.value;
    syncAggregationForScope();
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
  elements.scale.addEventListener("change", () => {
    state.filters.scale = elements.scale.value;
    render();
  });
  elements.aggregation.addEventListener("change", () => {
    state.filters.aggregation = elements.aggregation.value;
    render();
  });
  elements.limit.addEventListener("change", () => {
    state.filters.limit = elements.limit.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, {
      season: "all",
      farmer: "all",
      basis: "ha",
      score: "chara",
      scale: "share",
      aggregation: "equal_mean",
      aggregationBeforeLock: "equal_mean",
      limit: "12",
    });
    elements.season.value = "all";
    elements.farmer.value = "all";
    elements.basis.value = "ha";
    elements.score.value = "chara";
    elements.scale.value = "share";
    elements.aggregation.value = "equal_mean";
    elements.limit.value = "12";
    syncAggregationForScope();
    render();
  });
}

function render() {
  syncAggregationForScope();
  const rows = filteredRows();
  const categories = buildCategories(rows);
  renderActive(rows.length);
  renderStats(rows, categories);
  renderLegend();
  renderChart(categories);
  renderDetail(categories);
}

function syncAggregationForScope() {
  const singleFarmer = state.filters.farmer !== "all";
  const singleYear = state.filters.season !== "all";
  if (singleFarmer && singleYear) {
    if (!elements.aggregation.disabled) {
      state.filters.aggregationBeforeLock = state.filters.aggregation;
    }
    state.filters.aggregation = "selected_value";
    elements.aggregation.disabled = true;
    elements.aggregation.value = "selected_value";
    elements.aggregationNote.textContent = "Locked: one selected farmer-year.";
    return;
  }
  if (singleFarmer) {
    if (!elements.aggregation.disabled) {
      state.filters.aggregationBeforeLock = state.filters.aggregation;
    }
    state.filters.aggregation = "farmer_mean";
    elements.aggregation.disabled = true;
    elements.aggregation.value = "farmer_mean";
    elements.aggregationNote.textContent = "Locked: one farmer across selected years.";
    return;
  }
  if (state.filters.aggregation === "selected_value" || state.filters.aggregation === "farmer_mean") {
    state.filters.aggregation = state.filters.aggregationBeforeLock || "equal_mean";
  }
  elements.aggregation.disabled = false;
  elements.aggregation.value = state.filters.aggregation;
  elements.aggregationNote.textContent = "Available when multiple farmer-years are selected.";
}

function filteredRows() {
  return state.rows.filter((row) => {
    if (row.score !== state.filters.score) return false;
    if (row.basis !== state.filters.basis) return false;
    if (row.impact_category === "Total") return false;
    if (state.filters.season !== "all" && `${row.season}` !== state.filters.season) return false;
    if (state.filters.farmer !== "all" && row.farmer_id !== state.filters.farmer) return false;
    return true;
  });
}

function buildCategories(rows) {
  const byDmu = new Map();
  rows.forEach((row) => {
    const key = `${row.impact_category}|${row.source}|${row.dmu_id}`;
    const current = byDmu.get(key) || {
      category: row.impact_category,
      source: row.source,
      sourceLabel: row.sourceLabel,
      color: row.color,
      unit: row.impact_unit,
      value: 0,
    };
    current.value += row.value || 0;
    current.area_ha = row.area_ha;
    current.production_t = row.production_t;
    byDmu.set(key, current);
  });

  const byCategorySource = new Map();
  byDmu.forEach((row) => {
    const key = `${row.category}|${row.source}`;
    const current = byCategorySource.get(key) || {
      category: row.category,
      source: row.source,
      sourceLabel: row.sourceLabel,
      color: row.color,
      unit: row.unit,
      total: 0,
      weightTotal: 0,
      count: 0,
    };
    const aggregate = aggregateContribution(row);
    current.total += aggregate.numerator;
    current.weightTotal += aggregate.denominator;
    current.count += 1;
    byCategorySource.set(key, current);
  });

  const categoryMap = new Map();
  byCategorySource.forEach((row) => {
    const category = categoryMap.get(row.category) || {
      category: row.category,
      unit: row.unit,
      segments: [],
      total: 0,
    };
    const value = aggregateValue(row);
    if (value !== 0) {
      category.segments.push({ ...row, value });
      category.total += value;
    }
    categoryMap.set(row.category, category);
  });

  const sorted = Array.from(categoryMap.values())
    .filter((category) => category.total !== 0)
    .sort((a, b) => b.total - a.total);
  if (state.filters.limit === "all") return sorted;
  return sorted.slice(0, Number(state.filters.limit));
}

function renderActive(count) {
  const parts = [];
  if (state.filters.season !== "all") parts.push(`Year ${state.filters.season}`);
  if (state.filters.farmer !== "all") parts.push(`Farmer ${state.filters.farmer}`);
  parts.push(state.filters.basis === "ha" ? "Per hectare" : "Per tonne");
  parts.push(scoreLabel());
  parts.push(state.filters.scale === "share" ? "100% contribution" : "Absolute value");
  parts.push(aggregationLabel());
  elements.active.textContent = `${parts.join(" • ")} — ${count} source rows`;
}

function renderStats(rows, categories) {
  const dmus = uniqueValues(rows, "dmu_id").length;
  const stats = [
    { label: "Farmer-years", value: formatNumber(dmus, 0) },
    { label: "Categories", value: formatNumber(categories.length, 0) },
    { label: "Sources", value: formatNumber(uniqueValues(rows, "source").length, 0) },
    { label: "Aggregation", value: aggregationLabel() },
    { label: "Scale", value: state.filters.scale === "share" ? "100%" : valueUnit() },
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

function renderLegend() {
  elements.legend.innerHTML = DISPLAY_SOURCES.map(
    (source) => `
      <span class="legend-item">
        <span class="legend-swatch" style="background:${source.color}"></span>
        ${source.label}
      </span>
    `
  ).join("");
}

function renderChart(categories) {
  elements.chartCount.textContent = `${categories.length} categories`;
  if (!categories.length) {
    elements.chart.innerHTML = `<p class="empty">No graph values match these filters.</p>`;
    return;
  }
  const maxTotal = Math.max(...categories.map((category) => category.total), 1);
  elements.chart.innerHTML = `
    <div class="stacked-plot">
      ${categories
        .map((category) => {
          const stackHeight = state.filters.scale === "share" ? 100 : Math.max(2, (category.total / maxTotal) * 100);
          const unit = state.filters.scale === "share" ? "% of category" : displayUnit(category.unit);
          const valueLabel = state.filters.scale === "share" ? "100% of category" : `${formatNumber(category.total, 2)} ${unit}`;
          return `
            <div class="stacked-category">
              <div class="stacked-value">${valueLabel}</div>
              <div class="stacked-bar" style="height:${stackHeight}%">
                ${category.segments
                  .sort((a, b) => sourceOrder(a.source) - sourceOrder(b.source))
                  .map((segment) => {
                    const pct = category.total ? (segment.value / category.total) * 100 : 0;
                    const height = state.filters.scale === "share" ? pct : (segment.value / category.total) * 100;
                    return `<div class="stacked-segment" title="${segment.sourceLabel}: ${formatNumber(segment.value, 2)} ${displayUnit(category.unit)} (${formatNumber(pct, 1)}%)" style="height:${height}%; background:${segment.color}"></div>`;
                  })
                  .join("")}
              </div>
              <div class="stacked-label" title="${category.category}">${category.category}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDetail(categories) {
  const rows = categories.flatMap((category) =>
    category.segments.map((segment) => ({
      category: category.category,
      source: segment.sourceLabel,
      unit: displayUnit(category.unit),
      value: segment.value,
      share: category.total ? (segment.value / category.total) * 100 : 0,
    }))
  );
  elements.detailCount.textContent = `${rows.length} values`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No values to show.</p>`;
    return;
  }
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Impact category</th>
          <th>Input source</th>
          <th>Unit</th>
          <th>${state.filters.aggregation === "sum" ? "Total value" : "Mean value"}</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.category}</td>
                <td>${row.source}</td>
                <td>${row.unit}</td>
                <td>${formatNumber(row.value, 4)}</td>
                <td>${formatNumber(row.share, 1)}%</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function sourceOrder(key) {
  const index = DISPLAY_SOURCES.findIndex((source) => source.key === key);
  return index === -1 ? DISPLAY_SOURCES.length : index;
}

function aggregateContribution(row) {
  const value = row.value || 0;
  if (state.filters.aggregation === "equal_mean" || state.filters.aggregation === "selected_value" || state.filters.aggregation === "farmer_mean") {
    return { numerator: value, denominator: 1 };
  }
  if (state.filters.aggregation === "area_weighted") {
    const weight = row.area_ha || 0;
    return { numerator: value * weight, denominator: weight };
  }
  if (state.filters.aggregation === "production_weighted") {
    const weight = row.production_t || 0;
    return { numerator: value * weight, denominator: weight };
  }
  const weight = state.filters.basis === "ha" ? row.area_ha || 0 : row.production_t || 0;
  return { numerator: value * weight, denominator: 1 };
}

function aggregateValue(row) {
  if (state.filters.aggregation === "sum") return row.total;
  return row.weightTotal ? row.total / row.weightTotal : 0;
}

function aggregationLabel() {
  const labels = {
    equal_mean: "Equal-weight mean",
    area_weighted: "Area-weighted mean",
    production_weighted: "Production-weighted mean",
    sum: "Total burden",
    selected_value: "Selected farmer-year value",
    farmer_mean: "Farmer multi-year mean",
  };
  return labels[state.filters.aggregation] || state.filters.aggregation;
}

function scoreLabel() {
  return SCORE_LABELS[state.filters.score] || state.filters.score;
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

function valueUnit() {
  if (state.filters.aggregation === "sum") return "impact";
  if (state.filters.score === "single_score") return state.filters.basis === "ha" ? "Pt/ha" : "Pt/t";
  return state.filters.basis === "ha" ? "impact/ha" : "impact/t";
}

function displayUnit(unit) {
  const base = unit || (state.filters.score === "single_score" ? "Pt" : "impact");
  if (state.filters.aggregation === "sum") return base;
  return state.filters.basis === "ha" ? `${base}/ha` : `${base}/t`;
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
