import { loadCsv, toNumber } from "./pivot-data.js";

const FILES = [
  {
    score: "chara",
    scoreLabel: "Characterisation",
    basis: "ha",
    path: "./data/clean_lca/field_emissions/characterisation/field_emissions_characterisation_by_dmu_ha.csv",
  },
  {
    score: "chara",
    scoreLabel: "Characterisation",
    basis: "tonne",
    path: "./data/clean_lca/field_emissions/characterisation/field_emissions_characterisation_by_dmu_tonne.csv",
  },
];

const GAS_LABELS = {
  ch4: "Methane (CH4)",
  n2o: "Nitrous oxide (N2O)",
  co2: "Urea CO2",
};

const state = {
  data: [],
  filters: {
    season: "all",
    farmer: "all",
    basis: "ha",
    score: "chara",
    gas: "all",
    component: "all",
  },
};

const elements = {
  season: document.getElementById("season-filter"),
  farmer: document.getElementById("farmer-filter"),
  basis: document.getElementById("basis-filter"),
  score: document.getElementById("score-filter"),
  gas: document.getElementById("gas-filter"),
  component: document.getElementById("component-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  summaryTable: document.getElementById("summary-table"),
  summaryCount: document.getElementById("summary-count"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
};

init();

async function init() {
  const datasets = await Promise.all(
    FILES.map(async (file) => {
      const rows = await loadCsv(file.path);
      return rows.map((row) => normalizeRow(row, file));
    })
  );
  state.data = datasets.flat();
  hydrateFilters();
  attachEvents();
  render();
}

function normalizeRow(row, file) {
  return {
    ...row,
    dmu_id: row.dmu_id || "",
    farmer_id: row.farmer_id || "",
    season: row.year || "",
    basis: row.basis || file.basis,
    score: file.score,
    scoreLabel: file.scoreLabel,
    gas: row.gas || "",
    gasLabel: gasLabel(row.gas),
    component: row.component || "",
    componentLabel: componentLabel(row.component),
    impact_category: row.impact_category || "",
    impact_unit: row.impact_unit || "",
    impact: toNumber(row.field_emissions_impact),
  };
}

function hydrateFilters() {
  fillSelect(elements.season, uniqueValues(state.data, "season").sort((a, b) => b - a), "Year");
  fillSelect(elements.farmer, uniqueValues(state.data, "farmer_id").sort(), "Farmer");
  fillSelect(
    elements.gas,
    uniqueValues(state.data, "gas")
      .sort()
      .map((gas) => ({ value: gas, label: gasLabel(gas) })),
    "Source"
  );
  refreshComponentOptions();
}

function attachEvents() {
  elements.season.addEventListener("change", () => {
    state.filters.season = elements.season.value;
    refreshComponentOptions();
    render();
  });
  elements.farmer.addEventListener("change", () => {
    state.filters.farmer = elements.farmer.value;
    refreshComponentOptions();
    render();
  });
  elements.basis.addEventListener("change", () => {
    state.filters.basis = elements.basis.value;
    refreshComponentOptions();
    render();
  });
  elements.score.addEventListener("change", () => {
    state.filters.score = elements.score.value;
    refreshComponentOptions();
    render();
  });
  elements.gas.addEventListener("change", () => {
    state.filters.gas = elements.gas.value;
    refreshComponentOptions();
    render();
  });
  elements.component.addEventListener("change", () => {
    state.filters.component = elements.component.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, {
      season: "all",
      farmer: "all",
      basis: "ha",
      score: "chara",
      gas: "all",
      component: "all",
    });
    elements.season.value = "all";
    elements.farmer.value = "all";
    elements.basis.value = "ha";
    elements.score.value = "chara";
    elements.gas.value = "all";
    refreshComponentOptions();
    render();
  });
}

function render() {
  const rows = filteredRows();
  renderActive(rows.length);
  renderStats(rows);
  renderSummary(rows);
  renderDetail(rows);
}

function filteredRows({ includeComponent = true } = {}) {
  return state.data.filter((row) => {
    if (state.filters.season !== "all" && `${row.season}` !== state.filters.season) return false;
    if (state.filters.farmer !== "all" && row.farmer_id !== state.filters.farmer) return false;
    if (row.basis !== state.filters.basis) return false;
    if (row.score !== state.filters.score) return false;
    if (state.filters.gas !== "all" && row.gas !== state.filters.gas) return false;
    if (includeComponent && state.filters.component !== "all" && row.component !== state.filters.component) return false;
    return true;
  });
}

function renderActive(count) {
  const parts = [];
  if (state.filters.season !== "all") parts.push(`Year ${state.filters.season}`);
  if (state.filters.farmer !== "all") parts.push(`Farmer ${state.filters.farmer}`);
  parts.push(state.filters.basis === "ha" ? "Per hectare" : "Per tonne");
  parts.push("Characterisation");
  if (state.filters.gas !== "all") parts.push(gasLabel(state.filters.gas));
  if (state.filters.component !== "all") parts.push(componentLabel(state.filters.component));
  elements.active.textContent = `${parts.join(" • ")} — ${count} rows`;
}

function renderStats(rows) {
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No data.</p>`;
    return;
  }
  const unit = rows[0].impact_unit || "";
  const dmus = uniqueValues(rows, "dmu_id").length;
  const ch4Mean = meanDmuTotal(rows.filter((row) => row.gas === "ch4"));
  const n2oMean = meanDmuTotal(rows.filter((row) => row.gas === "n2o"));
  const stats = [
    { label: "Rows", value: formatNumber(rows.length, 0) },
    { label: "Farmer-years", value: formatNumber(dmus, 0) },
    { label: `Mean CH4 (${unit})`, value: ch4Mean == null ? "-" : formatNumber(ch4Mean, 2) },
    { label: `Mean N2O (${unit})`, value: n2oMean == null ? "-" : formatNumber(n2oMean, 2) },
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

function renderSummary(rows) {
  const grouped = groupByComponent(rows);
  elements.summaryCount.textContent = `${grouped.length} components`;
  if (!grouped.length) {
    elements.summaryTable.innerHTML = `<p class="empty">No components match these filters.</p>`;
    return;
  }
  elements.summaryTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Emission source</th>
          <th>Component</th>
          <th>Impact category</th>
          <th>Unit</th>
          <th>Mean impact</th>
          <th>Rows</th>
        </tr>
      </thead>
      <tbody>
        ${grouped
          .map(
            (row) => `
              <tr>
                <td>${row.gasLabel}</td>
                <td>${row.componentLabel}</td>
                <td>${row.impactCategory}</td>
                <td>${row.unit}</td>
                <td>${formatNumber(row.mean, 2)}</td>
                <td>${row.count}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderDetail(rows) {
  elements.detailCount.textContent = `${rows.length} rows`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No rows match these filters.</p>`;
    return;
  }
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Year</th>
          <th>Farmer ID</th>
          <th>DMU</th>
          <th>Source</th>
          <th>Component</th>
          <th>Impact type</th>
          <th>Basis</th>
          <th>Unit</th>
          <th>Impact</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.season}</td>
                <td>${row.farmer_id}</td>
                <td>${row.dmu_id}</td>
                <td>${row.gasLabel}</td>
                <td>${row.componentLabel}</td>
                <td>${row.scoreLabel}</td>
                <td>${row.basis === "ha" ? "ha" : "tonne"}</td>
                <td>${row.impact_unit}</td>
                <td>${formatNumber(row.impact, 2)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function refreshComponentOptions() {
  const rows = filteredRows({ includeComponent: false });
  const options = uniqueValues(rows, "component")
    .sort()
    .map((component) => ({ value: component, label: componentLabel(component) }));
  const allowed = new Set(options.map((option) => option.value));
  if (state.filters.component !== "all" && !allowed.has(state.filters.component)) {
    state.filters.component = "all";
  }
  fillSelect(elements.component, options, "Component");
  elements.component.value = state.filters.component;
}

function groupByComponent(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.gas}|${row.component}|${row.impact_category}|${row.impact_unit}`;
    if (!map.has(key)) {
      map.set(key, {
        gasLabel: row.gasLabel,
        componentLabel: row.componentLabel,
        impactCategory: row.impact_category,
        unit: row.impact_unit,
        total: 0,
        count: 0,
      });
    }
    const item = map.get(key);
    item.total += row.impact || 0;
    item.count += 1;
  });
  return Array.from(map.values())
    .map((row) => ({ ...row, mean: row.count ? row.total / row.count : 0 }))
    .sort((a, b) => b.mean - a.mean);
}

function meanDmuTotal(rows) {
  if (!rows.length) return null;
  const byDmu = new Map();
  rows.forEach((row) => {
    byDmu.set(row.dmu_id, (byDmu.get(row.dmu_id) || 0) + (row.impact || 0));
  });
  const values = Array.from(byDmu.values());
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fillSelect(select, values, label) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = `All ${label.toLowerCase()}s`;
  select.appendChild(all);
  values.forEach((item) => {
    const option = document.createElement("option");
    if (typeof item === "object") {
      option.value = item.value;
      option.textContent = item.label;
    } else {
      option.value = item;
      option.textContent = item;
    }
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

function gasLabel(gas) {
  return GAS_LABELS[gas] || gas || "-";
}

function componentLabel(component) {
  return String(component || "-")
    .replace(/^ch4_total$/, "Methane total")
    .replace(/^co2_from_urea$/, "CO2 from urea")
    .replace(/^n2o_/, "N2O ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
