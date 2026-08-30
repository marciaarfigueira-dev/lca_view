import { baseFarmerId, extractSeason, loadCsv, toNumber } from "./pivot-data.js";

const state = {
  data: [],
  filters: { season: "all", farmer: "all", search: "" },
};

const elements = {
  season: document.getElementById("season-filter"),
  farmer: document.getElementById("farmer-filter"),
  search: document.getElementById("search-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
};

init();

async function init() {
  try {
    const rows = await loadCsv("./data/pivot_tables/operations_mastersheet - Water.csv");
    state.data = rows.map(enrichRow);
    hydrateFilters(state.data);
    attachEvents();
    render();
  } catch (error) {
    const message = `Unable to load the irrigation input table: ${error.message}`;
    elements.statGrid.innerHTML = `<p class="empty">${message}</p>`;
    elements.detailTable.innerHTML = `<p class="empty">${message}</p>`;
  }
}

function enrichRow(row) {
  const dmu = row.DMU_ID || row.dmu_id || "";
  const season = extractSeason(row) || "—";
  return {
    dmu_id: dmu || "—",
    farmer_id: baseFarmerId(dmu) || "—",
    season,
    area_ha: toNumber(row["SUM of area_ha"]),
    yield_t_ha: toNumber(row["Productivity (t/ha)"]),
    allocation_m3_ha: toNumber(row["Water m3/ha"]),
    allocation_m3_t: toNumber(row["Water M3/t"]),
  };
}

function hydrateFilters(data) {
  fillSelect(elements.season, uniqueValues(data, "season").sort((a, b) => Number(a) - Number(b)), "years");
  fillSelect(elements.farmer, uniqueValues(data, "farmer_id").sort(naturalSort), "farmers");
}

function fillSelect(select, values, allLabel) {
  select.innerHTML = `<option value="all">All ${allLabel}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function attachEvents() {
  elements.season.addEventListener("change", () => {
    state.filters.season = elements.season.value;
    render();
  });
  elements.farmer.addEventListener("change", () => {
    state.filters.farmer = elements.farmer.value;
    render();
  });
  elements.search.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim();
    render();
  });
  elements.reset.addEventListener("click", () => {
    state.filters = { season: "all", farmer: "all", search: "" };
    elements.season.value = "all";
    elements.farmer.value = "all";
    elements.search.value = "";
    render();
  });
}

function render() {
  const rows = applyFilters(state.data);
  renderActive(rows.length);
  renderStats(rows);
  renderTable(rows);
}

function applyFilters(rows) {
  const term = state.filters.search.toLowerCase();
  return rows.filter((row) => {
    if (state.filters.season !== "all" && String(row.season) !== state.filters.season) return false;
    if (state.filters.farmer !== "all" && row.farmer_id !== state.filters.farmer) return false;
    if (term && !`${row.dmu_id} ${row.farmer_id} ${row.season}`.toLowerCase().includes(term)) return false;
    return true;
  });
}

function renderActive(count) {
  const labels = [];
  if (state.filters.season !== "all") labels.push(`Year ${state.filters.season}`);
  if (state.filters.farmer !== "all") labels.push(`Farmer ${state.filters.farmer}`);
  if (state.filters.search) labels.push(`Search: “${state.filters.search}”`);
  elements.active.textContent = labels.length
    ? `${labels.join(" • ")} — ${count} farmer-year rows`
    : `No filters applied — ${count} farmer-year rows`;
}

function renderStats(rows) {
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No matching irrigation rows.</p>`;
    return;
  }
  const allocations = rows.map((row) => row.allocation_m3_ha).filter(Number.isFinite);
  const stats = [
    { label: "Farmer-years", value: formatNumber(rows.length, 0) },
    { label: "Farms", value: formatNumber(new Set(rows.map((row) => row.farmer_id)).size, 0) },
    { label: "Median reported allocation", value: `${formatNumber(median(allocations), 2)} m³/ha` },
    { label: "Distinct allocation values", value: formatNumber(new Set(allocations.map((value) => value.toFixed(6))).size, 0) },
  ];
  elements.statGrid.innerHTML = stats
    .map(
      ({ label, value }) => `
        <div class="stat">
          <small>${label}</small>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
}

function renderTable(rows) {
  elements.detailCount.textContent = `${rows.length} rows`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No matching irrigation rows.</p>`;
    return;
  }
  const ordered = [...rows].sort((a, b) => Number(a.season) - Number(b.season) || naturalSort(a.farmer_id, b.farmer_id));
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Farmer-year</th>
          <th>Year</th>
          <th>Farmer</th>
          <th>Area (ha)</th>
          <th>Yield (t/ha)</th>
          <th>Reported/planned allocation (m³/ha)</th>
          <th>Derived allocation per output (m³/t)</th>
        </tr>
      </thead>
      <tbody>
        ${ordered
          .map(
            (row) => `
              <tr>
                <td>${row.dmu_id}</td>
                <td>${row.season}</td>
                <td>${row.farmer_id}</td>
                <td>${formatNumber(row.area_ha, 2)}</td>
                <td>${formatNumber(row.yield_t_ha, 2)}</td>
                <td>${formatNumber(row.allocation_m3_ha, 2)}</td>
                <td>${formatNumber(row.allocation_m3_t, 2)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value !== "—"))];
}

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[midpoint] : (ordered[midpoint - 1] + ordered[midpoint]) / 2;
}

function naturalSort(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function formatNumber(value, digits) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
