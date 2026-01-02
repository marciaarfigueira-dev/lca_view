const state = {
  datasets: { single: [], chara: [] },
  filters: {
    type: "single",
    product: "all",
    category: "all",
    search: "",
  },
};

const elements = {
  type: document.getElementById("type-filter"),
  product: document.getElementById("product-filter"),
  category: document.getElementById("category-filter"),
  search: document.getElementById("search-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  pivotTable: document.getElementById("pivot-table"),
  pivotCount: document.getElementById("pivot-count"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
  unitGrid: document.getElementById("unit-grid"),
};

init();

async function init() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  if (type === "single" || type === "chara") {
    state.filters.type = type;
  }
  elements.type.value = state.filters.type;

  const [single, chara] = await Promise.all([
    loadJson("./data/singlescore.json"),
    loadJson("./data/characterisation.json"),
  ]);
  state.datasets.single = flatten(single, "single");
  state.datasets.chara = flatten(chara, "chara");

  hydrateFilters();
  attachEvents();
  render();

  if (window.location.hash === "#units") {
    document.getElementById("units")?.scrollIntoView({ behavior: "smooth" });
  }
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Unable to load ${path}`);
  return res.json();
}

function flatten(records, type) {
  return records.flatMap((rec) => {
    const unit = rec.functional_unit || "—";
    return (rec.categories || []).map((cat) => ({
      type,
      product_id: rec.product_id || "—",
      product_name: rec.product_name || "—",
      functional_unit: unit,
      impact_category: cat.impact_category || "—",
      unit_label: cat.unit || "—",
      total: Number(cat.total) || 0,
    }));
  });
}

function hydrateFilters() {
  const rows = state.datasets[state.filters.type] || [];
  fillSelect(elements.product, uniqueValues(rows, "product_id"), "Product", (id) => {
    const row = rows.find((r) => r.product_id === id);
    return row ? `${row.product_name}` : id;
  });
  fillSelect(elements.category, uniqueValues(rows, "impact_category"), "Impact category");
}

function fillSelect(select, values, label, labelFn) {
  select.innerHTML = "";
  const optionAll = document.createElement("option");
  optionAll.value = "all";
  optionAll.textContent = `All ${label.toLowerCase()}s`;
  select.appendChild(optionAll);
  values
    .filter((v) => v != null && v !== "")
    .sort((a, b) => String(a).localeCompare(String(b)))
    .forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labelFn ? labelFn(value) : value;
      select.appendChild(option);
    });
}

function attachEvents() {
  elements.type.addEventListener("change", () => {
    state.filters.type = elements.type.value;
    state.filters.product = "all";
    state.filters.category = "all";
    elements.product.value = "all";
    elements.category.value = "all";
    hydrateFilters();
    render();
  });
  elements.product.addEventListener("change", () => {
    state.filters.product = elements.product.value;
    render();
  });
  elements.category.addEventListener("change", () => {
    state.filters.category = elements.category.value;
    render();
  });
  elements.search.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    state.filters = {
      type: state.filters.type,
      product: "all",
      category: "all",
      search: "",
    };
    elements.product.value = "all";
    elements.category.value = "all";
    elements.search.value = "";
    render();
  });
}

function render() {
  const rows = applyFilters();
  renderActive(rows.length);
  renderStats(rows);
  renderPivot(rows);
  renderDetail(rows);
  renderUnits(rows);
}

function applyFilters() {
  const rows = state.datasets[state.filters.type] || [];
  return rows.filter((row) => {
    if (state.filters.product !== "all" && row.product_id !== state.filters.product) return false;
    if (state.filters.category !== "all" && row.impact_category !== state.filters.category) return false;
    if (state.filters.search) {
      const term = state.filters.search.toLowerCase();
      const haystack = [row.product_id, row.product_name, row.impact_category]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function renderActive(count) {
  const parts = [];
  const { type, product, category, search } = state.filters;
  parts.push(type === "single" ? "Single score" : "Characterisation");
  if (product !== "all") parts.push(`Product ${product}`);
  if (category !== "all") parts.push(category);
  if (search) parts.push(`Search: “${search}”`);
  const label = parts.length ? parts.join(" • ") : "No filters applied";
  elements.active.textContent = `${label} — ${count} factors`;
}

function renderStats(rows) {
  const stats = [
    { label: "Factors", value: formatNumber(rows.length, 0) },
    { label: "Products", value: formatNumber(uniqueValues(rows, "product_id").length, 0) },
    { label: "Categories", value: formatNumber(uniqueValues(rows, "impact_category").length, 0) },
    { label: "Units", value: formatNumber(uniqueValues(rows, "unit_label").length, 0) },
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

function renderPivot(rows) {
  if (!rows.length) {
    elements.pivotTable.innerHTML = `<p class="empty">No factors match these filters.</p>`;
    elements.pivotCount.textContent = "0 products";
    return;
  }
  const grouped = groupByProduct(rows);
  elements.pivotCount.textContent = `${grouped.length} products`;
  const showUnit = state.filters.type === "single";
  const table = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Product ID</th>
          ${showUnit ? "<th>Functional unit</th>" : ""}
          <th>Categories</th>
          <th>Units</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${grouped
          .map(
            (row) => `
              <tr>
                <td>${row.product_name}</td>
                <td>${row.product_id}</td>
                ${showUnit ? `<td>${row.functional_unit}</td>` : ""}
                <td>${row.categories}</td>
                <td>${row.units}</td>
                <td>${row.total == null ? "—" : formatNumber(row.total, 3)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
  elements.pivotTable.innerHTML = table;
}

function renderDetail(rows) {
  elements.detailCount.textContent = `${rows.length} factors`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">Nothing to show. Adjust filters to see factors.</p>`;
    return;
  }
  const showUnit = state.filters.type === "single";
  const table = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Impact category</th>
          <th>Unit</th>
          <th>Factor</th>
          ${showUnit ? "<th>Functional unit</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.product_name}</td>
                <td>${row.impact_category}</td>
                <td>${row.unit_label}</td>
                <td>${formatNumber(row.total, 4)}</td>
                ${showUnit ? `<td>${row.functional_unit}</td>` : ""}
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
  elements.detailTable.innerHTML = table;
}

function renderUnits(rows) {
  if (!rows.length) {
    elements.unitGrid.innerHTML = `<p class="empty">No units to show.</p>`;
    return;
  }
  const counts = rows.reduce((acc, row) => {
    acc[row.unit_label] = (acc[row.unit_label] || 0) + 1;
    return acc;
  }, {});
  const cards = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([unit, count]) => `
        <div class="unit-card">
          <strong>${unit}</strong>
          <span>${formatNumber(count, 0)} factors</span>
        </div>
      `
    );
  elements.unitGrid.innerHTML = cards.join("");
}

function groupByProduct(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, {
        product_id: row.product_id,
        product_name: row.product_name,
        functional_unit: row.functional_unit,
        categories: new Set(),
        units: new Set(),
        total: null,
      });
    }
    const entry = map.get(row.product_id);
    entry.categories.add(row.impact_category);
    entry.units.add(row.unit_label);
    if (row.impact_category === "Total") {
      entry.total = row.total;
    }
  });
  return Array.from(map.values()).map((entry) => ({
    ...entry,
    categories: entry.categories.size,
    units: entry.units.size,
  }));
}

function uniqueValues(rows, key) {
  return Array.from(
    rows.reduce((set, row) => {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        set.add(row[key]);
      }
      return set;
    }, new Set())
  );
}

function formatNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if ((abs >= 1e6 || abs > 0 && abs < 1e-3) && digits >= 2) {
    return value.toExponential(2);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}
