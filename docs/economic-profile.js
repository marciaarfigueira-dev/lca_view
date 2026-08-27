import { baseFarmerId, loadCsv, toNumber } from "./pivot-data.js";

const SCENARIOS = {
  low: { label: "Low", priceColumn: "low", totalKey: "lowTotal" },
  central: { label: "Central", priceColumn: "central", totalKey: "centralTotal" },
  high: { label: "High", priceColumn: "high", totalKey: "highTotal" },
};

const BASIS = {
  ha: { label: "EUR/ha", denominator: "areaHa" },
  tonne: { label: "EUR/t", denominator: "productionT" },
};

const DOMAINS = {
  all: { label: "Fertilisers + crop protection" },
  fertilisers: { label: "Fertilisers" },
  crop_protection: { label: "Crop protection" },
};

const state = {
  operations: [],
  filters: {
    year: "all",
    farmer: "all",
    domain: "all",
    scenario: "central",
    basis: "ha",
  },
};

const elements = {
  year: document.getElementById("year-filter"),
  farmer: document.getElementById("farmer-filter"),
  domain: document.getElementById("domain-filter"),
  scenario: document.getElementById("scenario-filter"),
  basis: document.getElementById("basis-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  rangeCount: document.getElementById("range-count"),
  rangeChart: document.getElementById("range-chart"),
  productCount: document.getElementById("product-count"),
  productTable: document.getElementById("product-table"),
  revenueCount: document.getElementById("revenue-count"),
  revenueTable: document.getElementById("revenue-table"),
  detailCount: document.getElementById("detail-count"),
  detailTable: document.getElementById("detail-table"),
};

init();

async function init() {
  const [fertiliserRows, cropRows, sowingRows, fertiliserPrices, cropPrices, ricePrices, varietyMap] = await Promise.all([
    loadCsv("./data/pivot_tables/operations_mastersheet - FERTILISATION.csv"),
    loadCsv("./data/clean_lca/crop_protection/inventory/crop_protection_inventory_by_operation.csv"),
    loadCsv("./data/pivot_tables/operations_mastersheet - SOWING.csv"),
    loadCsv("./data/economic/fertiliser_price_scenarios_2024.csv"),
    loadCsv("./data/economic/crop_protection_price_scenarios_2024.csv"),
    loadCsv("./data/economic/rice_paddy_price_scenarios_by_year.csv"),
    loadCsv("./data/economic/rice_variety_price_group_map.csv"),
  ]);

  const fertiliserPriceMap = buildFertiliserPriceMap(fertiliserPrices);
  const cropPriceMap = buildCropProtectionPriceMap(cropPrices);
  const ricePriceMap = buildRicePriceMap(ricePrices);
  const riceVarietyMap = buildVarietyMap(varietyMap);
  state.operations = [
    ...buildFertiliserOperations(fertiliserRows, fertiliserPriceMap),
    ...buildCropProtectionOperations(cropRows, cropPriceMap),
  ];
  state.revenueRows = buildRiceRevenueRows(sowingRows, ricePriceMap, riceVarietyMap);

  hydrateFilters();
  attachEvents();
  render();
}

function buildFertiliserPriceMap(rows) {
  return new Map(
    rows.map((row) => {
      const product = canonicalProduct(row.product);
      return [
        product,
        {
          product,
          domain: "fertilisers",
          quantityUnit: "kg",
          priceUnit: "EUR/kg",
          quantityMultiplier: 1,
          low: toNumber(row.low_eur_kg),
          central: toNumber(row.central_eur_kg),
          high: toNumber(row.high_eur_kg),
          basisConfidence: row.basis_confidence || "",
          notes: row.notes || "",
        },
      ];
    })
  );
}

function buildCropProtectionPriceMap(rows) {
  return new Map(
    rows.map((row) => {
      const product = canonicalProduct(row.product);
      return [
        product,
        {
          product,
          domain: "crop_protection",
          quantityUnit: row.quantity_unit || "unit",
          priceUnit: row.price_unit || "EUR/unit",
          quantityMultiplier: toNumber(row.product_unit_per_recorded_unit) ?? 1,
          low: toNumber(row.low_eur_per_unit),
          central: toNumber(row.central_eur_per_unit),
          high: toNumber(row.high_eur_per_unit),
          basisConfidence: row.basis_confidence || "",
          notes: row.notes || "",
        },
      ];
    })
  );
}

function buildRicePriceMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const year = toNumber(row.year);
    const priceGroup = row.price_group || "";
    map.set(`${year}:${priceGroup}`, {
      year,
      campaign: row.campaign || "",
      priceGroup,
      low: toNumber(row.low_eur_t),
      central: toNumber(row.central_eur_t),
      high: toNumber(row.high_eur_t),
      sourceBasis: row.source_basis || "",
      notes: row.notes || "",
    });
  });
  return map;
}

function buildVarietyMap(rows) {
  return new Map(
    rows.map((row) => [
      row.variety,
      {
        variety: row.variety,
        priceGroup: row.price_group || "carolino",
        classification: row.classification || "",
        confidence: row.confidence || "",
        notes: row.notes || "",
      },
    ])
  );
}

function buildFertiliserOperations(rows, priceMap) {
  return rows.map((row, index) => {
    const dmuId = row.dmu_id || "";
    const farmerId = baseFarmerId(dmuId) || dmuId;
    const product = canonicalProduct(row.product || "");
    const price = priceMap.get(product);
    const coveredArea = toNumber(row.covered_area) ?? toNumber(row.area_TOTAL) ?? 0;
    const doseKgHa = toNumber(row.dose_kg_ha) ?? 0;
    const quantity = doseKgHa * coveredArea;
    const areaHa = toNumber(row.area_TOTAL);
    const yieldTHa = toNumber(row.productivity_weighted);
    const productionT = areaHa && yieldTHa ? areaHa * yieldTHa : null;
    return buildOperation({
      recordId: `fertiliser-${dmuId}-${index}`,
      domain: "fertilisers",
      domainLabel: "Fertilisers",
      dmuId,
      farmerId,
      year: toNumber(row.year),
      operation: operationLabel(row.operation || ""),
      product,
      dose: doseKgHa,
      coveredArea,
      quantity,
      quantityUnit: "kg",
      areaHa,
      yieldTHa,
      productionT,
      price,
    });
  });
}

function buildCropProtectionOperations(rows, priceMap) {
  return rows.map((row, index) => {
    const dmuId = row.dmu_id || "";
    const farmerId = row.farmer_id || baseFarmerId(dmuId) || dmuId;
    const product = canonicalProduct(row.product || "");
    const price = priceMap.get(product);
    const recordedQuantity = toNumber(row.active_substance_kg_total) ?? 0;
    const quantityMultiplier = price ? price.quantityMultiplier : 1;
    const quantity = recordedQuantity * quantityMultiplier;
    const areaHa = toNumber(row.dmu_area_ha);
    const productionT = toNumber(row.dmu_production_t);
    const yieldTHa = areaHa && productionT ? productionT / areaHa : null;
    return buildOperation({
      recordId: `crop-protection-${dmuId}-${index}`,
      domain: "crop_protection",
      domainLabel: "Crop protection",
      dmuId,
      farmerId,
      year: toNumber(row.year),
      operation: operationLabel(row.operation_label || ""),
      product,
      dose: toNumber(row.dose_kg_ha),
      coveredArea: toNumber(row.covered_area_ha),
      quantity,
      quantityUnit: price ? price.quantityUnit : "unit",
      areaHa,
      yieldTHa,
      productionT,
      price,
    });
  });
}

function buildOperation({
  recordId,
  domain,
  domainLabel,
  dmuId,
  farmerId,
  year,
  operation,
  product,
  dose,
  coveredArea,
  quantity,
  quantityUnit,
  areaHa,
  yieldTHa,
  productionT,
  price,
}) {
  const priced = isPriced(price);
  return {
    recordId,
    domain,
    domainLabel,
    dmu_id: dmuId,
    farmer_id: farmerId,
    year,
    operation,
    product,
    dose,
    covered_area_ha: coveredArea,
    quantity,
    quantityUnit,
    areaHa,
    yieldTHa,
    productionT,
    price,
    priced,
    lowCost: priced ? quantity * price.low : null,
    centralCost: priced ? quantity * price.central : null,
    highCost: priced ? quantity * price.high : null,
  };
}

function buildRiceRevenueRows(rows, ricePriceMap, varietyMap) {
  const uniqueVarieties = new Map();
  rows.forEach((row) => {
    const dmuId = row.dmu_id || "";
    const variety = row.variety || "";
    if (!dmuId || !variety) return;
    const key = `${dmuId}:${variety}`;
    const areaHa = toNumber(row.area_ha) ?? 0;
    const current = uniqueVarieties.get(key);
    if (current && current.areaHa >= areaHa) return;

    const farmerId = baseFarmerId(dmuId) || dmuId;
    const year = toNumber(row.year);
    const yieldTHa = toNumber(row.productivity) ?? 0;
    const productionT = areaHa * yieldTHa;
    const varietyInfo = varietyMap.get(variety) || {
      variety,
      priceGroup: "carolino",
      classification: "unmapped proxy",
      confidence: "low",
      notes: "Variety was not found in the price-group map; Carolino price used as a provisional proxy.",
    };
    const price = ricePriceMap.get(`${year}:${varietyInfo.priceGroup}`);
    const priced = isPriced(price);

    uniqueVarieties.set(key, {
      dmu_id: dmuId,
      farmer_id: farmerId,
      year,
      variety,
      areaHa,
      yieldTHa,
      productionT,
      priceGroup: varietyInfo.priceGroup,
      classification: varietyInfo.classification,
      confidence: varietyInfo.confidence,
      notes: varietyInfo.notes,
      campaign: price ? price.campaign : "",
      price,
      priced,
      lowRevenue: priced ? productionT * price.low : null,
      centralRevenue: priced ? productionT * price.central : null,
      highRevenue: priced ? productionT * price.high : null,
    });
  });

  return buildRevenueFarmerYears(Array.from(uniqueVarieties.values()));
}

function buildRevenueFarmerYears(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const current = map.get(row.dmu_id) || {
      dmu_id: row.dmu_id,
      farmer_id: row.farmer_id,
      year: row.year,
      campaignSet: new Set(),
      varietySet: new Set(),
      priceGroupSet: new Set(),
      proxySet: new Set(),
      areaHa: 0,
      productionT: 0,
      lowRevenue: 0,
      centralRevenue: 0,
      highRevenue: 0,
      records: 0,
      pricedRecords: 0,
    };
    current.records += 1;
    current.areaHa += row.areaHa || 0;
    current.productionT += row.productionT || 0;
    current.varietySet.add(row.variety);
    current.priceGroupSet.add(row.priceGroup);
    if (row.campaign) current.campaignSet.add(row.campaign);
    if (row.confidence === "proxy" || row.confidence === "low") {
      current.proxySet.add(`${row.variety}: ${row.classification || row.priceGroup}`);
    }
    if (row.priced) {
      current.pricedRecords += 1;
      current.lowRevenue += row.lowRevenue || 0;
      current.centralRevenue += row.centralRevenue || 0;
      current.highRevenue += row.highRevenue || 0;
    }
    map.set(row.dmu_id, current);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      yieldTHa: row.areaHa ? row.productionT / row.areaHa : null,
      campaigns: Array.from(row.campaignSet).sort().join("; "),
      varieties: Array.from(row.varietySet).sort((a, b) => a.localeCompare(b)).join("; "),
      priceGroups: Array.from(row.priceGroupSet).sort().join("; "),
      proxies: Array.from(row.proxySet).sort((a, b) => a.localeCompare(b)).join("; "),
    }))
    .sort((a, b) => a.year - b.year || naturalCompare(a.dmu_id, b.dmu_id));
}

function buildFarmerYears(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row.dmu_id) return;
    const current = map.get(row.dmu_id) || {
      dmu_id: row.dmu_id,
      farmer_id: row.farmer_id,
      year: row.year,
      areaHa: row.areaHa,
      yieldTHa: row.yieldTHa,
      productionT: row.productionT,
      records: 0,
      pricedRecords: 0,
      productSet: new Set(),
      unpricedProductSet: new Set(),
      quantityByUnit: new Map(),
      unpricedQuantityByUnit: new Map(),
      lowTotal: 0,
      centralTotal: 0,
      highTotal: 0,
    };
    if (!current.areaHa && row.areaHa) current.areaHa = row.areaHa;
    if (!current.productionT && row.productionT) current.productionT = row.productionT;
    if (!current.yieldTHa && row.yieldTHa) current.yieldTHa = row.yieldTHa;
    current.records += 1;
    current.productSet.add(`${row.domainLabel}: ${row.product}`);
    addQuantity(current.quantityByUnit, row.quantityUnit, row.quantity || 0);
    if (row.priced) {
      current.pricedRecords += 1;
      current.lowTotal += row.lowCost || 0;
      current.centralTotal += row.centralCost || 0;
      current.highTotal += row.highCost || 0;
    } else {
      current.unpricedProductSet.add(`${row.domainLabel}: ${row.product || "Unspecified product"}`);
      addQuantity(current.unpricedQuantityByUnit, row.quantityUnit, row.quantity || 0);
    }
    map.set(row.dmu_id, current);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      products: Array.from(row.productSet).sort((a, b) => a.localeCompare(b)),
      unpricedProducts: Array.from(row.unpricedProductSet).sort((a, b) => a.localeCompare(b)),
      quantityLabel: formatQuantityMap(row.quantityByUnit),
      unpricedQuantityLabel: formatQuantityMap(row.unpricedQuantityByUnit),
    }))
    .sort((a, b) => a.year - b.year || naturalCompare(a.dmu_id, b.dmu_id));
}

function hydrateFilters() {
  fillSelect(elements.year, unique(state.operations.map((row) => row.year)).sort(), "all", "All years");
  fillSelect(elements.farmer, unique(state.operations.map((row) => row.farmer_id)).sort(naturalCompare), "all", "All farmers");
}

function attachEvents() {
  elements.year.addEventListener("change", () => {
    state.filters.year = elements.year.value;
    render();
  });
  elements.farmer.addEventListener("change", () => {
    state.filters.farmer = elements.farmer.value;
    render();
  });
  elements.domain.addEventListener("change", () => {
    state.filters.domain = elements.domain.value;
    render();
  });
  elements.scenario.addEventListener("change", () => {
    state.filters.scenario = elements.scenario.value;
    render();
  });
  elements.basis.addEventListener("change", () => {
    state.filters.basis = elements.basis.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    Object.assign(state.filters, { year: "all", farmer: "all", domain: "all", scenario: "central", basis: "ha" });
    elements.year.value = "all";
    elements.farmer.value = "all";
    elements.domain.value = "all";
    elements.scenario.value = "central";
    elements.basis.value = "ha";
    render();
  });
}

function render() {
  const operations = filteredOperations();
  const farmerYears = buildFarmerYears(operations);
  const revenueRows = filteredRevenueRows();
  renderActive(farmerYears, operations);
  renderStats(farmerYears, operations, revenueRows);
  renderCostRevenueChart(revenueRows, farmerYears);
  renderRevenueTable(revenueRows, farmerYears);
  renderProductTable(operations);
  renderDetailTable(farmerYears);
}

function filteredOperations() {
  return state.operations.filter((row) => {
    if (state.filters.year !== "all" && `${row.year}` !== state.filters.year) return false;
    if (state.filters.farmer !== "all" && row.farmer_id !== state.filters.farmer) return false;
    if (state.filters.domain !== "all" && row.domain !== state.filters.domain) return false;
    return true;
  });
}

function filteredRevenueRows() {
  return state.revenueRows.filter((row) => {
    if (state.filters.year !== "all" && `${row.year}` !== state.filters.year) return false;
    if (state.filters.farmer !== "all" && row.farmer_id !== state.filters.farmer) return false;
    return true;
  });
}

function renderActive(farmerYears, operations) {
  const scenario = SCENARIOS[state.filters.scenario];
  const basis = BASIS[state.filters.basis];
  const domain = DOMAINS[state.filters.domain];
  const years = state.filters.year === "all" ? "2022-2024" : state.filters.year;
  const farmer = state.filters.farmer === "all" ? "all farmers" : state.filters.farmer;
  elements.active.textContent = `${years} - ${farmer} - ${domain.label} - ${scenario.label} - ${basis.label}`;
  elements.rangeCount.textContent = `${farmerYears.length} farmer-years`;
  elements.detailCount.textContent = `${farmerYears.length} farmer-years`;
  elements.productCount.textContent = `${unique(operations.map((row) => `${row.domain}:${row.product}`)).length} products`;
}

function renderStats(farmerYears, operations, revenueRows) {
  const scenario = SCENARIOS[state.filters.scenario];
  const basis = BASIS[state.filters.basis];
  const pricedRecords = operations.filter((row) => row.priced).length;
  const productKeys = unique(operations.map((row) => `${row.domain}:${row.product}`));
  const pricedProducts = unique(operations.filter((row) => row.priced).map((row) => `${row.domain}:${row.product}`)).length;
  const selectedTotals = farmerYears.map((row) => basisValue(row, scenario.totalKey, state.filters.basis)).filter(Number.isFinite);
  const total = sum(farmerYears, scenario.totalKey);
  const revenueTotal = sum(revenueRows, `${state.filters.scenario}Revenue`);
  const unpricedProducts = unique(operations.filter((row) => !row.priced).map((row) => `${row.domainLabel}: ${row.product}`)).filter(Boolean);
  const stats = [
    {
      label: "Estimated input expenditure",
      value: formatCurrency(total, 0),
      sub: `${scenario.label} scenario, selected inputs`,
    },
    {
      label: "Estimated paddy revenue",
      value: formatCurrency(revenueTotal, 0),
      sub: `${scenario.label} production-year paddy prices`,
    },
    {
      label: "Gross margin over selected inputs",
      value: formatCurrency(revenueTotal - total, 0),
      sub: "Revenue minus selected priced inputs",
    },
    {
      label: `Median selected cost ${basis.label}`,
      value: selectedTotals.length ? formatCurrency(median(selectedTotals), 1) : "-",
      sub: "Farmer-year median",
    },
    {
      label: "Records priced",
      value: `${pricedRecords}/${operations.length}`,
      sub: `${percent(pricedRecords, operations.length)} of filtered records`,
    },
    {
      label: "Products priced",
      value: `${pricedProducts}/${productKeys.length}`,
      sub: unpricedProducts.length ? `Unpriced: ${unpricedProducts.join(", ")}` : "All filtered products priced",
    },
    {
      label: "Unpriced quantity",
      value: formatUnpricedQuantity(farmerYears),
      sub: "Excluded from priced totals",
    },
  ];
  elements.statGrid.innerHTML = stats.map(statCard).join("");
}

function renderCostRevenueChart(revenueRows, costRows) {
  elements.rangeCount.textContent = `${revenueRows.length} farmer-years`;
  if (!revenueRows.length) {
    elements.rangeChart.innerHTML = `<p class="empty">No farmer-year economic records match these filters.</p>`;
    return;
  }
  const scenario = SCENARIOS[state.filters.scenario];
  const basis = state.filters.basis;
  const costByDmu = new Map(costRows.map((row) => [row.dmu_id, row]));
  const rows = revenueRows.map((row) => {
    const costs = costByDmu.get(row.dmu_id);
    const revenue = revenueBasisValue(row, `${state.filters.scenario}Revenue`, basis);
    const cost = costs ? basisValue(costs, scenario.totalKey, basis) : 0;
    const margin = Number.isFinite(revenue) && Number.isFinite(cost) ? revenue - cost : null;
    return { ...row, revenue, cost, margin, costShare: revenue ? (cost / revenue) * 100 : null };
  });
  const sorted = rows.sort((a, b) => {
    if (state.filters.farmer !== "all") return a.year - b.year;
    return a.year - b.year || naturalCompare(a.dmu_id, b.dmu_id);
  });
  const max = Math.max(...sorted.flatMap((row) => [row.revenue || 0, row.cost || 0]), 1);
  elements.rangeChart.innerHTML = sorted
    .map((row) => {
      const revenuePct = ((row.revenue || 0) / max) * 100;
      const costPct = ((row.cost || 0) / max) * 100;
      const costShareText = Number.isFinite(row.costShare) ? `${formatNumber(row.costShare, 1)}% of revenue` : "cost share unavailable";
      const costShareValue = Number.isFinite(row.costShare) ? `${formatNumber(row.costShare, 1)}%` : "-";
      const isNegative = Number.isFinite(row.margin) && row.margin < 0;
      return `
        <div class="economic-profile-row${isNegative ? " is-negative" : ""}">
          <div class="economic-range-label">
            <strong>${escapeHtml(row.dmu_id)}</strong>
            <span>${row.year} | ${escapeHtml(row.campaigns || "-")} | ${costShareText}</span>
          </div>
          <div class="economic-profile-track">
            <span class="economic-profile-bar revenue" style="width:${Math.max(1, revenuePct)}%" title="Revenue: ${formatBasisCurrency(row.revenue, basis, 2)}"></span>
            <span class="economic-profile-bar cost" style="width:${Math.max(1, costPct)}%" title="Selected cost: ${formatBasisCurrency(row.cost, basis, 2)}; ${costShareText}"></span>
          </div>
          <div class="economic-profile-values">
            <span>Revenue ${formatBasisCurrency(row.revenue, basis, 1)}</span>
            <span>Cost ${formatBasisCurrency(row.cost, basis, 1)} (${costShareValue})</span>
            <strong>Margin ${formatBasisCurrency(row.margin, basis, 1)}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderProductTable(rows) {
  if (!rows.length) {
    elements.productTable.innerHTML = `<p class="empty">No product records match these filters.</p>`;
    return;
  }
  const scenario = SCENARIOS[state.filters.scenario];
  const totalSelected = rows.reduce((sumValue, row) => sumValue + (row.priced ? row[`${state.filters.scenario}Cost`] || 0 : 0), 0);
  const grouped = Array.from(
    rows.reduce((map, row) => {
      const key = `${row.domain}:${row.product}`;
      const current = map.get(key) || {
        domain: row.domainLabel,
        product: row.product,
        records: 0,
        quantity: 0,
        quantityUnit: row.quantityUnit,
        unpricedRecords: 0,
        lowTotal: 0,
        centralTotal: 0,
        highTotal: 0,
        price: row.price,
      };
      current.records += 1;
      current.quantity += row.quantity || 0;
      if (row.priced) {
        current.lowTotal += row.lowCost || 0;
        current.centralTotal += row.centralCost || 0;
        current.highTotal += row.highCost || 0;
      } else {
        current.unpricedRecords += 1;
      }
      map.set(key, current);
      return map;
    }, new Map()).values()
  ).sort((a, b) => (b[scenario.totalKey] || 0) - (a[scenario.totalKey] || 0) || a.product.localeCompare(b.product));

  elements.productTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Product</th>
          <th>Records</th>
          <th>Quantity</th>
          <th>Low price</th>
          <th>Central price</th>
          <th>High price</th>
          <th>${scenario.label} expenditure</th>
          <th>Share</th>
          <th>Price basis</th>
        </tr>
      </thead>
      <tbody>
        ${grouped.map((row) => {
          const selected = row[scenario.totalKey] || 0;
          const price = row.price || {};
          return `
            <tr class="${row.unpricedRecords ? "is-unpriced" : ""}">
              <td>${escapeHtml(row.domain)}</td>
              <td>${escapeHtml(row.product)}</td>
              <td>${formatNumber(row.records, 0)}</td>
              <td>${formatNumber(row.quantity, 2)} ${escapeHtml(row.quantityUnit || "")}</td>
              <td>${formatPrice(price.low, price.priceUnit)}</td>
              <td>${formatPrice(price.central, price.priceUnit)}</td>
              <td>${formatPrice(price.high, price.priceUnit)}</td>
              <td>${row.unpricedRecords === row.records ? "Unpriced" : formatCurrency(selected, 0)}</td>
              <td>${totalSelected ? formatNumber((selected / totalSelected) * 100, 1) : "0.0"}%</td>
              <td>${escapeHtml(price.basisConfidence || "No price assigned")}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderRevenueTable(revenueRows, costRows) {
  elements.revenueCount.textContent = `${revenueRows.length} farmer-years`;
  if (!revenueRows.length) {
    elements.revenueTable.innerHTML = `<p class="empty">No farmer-year revenue records match these filters.</p>`;
    return;
  }
  const scenario = SCENARIOS[state.filters.scenario];
  const basis = state.filters.basis;
  const costByDmu = new Map(costRows.map((row) => [row.dmu_id, row]));
  elements.revenueTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Farmer-year</th>
          <th>Campaign</th>
          <th>Varieties</th>
          <th>Price group</th>
          <th>Production</th>
          <th>${scenario.label} revenue ${BASIS[basis].label}</th>
          <th>${scenario.label} selected cost ${BASIS[basis].label}</th>
          <th>${scenario.label} margin ${BASIS[basis].label}</th>
          <th>Proxy price notes</th>
        </tr>
      </thead>
      <tbody>
        ${revenueRows.map((row) => {
          const costs = costByDmu.get(row.dmu_id);
          const revenue = revenueBasisValue(row, `${state.filters.scenario}Revenue`, basis);
          const cost = costs ? basisValue(costs, scenario.totalKey, basis) : 0;
          const margin = Number.isFinite(revenue) && Number.isFinite(cost) ? revenue - cost : null;
          return `
            <tr>
              <td>${escapeHtml(row.dmu_id)}</td>
              <td>${escapeHtml(row.campaigns || "-")}</td>
              <td>${escapeHtml(row.varieties || "-")}</td>
              <td>${escapeHtml(row.priceGroups || "-")}</td>
              <td>${formatNumber(row.productionT, 1)} t</td>
              <td>${formatCurrency(revenue, 1)}</td>
              <td>${formatCurrency(cost, 1)}</td>
              <td>${formatCurrency(margin, 1)}</td>
              <td>${row.proxies ? escapeHtml(row.proxies) : "-"}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderDetailTable(rows) {
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">No farmer-year expenditure records match these filters.</p>`;
    return;
  }
  const sorted = [...rows].sort((a, b) => a.year - b.year || naturalCompare(a.dmu_id, b.dmu_id));
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Farmer-year</th>
          <th>Area</th>
          <th>Yield</th>
          <th>Low EUR/ha</th>
          <th>Central EUR/ha</th>
          <th>High EUR/ha</th>
          <th>Low EUR/t</th>
          <th>Central EUR/t</th>
          <th>High EUR/t</th>
          <th>Records priced</th>
          <th>Unpriced products</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((row) => `
          <tr>
            <td>${escapeHtml(row.dmu_id)}</td>
            <td>${formatNumber(row.areaHa, 2)} ha</td>
            <td>${formatNumber(row.yieldTHa, 2)} t/ha</td>
            <td>${formatCurrency(basisValue(row, "lowTotal", "ha"), 1)}</td>
            <td>${formatCurrency(basisValue(row, "centralTotal", "ha"), 1)}</td>
            <td>${formatCurrency(basisValue(row, "highTotal", "ha"), 1)}</td>
            <td>${formatCurrency(basisValue(row, "lowTotal", "tonne"), 1)}</td>
            <td>${formatCurrency(basisValue(row, "centralTotal", "tonne"), 1)}</td>
            <td>${formatCurrency(basisValue(row, "highTotal", "tonne"), 1)}</td>
            <td>${row.pricedRecords}/${row.records}</td>
            <td>${row.unpricedProducts.length ? escapeHtml(row.unpricedProducts.join("; ")) : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function basisValue(row, totalKey, basis) {
  const denominator = row[BASIS[basis].denominator];
  if (!Number.isFinite(row[totalKey]) || !denominator) return null;
  return row[totalKey] / denominator;
}

function revenueBasisValue(row, revenueKey, basis) {
  if (!Number.isFinite(row[revenueKey])) return null;
  const denominator = basis === "ha" ? row.areaHa : row.productionT;
  if (!denominator) return null;
  return row[revenueKey] / denominator;
}

function isPriced(price) {
  return Boolean(price && Number.isFinite(price.low) && Number.isFinite(price.central) && Number.isFinite(price.high));
}

function fillSelect(select, values, allValue, allLabel) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = allValue;
  all.textContent = allLabel;
  select.appendChild(all);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function statCard(stat) {
  return `
    <div class="stat">
      <small>${stat.label}</small>
      <strong>${stat.value}</strong>
      <span>${stat.sub}</span>
    </div>
  `;
}

function canonicalProduct(value) {
  const raw = String(value || "").trim();
  if (raw === "20-20-00") return "20-20-0";
  if (raw === "40-20-0") return "40-20-00";
  return raw;
}

function operationLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number.isFinite(row[key]) ? row[key] : 0), 0);
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percent(value, total) {
  return total ? `${formatNumber((value / total) * 100, 0)}%` : "0%";
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && `${value}`.trim() !== "")));
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function addQuantity(map, unit, value) {
  const key = unit || "unit";
  map.set(key, (map.get(key) || 0) + value);
}

function formatQuantityMap(map) {
  const parts = Array.from(map.entries())
    .filter(([, value]) => value)
    .map(([unit, value]) => `${formatNumber(value, 1)} ${unit}`);
  return parts.length ? parts.join("; ") : "-";
}

function formatUnpricedQuantity(rows) {
  const totals = new Map();
  rows.forEach((row) => {
    row.unpricedQuantityByUnit.forEach((value, unit) => addQuantity(totals, unit, value));
  });
  return formatQuantityMap(totals);
}

function formatCurrency(value, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return `${formatNumber(value, digits)} EUR`;
}

function formatBasisCurrency(value, basis, digits = 1) {
  if (!Number.isFinite(value)) return "-";
  return `${formatNumber(value, digits)} ${BASIS[basis].label}`;
}

function formatPrice(value, unit = "") {
  if (!Number.isFinite(value)) return "-";
  return `${formatNumber(value, 2)} ${unit || ""}`.trim();
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
