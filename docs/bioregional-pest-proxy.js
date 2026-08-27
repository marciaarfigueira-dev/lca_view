import { baseFarmerId, loadCsv, toNumber } from "./pivot-data.js";

const ENEMIES = [
  { key: "digitaria_sanguinalis", label: "Digitaria sanguinalis" },
  { key: "cyperus_esculentus", label: "Cyperus esculentus" },
  { key: "pyricularia", label: "Pyricularia" },
  { key: "wild_rice", label: "Wild Rice" },
  { key: "gramineae", label: "Gramineae" },
  { key: "broadleaves", label: "Broadleaves" },
  { key: "general_weeds", label: "General Weeds" },
  { key: "weevil", label: "Weevil" },
  { key: "aphids", label: "Aphids" },
  { key: "rice_worms", label: "Rice Worms" },
  { key: "spodoptera_frugiperda", label: "Spodoptera frugiperda" },
  { key: "heteranthera", label: "Heteranthera" },
  { key: "unspecified_target", label: "Unspecified target" },
];

const PEST_METRICS = {
  kg_ha: { label: "kg a.i./ha", digits: 2 },
  kg_tonne: { label: "kg a.i./t", digits: 3 },
  operation_count: { label: "Operation count", digits: 0 },
  area_share: { label: "Treated area / farm area", digits: 0, percent: true },
};

const state = {
  rows: [],
  filters: {
    year: "all",
    metric: "kg_ha",
    target: "all",
  },
};

const elements = {
  year: document.getElementById("pest-year-filter"),
  metric: document.getElementById("pest-metric-filter"),
  target: document.getElementById("pest-target-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("pest-active-filters"),
  count: document.getElementById("pest-count"),
  statGrid: document.getElementById("pest-stat-grid"),
  heatmap: document.getElementById("pest-heatmap"),
  summaryCount: document.getElementById("pest-summary-count"),
  summaryTable: document.getElementById("pest-summary-table"),
};

init();

async function init() {
  const [records, dmuRows] = await Promise.all([
    loadCsv("./data/pivot_tables/operations_mastersheet - CROP_PROTECTION.csv"),
    loadCsv("./data/clean_lca/crop_protection/inventory/crop_protection_inventory_by_dmu.csv"),
  ]);
  state.rows = buildRows(records, dmuRows);
  hydrateTargetFilter();
  attachEvents();
  render();
}

function buildRows(records, dmuRows) {
  const dmuInfo = new Map(
    dmuRows.map((row) => [
      row.dmu_id,
      {
        areaHa: toNumber(row.area_ha),
        productionT: toNumber(row.production_t),
      },
    ])
  );
  return records.flatMap((row, index) => {
    const dmuId = row.dmu_id || "";
    const info = dmuInfo.get(dmuId) || {};
    const year = toNumber(row.year);
    const coveredArea = toNumber(row.covered_area) ?? toNumber(row.area_ha) ?? 0;
    const doseKgHa = toNumber(row.dose_kg_ha) ?? 0;
    const kgTotal = doseKgHa * coveredArea;
    const targets = ENEMIES.filter((enemy) => enemy.key !== "unspecified_target").filter((enemy) => {
      const raw = row[enemy.label] ?? row[enemy.key] ?? "";
      return toNumber(raw) === 1;
    });
    const reportedTargets = targets.length ? targets : [ENEMIES.find((enemy) => enemy.key === "unspecified_target")];
    return reportedTargets.map((target) => ({
      recordId: `${dmuId}-${index}-${target.key}`,
      dmu_id: dmuId,
      farmer_id: baseFarmerId(dmuId) || dmuId,
      year,
      target_key: target.key,
      target_label: target.label,
      operation: operationLabel(row.operation || ""),
      product: row.product || "",
      active_substance: row.active_substance || "",
      stage: row.stage || "",
      covered_area_ha: coveredArea,
      kg_total: kgTotal,
      kg_ha: info.areaHa ? kgTotal / info.areaHa : null,
      kg_tonne: info.productionT ? kgTotal / info.productionT : null,
      operation_count: 1,
      area_share: info.areaHa ? coveredArea / info.areaHa : null,
    }));
  });
}

function hydrateTargetFilter() {
  const targets = Array.from(
    state.rows.reduce((map, row) => {
      if (row.target_key) map.set(row.target_key, row.target_label);
      return map;
    }, new Map())
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  elements.target.innerHTML = `<option value="all">All targets</option>${targets
    .map((target) => `<option value="${target.value}">${target.label}</option>`)
    .join("")}`;
}

function attachEvents() {
  elements.year.addEventListener("change", () => {
    state.filters.year = elements.year.value;
    render();
  });
  elements.metric.addEventListener("change", () => {
    state.filters.metric = elements.metric.value;
    render();
  });
  elements.target.addEventListener("change", () => {
    state.filters.target = elements.target.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, { year: "all", metric: "kg_ha", target: "all" });
    elements.year.value = "all";
    elements.metric.value = "kg_ha";
    elements.target.value = "all";
    render();
  });
}

function render() {
  const rows = filteredRows();
  renderActive(rows);
  renderStats(rows);
  renderHeatmap(rows);
  renderSummary(rows);
}

function filteredRows() {
  return state.rows.filter((row) => {
    if (state.filters.year !== "all" && `${row.year}` !== state.filters.year) return false;
    if (state.filters.target !== "all" && row.target_key !== state.filters.target) return false;
    return true;
  });
}

function renderActive(rows) {
  const metric = PEST_METRICS[state.filters.metric];
  const farmerYears = uniqueValues(rows, "dmu_id").length;
  const targets = uniqueValues(rows, "target_key").length;
  elements.active.textContent = `${state.filters.year === "all" ? "2022-2024" : state.filters.year} - ${metric.label} - ${
    state.filters.target === "all" ? "all targets" : targetLabel(state.filters.target)
  }`;
  elements.count.textContent = `${farmerYears} farmer-years | ${targets} targets`;
}

function renderStats(rows) {
  const operations = rows.reduce((set, row) => set.add(row.recordId.replace(/-[^-]+$/, "")), new Set()).size;
  const farmerYears = uniqueValues(rows, "dmu_id").length;
  const targets = uniqueValues(rows, "target_key").length;
  const totalKg = sum(rows, "kg_total");
  const topTarget = topGroup(rows, "target_label", "kg_total");
  const stats = [
    { label: "Treatment records", value: formatNumber(operations, 0), sub: "Crop-protection operations" },
    { label: "Farmer-years", value: formatNumber(farmerYears, 0), sub: "Shown in heatmap" },
    { label: "Reported targets", value: formatNumber(targets, 0), sub: "Target flags in notebooks" },
    { label: "Target-attributed kg a.i.", value: formatNumber(totalKg, 1), sub: "Not additive across targets" },
    { label: "Largest signal", value: topTarget.label || "-", sub: topTarget.value ? `${formatNumber(topTarget.value, 1)} kg a.i.` : "" },
  ];
  elements.statGrid.innerHTML = stats.map(statCard).join("");
}

function renderHeatmap(rows) {
  if (!rows.length) {
    elements.heatmap.innerHTML = `<p class="empty">No crop-protection target records match these filters.</p>`;
    return;
  }
  const metric = PEST_METRICS[state.filters.metric];
  const dmus = Array.from(
    rows.reduce((map, row) => {
      if (!map.has(row.dmu_id)) map.set(row.dmu_id, { dmu_id: row.dmu_id, farmer_id: row.farmer_id, year: row.year });
      return map;
    }, new Map()).values()
  ).sort((a, b) => a.year - b.year || naturalCompare(a.farmer_id, b.farmer_id));
  const targetTotals = rows.reduce((map, row) => {
    const value = metricValue(row);
    map.set(row.target_key, (map.get(row.target_key) || 0) + (Number.isFinite(value) ? value : 0));
    return map;
  }, new Map());
  const targets = Array.from(
    rows.reduce((map, row) => {
      if (!map.has(row.target_key)) map.set(row.target_key, { key: row.target_key, label: row.target_label });
      return map;
    }, new Map()).values()
  ).sort((a, b) => (targetTotals.get(b.key) || 0) - (targetTotals.get(a.key) || 0) || a.label.localeCompare(b.label));
  const values = rows.reduce((map, row) => {
    const key = `${row.dmu_id}||${row.target_key}`;
    const value = metricValue(row);
    map.set(key, (map.get(key) || 0) + (Number.isFinite(value) ? value : 0));
    return map;
  }, new Map());
  const max = colourScaleMax();
  elements.heatmap.innerHTML = `
    <table class="pest-heatmap">
      <thead>
        <tr>
          <th>Farmer-year</th>
          ${targets.map((target) => `<th>${escapeHtml(target.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${dmus
          .map((dmu, index) => {
            const previous = dmus[index - 1];
            const separator = previous && previous.year !== dmu.year ? ` class="year-separator"` : "";
            return `
              <tr${separator}>
                <th>${escapeHtml(dmu.dmu_id)}</th>
                ${targets
                  .map((target) => {
                    const value = values.get(`${dmu.dmu_id}||${target.key}`) || 0;
                    const title = `${dmu.dmu_id} | ${target.label} | ${formatMetricValue(value, metric)}`;
                    return `<td style="${cellStyle(value, max)}" title="${escapeHtml(title)}">${value > 0 ? formatMetricValue(value, metric) : "·"}</td>`;
                  })
                  .join("")}
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSummary(rows) {
  if (!rows.length) {
    elements.summaryCount.textContent = "0 targets";
    elements.summaryTable.innerHTML = `<p class="empty">No crop-protection target records match these filters.</p>`;
    return;
  }
  const groups = Array.from(
    rows.reduce((map, row) => {
      if (!map.has(row.target_key)) {
        map.set(row.target_key, {
          target: row.target_label,
          operations: 0,
          dmus: new Set(),
          years: new Set(),
          products: new Set(),
          kgTotal: 0,
          operationTypes: new Map(),
          byDmuKgHa: new Map(),
        });
      }
      const group = map.get(row.target_key);
      group.operations += 1;
      group.dmus.add(row.dmu_id);
      group.years.add(row.year);
      if (row.product) group.products.add(row.product);
      group.kgTotal += Number.isFinite(row.kg_total) ? row.kg_total : 0;
      group.operationTypes.set(row.operation, (group.operationTypes.get(row.operation) || 0) + 1);
      group.byDmuKgHa.set(row.dmu_id, (group.byDmuKgHa.get(row.dmu_id) || 0) + (Number.isFinite(row.kg_ha) ? row.kg_ha : 0));
      return map;
    }, new Map()).values()
  )
    .map((group) => ({
      target: group.target,
      mainOperation: mostCommon(group.operationTypes),
      operations: group.operations,
      farmerYears: group.dmus.size,
      years: Array.from(group.years).sort().join(", "),
      products: group.products.size,
      kgTotal: group.kgTotal,
      medianKgHa: median(Array.from(group.byDmuKgHa.values()).filter(Number.isFinite)),
    }))
    .sort((a, b) => b.kgTotal - a.kgTotal || a.target.localeCompare(b.target));
  elements.summaryCount.textContent = `${groups.length} targets`;
  elements.summaryTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Target</th>
          <th>Main product type</th>
          <th>Operations</th>
          <th>Farmer-years</th>
          <th>Years</th>
          <th>Products</th>
          <th>Target-attributed kg a.i.</th>
          <th>Median kg a.i./ha</th>
        </tr>
      </thead>
      <tbody>
        ${groups
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.target)}</td>
                <td>${escapeHtml(row.mainOperation)}</td>
                <td>${formatNumber(row.operations, 0)}</td>
                <td>${formatNumber(row.farmerYears, 0)}</td>
                <td>${escapeHtml(row.years)}</td>
                <td>${formatNumber(row.products, 0)}</td>
                <td>${formatNumber(row.kgTotal, 1)}</td>
                <td>${formatNumber(row.medianKgHa, 3)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function metricValue(row) {
  if (state.filters.metric === "area_share") return Number.isFinite(row.area_share) ? row.area_share * 100 : null;
  return row[state.filters.metric];
}

function colourScaleMax() {
  const values = state.rows.reduce((map, row) => {
    const key = `${row.dmu_id}||${row.target_key}`;
    const value = metricValue(row);
    map.set(key, (map.get(key) || 0) + (Number.isFinite(value) ? value : 0));
    return map;
  }, new Map());
  return Math.max(...Array.from(values.values()).filter((value) => value > 0), 1);
}

function cellStyle(value, max) {
  if (!Number.isFinite(value) || value <= 0) {
    return "background:rgba(29,124,114,0.06); color:rgba(81,96,107,0.62);";
  }
  const intensity = Math.min(1, value / Math.max(max, 1e-9));
  const alpha = 0.1 + intensity * 0.82;
  const color = intensity > 0.58 ? "#fff" : "var(--ink)";
  return `background:rgba(217,112,62,${alpha}); color:${color};`;
}

function formatMetricValue(value, metric) {
  if (!Number.isFinite(value)) return "-";
  const suffix = metric.percent ? "%" : "";
  return `${formatNumber(value, metric.digits)}${suffix}`;
}

function topGroup(rows, labelKey, valueKey) {
  const totals = rows.reduce((map, row) => {
    const label = row[labelKey] || "";
    map.set(label, (map.get(label) || 0) + (Number.isFinite(row[valueKey]) ? row[valueKey] : 0));
    return map;
  }, new Map());
  let best = { label: "", value: 0 };
  totals.forEach((value, label) => {
    if (value > best.value) best = { label, value };
  });
  return best;
}

function operationLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "pesticide") return "Insecticide";
  if (key === "herbicide") return "Herbicide";
  if (key === "fungicide") return "Fungicide";
  return key ? toTitle(key) : "Unspecified";
}

function targetLabel(key) {
  return ENEMIES.find((enemy) => enemy.key === key)?.label || key;
}

function mostCommon(map) {
  let best = "";
  let bestValue = -Infinity;
  map.forEach((value, key) => {
    if (value > bestValue || (value === bestValue && key.localeCompare(best) < 0)) {
      best = key;
      bestValue = value;
    }
  });
  return best || "Unspecified";
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

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number.isFinite(row[key]) ? row[key] : 0), 0);
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

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function toTitle(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
