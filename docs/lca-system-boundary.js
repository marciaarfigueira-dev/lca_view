import { loadCsv, toNumber } from "./pivot-data.js";

const state = {
  crop: [],
  fertilisation: [],
  machines: [],
  sowing: [],
  fieldEmissions: [],
};

const elements = {
  title: document.getElementById("boundary-detail-title"),
  eyebrow: document.getElementById("boundary-detail-eyebrow"),
  note: document.getElementById("boundary-detail-note"),
  content: document.getElementById("boundary-detail-content"),
  nodes: Array.from(document.querySelectorAll("[data-boundary-key]")),
};

const VARIETY_LABELS = {
  carnaroli: "Carnaroli",
  caravela: "Caravela",
  corimbo: "Corimbo",
  diva: "Diva PV",
  "diva pv": "Diva PV",
  elettra: "Elettra",
  formula: "Formula PV",
  "formula pv": "Formula PV",
  gladio: "Gládio",
  iberico: "Ibérico",
  jsendra: "JSendra",
  leonardo: "Leonardo",
  luna: "Luna CL",
  "luna cl": "Luna CL",
  pvl: "PVL136IT",
  "pvl 136 it": "PVL136IT",
  "pvl 136it": "PVL136IT",
  "pvl136 it": "PVL136IT",
  pvl136it: "PVL136IT",
  "provisi pvl a": "PVL136IT",
  ronaldo: "Ronaldo",
  selenio: "Selénio",
  sintra: "Sintra",
  sprint: "Sprint",
  telemaco: "Telemaco",
  velox: "Velox",
};

const OPERATION_LABELS = {
  "adubacao fundo": "Basal fertilisation",
  "basal fertilisation": "Basal fertilisation",
  "adubacao cobertura": "Top-dressing fertilisation",
  topdressing: "Top-dressing fertilisation",
  fertilisation: "Fertilisation",
  "fertiliser integration": "Fertiliser integration",
  herbicide: "Herbicide application",
  fungicide: "Fungicide application",
  pesticide: "Pesticide application",
  "crop protection": "Crop-protection application",
  colheita: "Harvest",
  harvest: "Harvest",
  sementeira: "Broadcast sowing",
  "broadcast sowing": "Broadcast sowing",
  "sementeira linha": "Row sowing",
  "row sowing": "Row sowing",
  levelling: "Levelling",
  scarifier: "Scarifying",
  "straw integration": "Straw integration",
  "disk harrow x2": "Disk harrow x2",
  "disk harrow x3": "Disk harrow x3",
};

const EQUIPMENT_LABELS = {
  "airplane sprayer": "Aerial sprayer",
  "centrifugal spreader": "Centrifugal spreader",
  "combine harvester": "Combine harvester",
  "disk harrow": "Disk harrow",
  "laser leveler": "Laser leveller",
  "rotary tiller": "Rotary tiller",
  seeder: "Seeder",
  sprayer: "Field sprayer",
};

const STATIC_COMPONENTS = {
  irrigation: {
    eyebrow: "Reported but excluded from interpreted LCA",
    title: "Irrigation records",
    note:
      "The notebooks contained irrigation fields, but they did not provide measured farmer-year water delivery, effective crop water consumption, flooding duration, drainage or irrigation efficiency. Irrigation is therefore shown as a record domain, not as a retained foreground LCA flow.",
    rows: [
      ["Recorded", "Irrigated area, irrigation method, planned or seasonal allocation"],
      ["Not resolved", "Measured delivery, crop consumption, seepage, drainage, runoff and flooding duration"],
      ["LCA treatment", "Excluded from interpreted foreground irrigation results"],
    ],
  },
  methane: {
    eyebrow: "Foreground field emission",
    title: "Methane from flooded rice",
    note:
      "CH4 was calculated as a common per-hectare foreground flow because farmer-specific flooding duration, drainage events and pre-season water regime were not consistently available.",
    rows: [
      ["Reference flow", "kg CH4 per hectare and per tonne"],
      ["Farmer-year variation", "Per hectare: common factor; per tonne: varies through realised yield"],
      ["Main limitation", "No farmer-specific flooding or drainage regime"],
    ],
  },
  "direct-n2o": {
    eyebrow: "Foreground field emission",
    title: "Direct N2O",
    note:
      "Direct N2O was calculated from reconstructed synthetic N inputs and a common crop-residue N assumption.",
    rows: [
      ["Reference flow", "kg N2O per hectare and per tonne"],
      ["Varies with", "Synthetic N input reconstructed from fertiliser records"],
      ["Main limitation", "Crop uptake, soil condition and measured N losses were unavailable"],
    ],
  },
  "indirect-n2o": {
    eyebrow: "Foreground field emission",
    title: "Indirect N2O",
    note:
      "Indirect N2O represented volatilisation and leaching/runoff pathways from fertiliser N inputs using generic IPCC parameters.",
    rows: [
      ["Volatilisation", "Fertiliser-specific N form where identifiable"],
      ["Leaching/runoff", "Generic potential loss factor"],
      ["Main limitation", "No measured drainage, runoff or nitrogen-loss data"],
    ],
  },
  "urea-co2": {
    eyebrow: "Foreground field emission",
    title: "CO2 from urea hydrolysis",
    note:
      "CO2 from urea hydrolysis was calculated where urea or urea-equivalent fertiliser mass could be reconstructed.",
    rows: [
      ["Reference flow", "kg CO2 per hectare and per tonne"],
      ["Varies with", "Recorded or reconstructed urea-equivalent fertiliser mass"],
      ["Main limitation", "Commercial mixtures required product-composition interpretation"],
    ],
  },
  straw: {
    eyebrow: "Farm output and residue assumption",
    title: "Rice straw and residues",
    note:
      "Straw was not treated as a co-product because removal, sale or alternative use was not consistently documented. Residue N was included only as a common field-emission assumption.",
    rows: [
      ["Co-product allocation", "Not applied"],
      ["Field emissions", "Common residue-N assumption for N2O"],
      ["Missing information", "Farmer-specific straw quantity, destination and management timing"],
    ],
  },
  "functional-units": {
    eyebrow: "Reference-flow scaling",
    title: "Functional-unit scaling",
    note:
      "The same farmer-year inventory was expressed per hectare and per tonne of harvested paddy rice.",
    rows: [
      ["Per hectare", "Land-based pressure associated with cultivated area"],
      ["Per tonne", "Output-normalised burden using realised farmer-year yield"],
      ["Interpretation", "The two bases answer different questions and are not converted into a single score"],
    ],
  },
  downstream: {
    eyebrow: "Outside system boundary",
    title: "Downstream use and end-of-life",
    note:
      "Drying, milling, packaging, distribution, consumption, product use and end-of-life pathways were outside the interpreted cradle-to-farm-gate boundary.",
    rows: [
      ["Included", "No"],
      ["Reason", "The study focused on farm-gate paddy-rice production reconstructed from farm notebooks"],
      ["Shown in map", "Context only"],
    ],
  },
};

init();

async function init() {
  const [crop, fertilisation, machines, sowing, fieldEmissions] = await Promise.all([
    loadCsv("./data/clean_lca/crop_protection/inventory/crop_protection_inventory_by_operation.csv"),
    loadCsv("./data/pivot_tables/operations_mastersheet - FERTILISATION.csv"),
    loadCsv("./data/clean_lca/machines/inventory/machines_inventory_by_operation.csv"),
    loadCsv("./data/clean_lca/sowing/inventory/sowing_inventory_by_operation.csv"),
    loadCsv("./data/clean_lca/field_emissions/inventory/field_emissions_inventory_by_dmu.csv"),
  ]);
  Object.assign(state, { crop, fertilisation, machines, sowing, fieldEmissions });
  elements.nodes.forEach((node) => {
    node.addEventListener("click", () => renderComponent(node.dataset.boundaryKey));
  });
  renderComponent("crop-protection");
}

function renderComponent(key) {
  elements.nodes.forEach((node) => node.classList.toggle("active", node.dataset.boundaryKey === key));
  const component = buildComponent(key);
  elements.eyebrow.textContent = component.eyebrow;
  elements.title.textContent = component.title;
  elements.note.textContent = component.note;
  elements.content.innerHTML = component.html;
}

function buildComponent(key) {
  if (STATIC_COMPONENTS[key]) return staticComponent(STATIC_COMPONENTS[key]);
  if (key === "crop-protection") return cropProtectionSupply();
  if (key === "herbicides") return cropProtectionGroup("herbicide", "Herbicides applied");
  if (key === "fungicides") return cropProtectionGroup("fungicide", "Fungicides applied");
  if (key === "insecticides") return cropProtectionGroup("insecticide", "Insecticides applied");
  if (key === "fertilisers") return fertiliserProduction();
  if (key === "nitrogen") return nutrientComponent("n_kg_ha_weight", "N applied", "kg N/ha");
  if (key === "phosphorus") return nutrientComponent("p_kg_ha_weight", "P2O5 applied", "kg P2O5/ha");
  if (key === "potassium") return nutrientComponent("k_kg_ha_weight", "K2O applied", "kg K2O/ha");
  if (key === "field-operations") return machineryComponent("Field operations");
  if (key === "seeds") return seedComponent("Seed production");
  if (key === "seed-inputs") return seedComponent("Seeds applied");
  if (key === "paddy-output") return paddyOutput();
  return staticComponent({
    eyebrow: "System component",
    title: "Component not mapped",
    note: "No detail table is currently attached to this component.",
    rows: [],
  });
}

function cropProtectionSupply() {
  return {
    eyebrow: "Background process and field-emission mapping",
    title: "Crop-protection product supply",
    note:
      "Crop-protection products were grouped as herbicides, fungicides or insecticides and translated into active-substance inputs. Click a specific product type in the map to inspect the products and active substances.",
    html: [
      summaryCards([
        ["Products", unique(state.crop.map((row) => row.product)).length],
        ["Active substances", unique(state.crop.map((row) => row.active_substance)).length],
        ["Operation rows", state.crop.length],
      ]),
      tableHtml(["Group", "Products", "Active substances", "Records"], groupCropByFactor()),
    ].join(""),
  };
}

function cropProtectionGroup(group, title) {
  const rows = state.crop.filter((row) => cropProtectionDisplayGroup(row) === group);
  const grouped = groupRows(rows, (row) => `${row.product}||${row.active_substance}`).map((entry) => {
    const [product, active] = entry.key.split("||");
    return [
      product || "-",
      active || "-",
      formatYears(entry.rows),
      unique(entry.rows.map((row) => row.farmer_id)).length,
      formatNumber(sum(entry.rows, "active_substance_kg_total"), 2),
    ];
  });
  return {
    eyebrow: "Foreground crop-protection input",
    title,
    note:
      "These are the products and active substances used in the retained records. They represent intervention intensity, not measured pest pressure or treatment effectiveness.",
    html: [
      summaryCards([
        ["Products", unique(rows.map((row) => row.product)).length],
        ["Active substances", unique(rows.map((row) => row.active_substance)).length],
        ["Total active substance", `${formatNumber(sum(rows, "active_substance_kg_total"), 1)} kg`],
      ]),
      tableHtml(["Product", "Active substance", "Years", "Farmers", "kg a.i. total"], grouped),
    ].join(""),
  };
}

function fertiliserProduction() {
  const grouped = groupRows(state.fertilisation, (row) => row.product).map((entry) => [
    entry.key || "-",
    unique(entry.rows.map((row) => displayOperation(row.operation))).join("; "),
    formatYears(entry.rows),
    entry.rows.length,
    formatNumber(sum(entry.rows, "n_kg_ha_weight"), 1),
    formatNumber(sum(entry.rows, "p_kg_ha_weight"), 1),
    formatNumber(sum(entry.rows, "k_kg_ha_weight"), 1),
  ]);
  return {
    eyebrow: "Background fertiliser production",
    title: "Fertiliser production and nutrient-equivalent inputs",
    note:
      "Commercial fertiliser products were converted into nutrient-equivalent N, P2O5 and K2O inputs where product composition was available or could be reconstructed.",
    html: tableHtml(["Product", "Operations", "Years", "Records", "sum kg N/ha", "sum kg P2O5/ha", "sum kg K2O/ha"], grouped),
  };
}

function nutrientComponent(column, title, unit) {
  const rows = state.fertilisation.filter((row) => (toNumber(row[column]) || 0) > 0);
  const grouped = groupRows(rows, (row) => row.product).map((entry) => [
    entry.key || "-",
    unique(entry.rows.map((row) => displayOperation(row.operation))).join("; "),
    formatYears(entry.rows),
    entry.rows.length,
    formatNumber(sum(entry.rows, column), 1),
  ]);
  return {
    eyebrow: "Foreground nutrient input",
    title,
    note:
      "The values summarise retained fertilisation records. They indicate reconstructed nutrient application intensity, not crop uptake, nutrient surplus or measured field losses.",
    html: tableHtml(["Product", "Operations", "Years", "Records", `sum ${unit}`], grouped),
  };
}

function machineryComponent(title) {
  const grouped = groupRows(state.machines, (row) => `${displayOperation(row.operation)}||${displayEquipment(row.equipment)}`).map((entry) => {
    const [operation, equipment] = entry.key.split("||");
    return [
      operation || "-",
      equipment || "-",
      formatYears(entry.rows),
      entry.rows.length,
      formatNumber(sum(entry.rows, "ha_worked_total"), 1),
    ];
  });
  return {
    eyebrow: "On-farm field-operation records",
    title,
    note:
      "Field operations were represented as operated area by standardised operation. This view is kept inside the on-farm foreground activity boundary. The records did not contain measured fuel use, tractor power, speed, load or field efficiency.",
    html: tableHtml(["Operation", "Equipment", "Years", "Records", "ha worked total"], grouped),
  };
}

function seedComponent(title) {
  const grouped = groupRows(state.sowing, (row) => displayVariety(row.variety)).map((entry) => [
    entry.key || "-",
    unique(entry.rows.map((row) => displayOperation(row.operation))).join("; "),
    unique(entry.rows.map((row) => displayEquipment(row.equipment))).join("; "),
    formatYears(entry.rows),
    entry.rows.length,
    formatNumber(sum(entry.rows, "seed_kg_total"), 1),
  ]);
  return {
    eyebrow: "Seed input and sowing records",
    title,
    note:
      "Seed inputs were reconstructed from sowing records and mapped to a rice seed/start-material background process. Germination, establishment success and seed losses were not observed.",
    html: tableHtml(["Variety", "Sowing operations", "Equipment", "Years", "Records", "kg seed total"], grouped),
  };
}

function paddyOutput() {
  const uniqueDmus = groupRows(state.fieldEmissions, (row) => row.dmu_id).map((entry) => entry.rows[0]);
  const rows = groupRows(uniqueDmus, (row) => formatYear(row.year)).map((entry) => [
    formatYear(entry.key),
    entry.rows.length,
    formatNumber(sum(entry.rows, "area_ha"), 1),
    formatNumber(sumProduction(entry.rows), 1),
    formatNumber(weightedYield(entry.rows), 2),
  ]);
  return {
    eyebrow: "Farm-gate output",
    title: "Paddy rice production",
    note:
      "Paddy rice is the sole reference product. Straw and functional-unit scaling are interpreted inside this output definition rather than as separate output blocks.",
    html: [
      tableHtml(
        ["Output element", "LCA treatment"],
        [
          ["Paddy rice", "Sole reference product at the farm gate."],
          ["Rice straw and residues", "Not treated as a co-product because removal, sale or alternative use was not consistently documented. Residue N is represented only through the field-emission assumption."],
          ["Functional units", "Results are expressed per hectare of cultivated rice and per tonne of harvested paddy rice."],
        ]
      ),
      tableHtml(["Year", "Farmer-years", "Area ha", "Production t", "Weighted yield t/ha"], rows),
    ].join(""),
  };
}

function groupCropByFactor() {
  return ["herbicide", "fungicide", "insecticide"].map((group) => {
    const rows = state.crop.filter((row) => cropProtectionDisplayGroup(row) === group);
    return [
      titleCase(group),
      unique(rows.map((row) => row.product)).length,
      unique(rows.map((row) => row.active_substance)).length,
      rows.length,
    ];
  });
}

function staticComponent(component) {
  return {
    eyebrow: component.eyebrow,
    title: component.title,
    note: component.note,
    html: tableHtml(["Aspect", "Boundary decision"], component.rows || []),
  };
}

function summaryCards(items) {
  return `<div class="boundary-summary-grid">${items
    .map(([label, value]) => `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`)
    .join("")}</div>`;
}

function tableHtml(headers, rows) {
  if (!rows.length) return `<p class="empty-state">No records available for this component.</p>`;
  return `
    <div class="boundary-table-shell">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function groupRows(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row) || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return Array.from(map.entries())
    .map(([key, groupedRows]) => ({ key, rows: groupedRows }))
    .sort((a, b) => naturalCompare(a.key, b.key));
}

function sum(rows, column) {
  return rows.reduce((total, row) => total + (toNumber(row[column]) || 0), 0);
}

function sumProduction(rows) {
  return rows.reduce((total, row) => {
    const area = toNumber(row.area_ha) || 0;
    const yieldValue = toNumber(row.productivity_t_ha) || 0;
    return total + area * yieldValue;
  }, 0);
}

function weightedYield(rows) {
  const area = sum(rows, "area_ha");
  return area ? sumProduction(rows) / area : null;
}

function displayVariety(value) {
  const key = normaliseKey(value);
  return VARIETY_LABELS[key] || String(value || "").trim() || "-";
}

function displayOperation(value) {
  const key = normaliseKey(value);
  return OPERATION_LABELS[key] || titleCase(String(value || "").replace(/_/g, " "));
}

function displayEquipment(value) {
  const key = normaliseKey(value);
  return EQUIPMENT_LABELS[key] || titleCase(String(value || "").replace(/_/g, " "));
}

function formatYears(rows) {
  return unique(rows.map((row) => formatYear(row.year))).sort(naturalCompare).join(", ");
}

function formatYear(value) {
  const number = toNumber(value);
  if (Number.isFinite(number)) return String(Math.trunc(number));
  return String(value || "").trim();
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && `${value}`.trim() !== "")));
}

function cropProtectionDisplayGroup(row) {
  const value = clean(row.factor_group || row.operation_label);
  if (value.includes("insecticide") || value === "pesticide") return "insecticide";
  if (value.includes("fungicide")) return "fungicide";
  if (value.includes("herbicide")) return "herbicide";
  return value;
}

function normaliseKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (char) => char.toUpperCase());
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return "-";
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
