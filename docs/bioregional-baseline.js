import { loadCsv, toNumber } from "./pivot-data.js";

const SOURCES = [
  { key: "crop_protection", label: "Crop protection", totalColumn: "crop_protection_total_impact" },
  { key: "sowing", label: "Sowing", totalColumn: "sowing_total_impact" },
  { key: "fertilisation", label: "Fertilisation", totalColumn: "fertilisation_total_impact" },
  { key: "machines", label: "Machinery", totalColumn: "machines_total_impact" },
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
    farmer: "none",
    radarCategory: "",
    sankeyYear: "",
  },
};

const elements = {
  season: document.getElementById("season-filter"),
  basis: document.getElementById("basis-filter"),
  score: document.getElementById("score-filter"),
  limit: document.getElementById("limit-filter"),
  farmer: document.getElementById("farmer-filter"),
  radarCategory: document.getElementById("radar-category-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  yearCount: document.getElementById("year-count"),
  yearChart: document.getElementById("year-chart"),
  radarCount: document.getElementById("radar-count"),
  radarChart: document.getElementById("radar-chart"),
  sankeyYear: document.getElementById("sankey-year-filter"),
  sankeyCount: document.getElementById("sankey-count"),
  sankeyCategoryTitle: document.getElementById("sankey-category-title"),
  sankeyChart: document.getElementById("sankey-chart"),
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
        detailContributions: extractDetailContributions(source, row),
      }));
    })
  ).then((groups) => groups.flat());
}

function extractDetailContributions(source, row) {
  if (source.key === "fertilisation") {
    return [
      detailContribution("fertilisation_n", "Nitrogen fertiliser", "fertilisation", "Fertilisation", row.n_impact),
      detailContribution("fertilisation_p", "Phosphorus fertiliser", "fertilisation", "Fertilisation", row.p_impact),
      detailContribution("fertilisation_k", "Potassium fertiliser", "fertilisation", "Fertilisation", row.k_impact),
    ];
  }
  if (source.key === "crop_protection") {
    return [
      detailContribution("crop_herbicide", "Herbicide", "crop_protection", "Crop protection", row.herbicide_impact),
      detailContribution("crop_fungicide", "Fungicide", "crop_protection", "Crop protection", row.fungicide_impact),
      detailContribution("crop_insecticide", "Insecticide", "crop_protection", "Crop protection", row.pesticide_impact),
    ];
  }
  if (source.key === "machines") {
    return Object.keys(row)
      .filter((key) => key.endsWith("_impact") && key !== "machines_total_impact")
      .map((key) => {
        const machineKey = key.replace(/_impact$/, "");
        return detailContribution(
          `machine_${machineKey}`,
          titleCase(machineKey),
          "machines",
          "Machinery",
          row[key]
        );
      });
  }
  if (source.key === "sowing") {
    return [detailContribution("sowing_seed", "Seeds", "sowing", "Sowing", row.sowing_total_impact)];
  }
  if (source.key === "field_emissions") {
    const identity = sourceIdentity(source, row);
    return [
      detailContribution(
        `field_${row.component || row.gas || "other"}`,
        titleCase(row.component || row.gas || "Other field emission"),
        identity.source,
        identity.sourceLabel,
        row.field_emissions_impact
      ),
    ];
  }
  return [detailContribution(source.key, source.label, source.key, source.label, row[source.totalColumn])];
}

function detailContribution(detailKey, detailLabel, inputKey, inputLabel, value) {
  return {
    detailKey,
    detailLabel,
    inputKey,
    inputLabel,
    value: toNumber(value) || 0,
  };
}

function sourceIdentity(source, row) {
  if (source.key !== "field_emissions") {
    return { source: source.key, sourceLabel: source.label };
  }
  const gas = String(row.gas || "").toLowerCase();
  if (gas === "ch4") return { source: "field_emissions_ch4", sourceLabel: "Methane (CH4)" };
  if (gas === "n2o" || gas === "co2") return { source: "field_emissions_nitrogen", sourceLabel: "Nitrogen field emissions" };
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
  hydrateFarmerFilter();
  hydrateSankeyYearFilter();
  hydrateRadarCategoryFilter();
}

function hydrateFarmerFilter() {
  const farmers = uniqueValues(state.dmus, "farmer_id").sort((a, b) => naturalCompare(a, b));
  elements.farmer.innerHTML = "";
  const none = document.createElement("option");
  none.value = "none";
  none.textContent = "No farmer highlight";
  elements.farmer.appendChild(none);
  farmers.forEach((farmer) => {
    const option = document.createElement("option");
    option.value = farmer;
    option.textContent = farmer;
    elements.farmer.appendChild(option);
  });
  if (!farmers.includes(state.filters.farmer)) state.filters.farmer = "none";
  elements.farmer.value = state.filters.farmer;
}

function hydrateSankeyYearFilter() {
  const years = uniqueValues(state.dmus, "season").sort((a, b) => `${b}`.localeCompare(`${a}`));
  elements.sankeyYear.innerHTML = "";
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    elements.sankeyYear.appendChild(option);
  });
  const preferred = years.includes(state.filters.sankeyYear)
    ? state.filters.sankeyYear
    : state.filters.season !== "all" && years.includes(state.filters.season)
      ? state.filters.season
      : years[0] || "";
  state.filters.sankeyYear = preferred;
  elements.sankeyYear.value = preferred;
}

function hydrateRadarCategoryFilter(categories = null) {
  const current = state.filters.radarCategory;
  const sourceRows = filteredRows();
  const values = categories && categories.length
    ? categories
    : uniqueValues(sourceRows, "impact_category").sort((a, b) => a.localeCompare(b));
  elements.radarCategory.innerHTML = "";
  values.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.radarCategory.appendChild(option);
  });
  const preferred = values.includes(current)
    ? current
    : values.includes("Climate change")
      ? "Climate change"
      : values[0] || "";
  state.filters.radarCategory = preferred;
  elements.radarCategory.value = preferred;
}

function attachEvents() {
  elements.season.addEventListener("change", () => {
    state.filters.season = elements.season.value;
    if (state.filters.season !== "all") {
      state.filters.sankeyYear = state.filters.season;
      elements.sankeyYear.value = state.filters.sankeyYear;
    }
    render();
  });
  elements.basis.addEventListener("change", () => {
    state.filters.basis = elements.basis.value;
    hydrateRadarCategoryFilter();
    render();
  });
  elements.score.addEventListener("change", () => {
    state.filters.score = elements.score.value;
    hydrateRadarCategoryFilter();
    render();
  });
  elements.limit.addEventListener("change", () => {
    state.filters.limit = elements.limit.value;
    render();
  });
  elements.farmer.addEventListener("change", () => {
    state.filters.farmer = elements.farmer.value;
    render();
  });
  elements.radarCategory.addEventListener("change", () => {
    state.filters.radarCategory = elements.radarCategory.value;
    render();
  });
  elements.sankeyYear.addEventListener("change", () => {
    state.filters.sankeyYear = elements.sankeyYear.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, {
      season: "all",
      basis: "ha",
      score: "chara",
      limit: "12",
      farmer: "none",
      radarCategory: "",
      sankeyYear: "",
    });
    elements.season.value = "all";
    elements.basis.value = "ha";
    elements.score.value = "chara";
    elements.limit.value = "12";
    elements.farmer.value = "none";
    hydrateSankeyYearFilter();
    hydrateRadarCategoryFilter();
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
  hydrateRadarCategoryFilter(categories);
  const yearComparison = buildYearComparison(comparisonTotals, categories);
  const drivers = buildDrivers(rows, categories);
  const radar = buildRadar(comparisonFilteredRows(), categories);
  const sankey = buildSankey();
  renderActive(rows.length, dmus.length);
  renderStats(dmus, distributions);
  renderYearComparison(yearComparison);
  renderSankey(sankey);
  renderRadar(radar);
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
      farmer_id: row.farmer_id,
      season: row.season,
      category: row.impact_category,
      basis: row.basis,
      unit: row.impact_unit,
      value: 0,
    };
    current.value += row.value;
    if (!current.farmer_id && row.farmer_id) current.farmer_id = row.farmer_id;
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
      selectedValues: [],
    };
    current.values.push(row.value);
    if (state.filters.farmer !== "none" && row.farmer_id === state.filters.farmer) {
      current.selectedValues.push({ dmu_id: row.dmu_id, value: row.value });
    }
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
          farmerValue: item ? selectedFarmerValue(item.selectedValues) : null,
          farmerDmu: item ? selectedFarmerDmu(item.selectedValues) : "",
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

function buildSankey() {
  const year = state.filters.sankeyYear;
  const category = state.filters.radarCategory;
  const rows = state.rows.filter((row) => {
    if (row.score !== state.filters.score) return false;
    if (row.basis !== state.filters.basis) return false;
    if (`${row.season}` !== `${year}`) return false;
    if (row.impact_category !== category) return false;
    return true;
  });
  const detailMap = new Map();
  const inputMap = new Map();
  const farmerMap = new Map();
  const inputFarmerFlows = [];
  const unit = rows.find((row) => row.impact_unit)?.impact_unit || valueUnit();

  rows.forEach((row) => {
    const inputFarmerMap = new Map();
    (row.detailContributions || []).forEach((detail) => {
      const value = detail.value;
      if (!Number.isFinite(value) || value <= 0) return;
      const detailKey = `${detail.detailKey}|${detail.inputKey}`;
      const currentDetail = detailMap.get(detailKey) || {
        detailKey: detail.detailKey,
        detailLabel: detail.detailLabel,
        inputKey: detail.inputKey,
        inputLabel: detail.inputLabel,
        value: 0,
      };
      currentDetail.value += value;
      detailMap.set(detailKey, currentDetail);

      const currentInput = inputMap.get(detail.inputKey) || {
        inputKey: detail.inputKey,
        inputLabel: detail.inputLabel,
        value: 0,
      };
      currentInput.value += value;
      inputMap.set(detail.inputKey, currentInput);

      const farmer = farmerMap.get(row.dmu_id) || {
        dmu_id: row.dmu_id,
        farmer_id: row.farmer_id,
        label: row.dmu_id,
        value: 0,
        inputKey: "farmer",
      };
      farmer.value += value;
      if (!farmer.farmer_id && row.farmer_id) farmer.farmer_id = row.farmer_id;
      farmerMap.set(row.dmu_id, farmer);

      const inputFarmer = inputFarmerMap.get(detail.inputKey) || {
        inputKey: detail.inputKey,
        inputLabel: detail.inputLabel,
        dmu_id: row.dmu_id,
        farmer_id: row.farmer_id,
        value: 0,
      };
      inputFarmer.value += value;
      inputFarmerMap.set(detail.inputKey, inputFarmer);
    });
    inputFarmerFlows.push(...Array.from(inputFarmerMap.values()).filter((flow) => flow.value > 0));
  });

  const detailFlows = Array.from(detailMap.values())
    .filter((row) => row.value > 0)
    .sort((a, b) => {
      const inputSort = inputOrder(a.inputKey) - inputOrder(b.inputKey);
      return inputSort || b.value - a.value;
    });

  const inputFlows = Array.from(inputMap.values())
    .filter((row) => row.value > 0)
    .sort((a, b) => inputOrder(a.inputKey) - inputOrder(b.inputKey));
  const farmerFlows = Array.from(farmerMap.values())
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = sum(farmerFlows.map((row) => row.value));
  detailFlows.forEach((row) => {
    row.share = total ? (row.value / total) * 100 : 0;
  });
  inputFlows.forEach((row) => {
    row.share = total ? (row.value / total) * 100 : 0;
  });
  farmerFlows.forEach((row) => {
    row.share = total ? (row.value / total) * 100 : 0;
  });

  return {
    year,
    category,
    basis: state.filters.basis,
    score: state.filters.score,
    unit,
    detailFlows,
    inputFlows,
    inputFarmerFlows,
    farmerFlows,
    total,
    dmuCount: farmerFlows.length,
  };
}

function renderSankey(sankey) {
  elements.sankeyCategoryTitle.textContent = sankey.category || "Select an impact category";
  elements.sankeyCount.textContent = sankey.category
    ? `${sankey.year} | ${sankey.basis === "ha" ? "per hectare" : "per tonne"}`
    : "Select category";
  if (!sankey.detailFlows.length || !sankey.inputFlows.length || !sankey.farmerFlows.length) {
    elements.sankeyChart.innerHTML = `<p class="empty">No positive Sankey flows match this year, basis, impact type, and category.</p>`;
    return;
  }

  const detailNodes = sankey.detailFlows.map((flow) => ({
    id: `detail:${flow.detailKey}`,
    label: flow.detailLabel,
    value: flow.value,
    share: flow.share,
    inputKey: flow.inputKey,
  }));
  const inputNodes = sankey.inputFlows.map((flow) => ({
    id: `input:${flow.inputKey}`,
    label: flow.inputLabel,
    value: flow.value,
    share: flow.share,
    inputKey: flow.inputKey,
  }));
  const farmerNodes = sankey.farmerFlows.map((flow) => ({
    id: `farmer:${flow.dmu_id}`,
    label: flow.label,
    value: flow.value,
    share: flow.share,
    farmer_id: flow.farmer_id,
    inputKey: "farmer",
  }));
  const height = Math.max(430, detailNodes.length * 34 + 90, inputNodes.length * 54 + 120, farmerNodes.length * 42 + 90);
  const width = 1260;
  const detailLayout = layoutSankeyNodes(detailNodes, 24, height - 54);
  const inputLayout = layoutSankeyNodes(inputNodes, 54, height - 84);
  const farmerLayout = layoutSankeyNodes(farmerNodes, 44, height - 74);
  const detailById = new Map(detailLayout.map((node) => [node.id, node]));
  const inputById = new Map(inputLayout.map((node) => [node.id, node]));
  const farmerById = new Map(farmerLayout.map((node) => [node.id, node]));
  const maxValue = Math.max(
    ...sankey.detailFlows.map((flow) => flow.value),
    ...sankey.inputFarmerFlows.map((flow) => flow.value),
    1
  );

  const detailLinks = sankey.detailFlows.map((flow) => {
    const source = detailById.get(`detail:${flow.detailKey}`);
    const target = inputById.get(`input:${flow.inputKey}`);
    return renderSankeyLink(source, target, flow.value, maxValue, sourceColor(flow.inputKey), sankey.unit);
  });
  const inputLinks = sankey.inputFarmerFlows.map((flow) => {
    const source = inputById.get(`input:${flow.inputKey}`);
    const target = farmerById.get(`farmer:${flow.dmu_id}`);
    const selected = state.filters.farmer !== "none" && flow.farmer_id === state.filters.farmer;
    return renderSankeyLink(source, target, flow.value, maxValue, sourceColor(flow.inputKey), sankey.unit, selected);
  });

  elements.sankeyChart.innerHTML = `
    <div class="sankey-scroll">
      <svg class="sankey-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sankey diagram for ${escapeHtml(sankey.category)} in ${escapeHtml(sankey.year)}">
        <g class="sankey-column-labels">
          <text x="24" y="20">Detailed input type</text>
          <text x="505" y="20">Input type</text>
          <text x="970" y="20">Farmer-year</text>
        </g>
        <g class="sankey-links">
          ${detailLinks.join("")}
          ${inputLinks.join("")}
        </g>
        <g class="sankey-nodes">
          ${detailLayout.map((node) => renderSankeyNode(node)).join("")}
          ${inputLayout.map((node) => renderSankeyNode(node)).join("")}
          ${farmerLayout.map((node) => renderSankeyNode(node)).join("")}
        </g>
      </svg>
    </div>
    <div class="sankey-summary">
      <strong>${formatNumber(sankey.total, 3)} ${escapeHtml(sankey.unit)}</strong>
      <span>Sum across ${formatNumber(sankey.dmuCount, 0)} farmer-years in ${escapeHtml(sankey.year)} for ${escapeHtml(sankey.category)} (${sankey.basis === "ha" ? "per hectare" : "per tonne"}). Node percentages show each detailed input, input type, or farmer-year share of this sum.</span>
    </div>
  `;
}

function layoutSankeyNodes(nodes, top, availableHeight) {
  const gap = nodes.length > 12 ? 8 : 14;
  const nodeHeight = Math.max(20, Math.min(42, (availableHeight - gap * Math.max(0, nodes.length - 1)) / Math.max(1, nodes.length)));
  return nodes.map((node, index) => ({
    ...node,
    x: sankeyNodeX(node.id),
    y: top + index * (nodeHeight + gap),
    width: node.id.startsWith("farmer:") ? 220 : node.id.startsWith("input:") ? 210 : 220,
    height: nodeHeight,
  }));
}

function sankeyNodeX(id) {
  if (id.startsWith("detail:")) return 24;
  if (id.startsWith("farmer:")) return 970;
  if (id.startsWith("impact:")) return 970;
  return 505;
}

function renderSankeyLink(source, target, value, maxValue, color, unit, selected = false) {
  if (!source || !target) return "";
  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x;
  const targetY = target.y + target.height / 2;
  const mid = (sourceX + targetX) / 2;
  const width = Math.max(2, Math.min(34, 2 + (value / maxValue) * 32));
  return `
    <path
      class="sankey-link${selected ? " selected" : ""}"
      d="M ${sourceX} ${sourceY} C ${mid} ${sourceY}, ${mid} ${targetY}, ${targetX} ${targetY}"
      stroke="${color}"
      stroke-width="${width}"
    ></path>
  `;
}

function renderSankeyNode(node) {
  const textY = node.y + node.height / 2 + 4;
  const share = Number.isFinite(node.share) ? `${formatNumber(node.share, 1)}%` : "";
  const labelWidth = share ? node.width - 58 : node.width;
  const labelMax = labelWidth > 175 ? 21 : 17;
  const selected = state.filters.farmer !== "none" && node.farmer_id === state.filters.farmer;
  const title = `${selected ? "Selected farmer-year - " : ""}${node.label}${share ? `: ${share}` : ""}`;
  return `
    <g class="sankey-svg-node${selected ? " selected" : ""}">
      <title>${escapeSvg(title)}</title>
      <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" fill="${sourceColor(node.inputKey)}"></rect>
      <text x="${node.x + 10}" y="${textY}">${escapeSvg(truncateLabel(node.label, labelMax))}</text>
      ${share ? `<text class="sankey-node-share" x="${node.x + node.width - 10}" y="${textY}">${escapeSvg(share)}</text>` : ""}
    </g>
  `;
}

function buildRadar() {
  return [];
}

function renderRadar(rows) {
  elements.radarCount.textContent = rows.length ? `${rows.length} radar values` : "Pending";
  elements.radarChart.innerHTML = `<p class="empty">Radar view pending. Use the Sankey diagram and source table for contribution detail.</p>`;
}

function renderActive(rowCount, dmuCount) {
  const parts = [];
  if (state.filters.season !== "all") parts.push(`Year ${state.filters.season}`);
  parts.push(state.filters.basis === "ha" ? "Per hectare" : "Per tonne");
  if (state.filters.farmer !== "none") parts.push(`Highlight ${state.filters.farmer}`);
  parts.push("Characterisation");
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
            ${state.filters.farmer !== "none" ? `<span><i class="basis-farmer-key"></i>${escapeHtml(state.filters.farmer)}</span>` : ""}
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
            const farmerValue = item?.farmerValue;
            const barHeight = Math.max(2, percent(value, rowMax));
            const low = percent(q1, rowMax);
            const high = percent(q3, rowMax);
            const errorTop = Math.max(0, 100 - high);
            const errorHeight = Math.max(1, high - low);
            const label = item?.basis === "ha" ? "ha" : "tonne";
            const farmerTop = 100 - percent(farmerValue, rowMax);
            const farmerTitle = `${item?.farmerDmu || state.filters.farmer} ${label}: ${formatNumber(farmerValue, 3)} ${item?.unit || ""}`;
            return `
              <div class="basis-bar-wrap" title="${year} ${label}: median ${formatNumber(value, 3)} ${item?.unit || ""}; Q1 ${formatNumber(q1, 3)}; Q3 ${formatNumber(q3, 3)}; mean ${formatNumber(item?.mean, 3)}; min ${formatNumber(item?.min, 3)}; max ${formatNumber(item?.max, 3)}">
                <span class="basis-error" style="top:${errorTop}%; height:${errorHeight}%"></span>
                <span class="basis-bar ${label}" style="height:${barHeight}%"></span>
                ${Number.isFinite(farmerValue) ? `<span class="basis-farmer-dot" style="top:${farmerTop}%" title="${escapeHtml(farmerTitle)}" aria-label="${escapeHtml(farmerTitle)}"></span>` : ""}
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

function selectedFarmerValue(values) {
  const selected = values.find((entry) => Number.isFinite(entry.value));
  return selected ? selected.value : null;
}

function selectedFarmerDmu(values) {
  const selected = values.find((entry) => Number.isFinite(entry.value));
  return selected ? selected.dmu_id : "";
}

function uniqueValues(rows, key) {
  return Array.from(
    rows.reduce((set, row) => {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") set.add(row[key]);
      return set;
    }, new Set())
  );
}

function naturalCompare(a, b) {
  return `${a}`.localeCompare(`${b}`, undefined, { numeric: true, sensitivity: "base" });
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
  return state.filters.basis === "ha" ? "impact/ha" : "impact/t";
}

function inputOrder(inputKey) {
  const order = [
    "fertilisation",
    "crop_protection",
    "machines",
    "sowing",
    "field_emissions_ch4",
    "field_emissions_nitrogen",
    "field_emissions_other",
  ];
  const index = order.indexOf(inputKey);
  return index === -1 ? order.length : index;
}

function sourceColor(inputKey) {
  const colors = {
    fertilisation: "#1d7c72",
    crop_protection: "#d9703e",
    machines: "#637d8a",
    sowing: "#4f8f4a",
    field_emissions_ch4: "#8a4f7d",
    field_emissions_nitrogen: "#c59b1e",
    field_emissions_other: "#6b7280",
    impact: "#152229",
    farmer: "#152229",
  };
  return colors[inputKey] || "#6b7280";
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bN2O\b/i, "N2O")
    .replace(/\bCO2\b/i, "CO2")
    .replace(/\bCH4\b/i, "CH4");
}

function categoryLabel(row) {
  const units = uniqueValues(row.values, "unit").filter(Boolean);
  if (!units.length) return row.category;
  return `${row.category} (${units.join("; ")})`;
}

function truncateLabel(value, maxLength) {
  const label = String(value || "");
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(0, maxLength - 1))}...`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeSvg(value) {
  return escapeHtml(value);
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
    .flatMap((value) => [value.median, value.q3, value.farmerValue])
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
