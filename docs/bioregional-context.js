import { loadCsv, toNumber } from "./pivot-data.js";

const LCA_YEARS = [2022, 2023, 2024];

const METRICS = [
  { key: "tmax_mean_c", label: "Mean daily maximum temperature", unit: "deg C", group: "temperature" },
  { key: "days35", label: "Days above 35 deg C", unit: "days", group: "temperature" },
  { key: "days40", label: "Days above 40 deg C", unit: "days", group: "temperature" },
  { key: "hw35", label: "Heatwave days above 35 deg C", unit: "days", group: "temperature" },
  { key: "hw40", label: "Heatwave days above 40 deg C", unit: "days", group: "temperature" },
  { key: "vpd_mean_kpa", label: "Mean vapour pressure deficit", unit: "kPa", group: "vpd" },
  { key: "precip_mm", label: "Precipitation", unit: "mm", group: "precipitation" },
  { key: "nao_index", label: "NAO index", unit: "index", group: "nao" },
];

const state = {
  rows: [],
  filters: {
    month: "all",
    group: "all",
    year: "all",
  },
};

const elements = {
  month: document.getElementById("month-filter"),
  group: document.getElementById("group-filter"),
  year: document.getElementById("year-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  chartCount: document.getElementById("chart-count"),
  chart: document.getElementById("context-chart"),
  detailCount: document.getElementById("detail-count"),
  detailTable: document.getElementById("detail-table"),
  trendCount: document.getElementById("trend-count"),
  trendTable: document.getElementById("trend-table"),
};

init();

async function init() {
  const rows = await loadCsv("./data/context/sado_climate_nao_context_1991_2024_aug_sep_oct.csv");
  state.rows = rows.map((row) => ({
    region: row.region,
    year: toNumber(row.year),
    month: toNumber(row.month),
    month_name: row.month_name,
    is_lca_year: row.is_lca_year === "True" || row.is_lca_year === "true",
    tmax_mean_c: toNumber(row.tmax_mean_c),
    days35: toNumber(row.days35),
    days40: toNumber(row.days40),
    hw35: toNumber(row.hw35),
    hw40: toNumber(row.hw40),
    vpd_mean_kpa: toNumber(row.vpd_mean_kpa),
    precip_mm: toNumber(row.precip_mm),
    nao_index: toNumber(row.nao_index),
    yield_kg_ha: toNumber(row.yield_kg_ha),
    yield_residual_pct: toNumber(row.yield_residual_pct),
  }));
  attachEvents();
  render();
}

function attachEvents() {
  elements.month.addEventListener("change", () => {
    state.filters.month = elements.month.value;
    render();
  });
  elements.group.addEventListener("change", () => {
    state.filters.group = elements.group.value;
    render();
  });
  elements.year.addEventListener("change", () => {
    state.filters.year = elements.year.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, {
      month: "all",
      group: "all",
      year: "all",
    });
    elements.month.value = "all";
    elements.group.value = "all";
    elements.year.value = "all";
    render();
  });
}

function render() {
  const chartRows = buildChartRows();
  const detailRows = buildDetailRows(chartRows);
  const relationshipRows = buildYieldRelationshipRows();
  renderActive(chartRows.length, detailRows.length);
  renderStats(chartRows, detailRows);
  renderChart(chartRows);
  renderDetail(detailRows);
  renderYieldRelationships(relationshipRows);
}

function buildChartRows() {
  const months = selectedMonths();
  const metrics = selectedMetrics();
  return metrics.flatMap((metric) =>
    months.map((month) => {
      const monthRows = state.rows.filter((row) => row.month === month);
      const values = monthRows.map((row) => row[metric.key]).filter(Number.isFinite);
      const lcaPoints = monthRows
        .filter((row) => LCA_YEARS.includes(row.year) && selectedYears().includes(row.year))
        .map((row) => ({
          year: row.year,
          value: row[metric.key],
          percentile: percentileRank(values, row[metric.key]),
        }))
        .filter((point) => Number.isFinite(point.value));
      const summary = summarise(values);
      return {
        metric,
        month,
        monthName: monthRows.find((row) => row.month_name)?.month_name || monthLabel(month),
        values,
        ...summary,
        points: lcaPoints,
      };
    })
  );
}

function buildDetailRows(chartRows) {
  return chartRows.flatMap((row) =>
    row.points.map((point) => ({
      year: point.year,
      month: row.monthName,
      metric: row.metric.label,
      unit: row.metric.unit,
      value: point.value,
      median: row.median,
      q1: row.q1,
      q3: row.q3,
      anomaly: point.value - row.median,
      percentile: point.percentile,
    }))
  );
}

function buildYieldRelationshipRows() {
  const months = selectedMonths();
  const metrics = selectedMetrics();
  return metrics.flatMap((metric) =>
    months.map((month) => {
      const rows = state.rows
        .filter((row) => row.month === month && Number.isFinite(row[metric.key]) && Number.isFinite(row.yield_residual_pct))
        .map((row) => ({ year: row.year, x: row[metric.key], y: row.yield_residual_pct }))
        .sort((a, b) => a.year - b.year);
      const relationship = pearsonRelationship(rows);
      return {
        metric,
        month,
        monthName: monthLabel(month),
        ...relationship,
      };
    })
  );
}

function selectedMonths() {
  if (state.filters.month !== "all") return [Number(state.filters.month)];
  return [8, 9, 10];
}

function selectedMetrics() {
  if (state.filters.group === "all") return METRICS;
  return METRICS.filter((metric) => metric.group === state.filters.group);
}

function selectedYears() {
  if (state.filters.year === "all") return LCA_YEARS;
  return [Number(state.filters.year)];
}

function renderActive(chartRows, detailRows) {
  const parts = [];
  parts.push(state.filters.month === "all" ? "August-October" : monthLabel(Number(state.filters.month)));
  parts.push(groupLabel(state.filters.group));
  parts.push(state.filters.year === "all" ? "2022-2024" : state.filters.year);
  elements.active.textContent = `${parts.join(" - ")} - ${chartRows} historical range plots, ${detailRows} LCA-year markers`;
}

function renderStats(chartRows, detailRows) {
  const years = uniqueValues(state.rows, "year").sort((a, b) => a - b);
  const hotRows = detailRows.filter((row) => row.metric.includes("Heatwave") || row.metric.includes("35") || row.metric.includes("40"));
  const highestPercentile = detailRows.reduce((best, row) => (!best || row.percentile > best.percentile ? row : best), null);
  const stats = [
    { label: "Region", value: "Sado", sub: "All farmer-years share this context layer" },
    { label: "Historical baseline", value: `${years[0]}-${years[years.length - 1]}`, sub: `${years.length} years, Aug-Oct` },
    { label: "LCA years shown", value: state.filters.year === "all" ? "2022-2024" : state.filters.year, sub: `${detailRows.length} markers` },
    {
      label: "Highest percentile",
      value: highestPercentile ? `${formatNumber(highestPercentile.percentile, 0)}th` : "-",
      sub: highestPercentile ? `${highestPercentile.year} ${highestPercentile.month} - ${highestPercentile.metric}` : "",
    },
    {
      label: "Heat metrics shown",
      value: formatNumber(hotRows.length, 0),
      sub: "Yield associations shown below",
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

function renderChart(rows) {
  elements.chartCount.textContent = `${rows.length} plots`;
  if (!rows.length) {
    elements.chart.innerHTML = `<p class="empty">No context values match these filters.</p>`;
    return;
  }
  elements.chart.innerHTML = rows
    .map((row) => {
      const scale = scaleBounds(row.values);
      const q1 = percent(row.q1, scale.min, scale.max);
      const q3 = percent(row.q3, scale.min, scale.max);
      const med = percent(row.median, scale.min, scale.max);
      return `
        <div class="context-row">
          <div class="context-label">
            <strong>${row.metric.label}</strong>
            <span>${row.monthName} (${row.metric.unit})</span>
          </div>
          <div class="context-axis">
            <span>${formatNumber(scale.min, 2)}</span>
            <span>${formatNumber(scale.max, 2)}</span>
          </div>
          <div class="context-track" title="Historical Sado baseline, 1991-2024">
            <span class="context-band" style="left:${q1}%; width:${Math.max(1, q3 - q1)}%"></span>
            <span class="context-median" style="left:${med}%"></span>
            ${row.points
              .map((point) => {
                const pct = percent(point.value, scale.min, scale.max);
                return `
                  <span class="context-point year-${point.year}" style="left:${pct}%" title="${point.year}: ${formatNumber(
                    point.value,
                    3
                  )} ${row.metric.unit}; ${formatNumber(point.percentile, 0)}th percentile; median ${formatNumber(row.median, 3)}"></span>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDetail(rows) {
  elements.detailCount.textContent = `${rows.length} values`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No context values match these filters.</p>`;
    return;
  }
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Year</th>
          <th>Month</th>
          <th>Metric</th>
          <th>Value</th>
          <th>Historical median</th>
          <th>Q1-Q3</th>
          <th>Anomaly from median</th>
          <th>Percentile</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.year}</td>
                <td>${row.month}</td>
                <td>${row.metric}</td>
                <td>${formatNumber(row.value, 3)} ${row.unit}</td>
                <td>${formatNumber(row.median, 3)} ${row.unit}</td>
                <td>${formatNumber(row.q1, 3)}-${formatNumber(row.q3, 3)}</td>
                <td>${formatSigned(row.anomaly, 3)} ${row.unit}</td>
                <td>${formatNumber(row.percentile, 0)}th</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderYieldRelationships(rows) {
  elements.trendCount.textContent = `${rows.length} relationships`;
  if (!rows.length) {
    elements.trendTable.innerHTML = `<p class="empty">No yield relationship values match these filters.</p>`;
    return;
  }
  elements.trendTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Metric</th>
          <th>n</th>
          <th>Pearson r</th>
          <th>p-value</th>
          <th>R2</th>
          <th>Association with yield residual</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.monthName}</td>
                <td>${row.metric.label}</td>
                <td>${row.n}</td>
                <td>${formatSigned(row.r, 3)}</td>
                <td>${formatNumber(row.pValue, 3)}</td>
                <td>${formatNumber(row.r2, 2)}</td>
                <td>${yieldRelationshipInterpretation(row)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function pearsonRelationship(rows) {
  const valid = rows.filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));
  const n = valid.length;
  if (n < 3) {
    return { n, r: null, pValue: null, r2: null };
  }
  const meanX = mean(valid.map((row) => row.x));
  const meanY = mean(valid.map((row) => row.y));
  const centered = valid.map((row) => ({ x: row.x - meanX, y: row.y - meanY }));
  const ssx = centered.reduce((sum, row) => sum + row.x ** 2, 0);
  const ssy = centered.reduce((sum, row) => sum + row.y ** 2, 0);
  const sxy = centered.reduce((sum, row) => sum + row.x * row.y, 0);
  if (ssx === 0 || ssy === 0) {
    return { n, r: 0, pValue: 1, r2: 0 };
  }
  const r = sxy / Math.sqrt(ssx * ssy);
  const df = n - 2;
  const t = Math.abs(r) < 1 ? r * Math.sqrt(df / (1 - r ** 2)) : Number.POSITIVE_INFINITY;
  const pValue = Number.isFinite(t) ? twoTailedStudentTPValue(t, df) : 0;
  return {
    n,
    r,
    pValue,
    r2: r ** 2,
  };
}

function yieldRelationshipInterpretation(row) {
  if (!Number.isFinite(row.r) || !Number.isFinite(row.pValue)) return "No relationship test";
  const direction = row.r > 0 ? "higher metric aligns with higher yield residuals" : row.r < 0 ? "higher metric aligns with lower yield residuals" : "flat association";
  if (row.r === 0) return "No clear association";
  if (row.pValue < 0.05) return `${direction}, clear historical association`;
  if (row.pValue < 0.1) return `${direction}, weak historical association`;
  return "No clear association";
}

function summarise(values) {
  return {
    min: Math.min(...values),
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    max: Math.max(...values),
  };
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

function percentileRank(values, value) {
  if (!values.length || !Number.isFinite(value)) return null;
  const belowOrEqual = values.filter((item) => item <= value).length;
  return (belowOrEqual / values.length) * 100;
}

function scaleBounds(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: 0, max: 1 };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

function percent(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function uniqueValues(rows, key) {
  return Array.from(
    rows.reduce((set, row) => {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") set.add(row[key]);
      return set;
    }, new Set())
  );
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function monthLabel(month) {
  return { 8: "August", 9: "September", 10: "October" }[month] || month;
}

function groupLabel(group) {
  if (group === "temperature") return "Temperature and heatwaves";
  if (group === "vpd") return "VPD";
  if (group === "precipitation") return "Precipitation";
  if (group === "nao") return "NAO index";
  return "All metrics";
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

function twoTailedStudentTPValue(t, df) {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return null;
  const x = df / (df + t * t);
  return Math.max(0, Math.min(1, regularizedIncompleteBeta(x, df / 2, 0.5)));
}

function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(x, a, b)) / a;
  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x, a, b) {
  const maxIterations = 100;
  const epsilon = 3e-7;
  const fpmin = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < epsilon) break;
  }
  return h;
}

function logGamma(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  let y = z - 1;
  for (let i = 0; i < coefficients.length; i += 1) {
    x += coefficients[i] / (y + i + 1);
  }
  const t = y + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(x);
}
