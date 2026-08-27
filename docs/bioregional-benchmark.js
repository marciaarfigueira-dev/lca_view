import { loadCsv, toNumber } from "./pivot-data.js";

const LCA_SOURCES = [
  { key: "crop_protection", label: "Crop protection", totalColumn: "crop_protection_total_impact" },
  { key: "sowing", label: "Sowing", totalColumn: "sowing_total_impact" },
  { key: "fertilisation", label: "Fertilisation", totalColumn: "fertilisation_total_impact" },
  { key: "machines", label: "Machinery", totalColumn: "machines_total_impact" },
  { key: "field_emissions", label: "Field emissions", totalColumn: "field_emissions_impact" },
];

const DOMAIN_LABELS = {
  productivity: "Productivity",
  nitrogen: "Nitrogen",
  phosphorus: "Phosphorus",
  potassium: "Potassium",
  crop_protection: "Crop protection",
  mechanisation: "Mechanisation",
  lca_profile: "Environmental profile",
};

const DOMAIN_NOTES = {
  productivity: "Yield mediates all environmental results expressed per tonne.",
  nitrogen: "Nitrogen indicators link fertiliser input to nitrogen-related climate, acidification, and eutrophication outcomes.",
  phosphorus: "Phosphorus indicators separate P fertiliser input from nitrogen management and from the phosphorus-equivalent eutrophication unit.",
  potassium: "Potassium indicators show K fertiliser input and its associated production impacts separately from nitrogen and phosphorus.",
  crop_protection: "This domain links active-ingredient pressure with characterised freshwater ecotoxicity and human-toxicity outcomes.",
  mechanisation: "Mechanisation compares operation intensity with machinery-related impact categories.",
  lca_profile: "The profile contrasts land-based and output-normalised environmental results across selected impact categories. Water-use values refer to background-process water use, not measured irrigation demand.",
};

const state = {
  records: [],
  lca: new Map(),
  filters: {
    view: "profile",
    farmer: "",
    year: "",
    reference: "both",
    domain: "all",
    profileIndicator: "all",
    regionalIndicator: "",
  },
};

const elements = {
  view: document.getElementById("view-filter"),
  farmer: document.getElementById("farmer-filter"),
  year: document.getElementById("year-filter"),
  reference: document.getElementById("reference-filter"),
  domain: document.getElementById("domain-filter"),
  profileIndicator: document.getElementById("profile-indicator-filter"),
  regionalIndicator: document.getElementById("regional-indicator-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  profileCount: document.getElementById("profile-count"),
  profileBlocks: document.getElementById("profile-blocks"),
  regionalCount: document.getElementById("regional-count"),
  regionalSummary: document.getElementById("regional-summary"),
  regionalChart: document.getElementById("regional-chart"),
  detailCount: document.getElementById("detail-count"),
  detailTable: document.getElementById("detail-table"),
  viewPanels: Array.from(document.querySelectorAll("[data-view-panel]")),
};

init();

async function init() {
  const [fertilisation, cropProtection, machines] = await Promise.all([
    loadCsv("./data/clean_lca/fertilisation/inventory/fertilisation_inventory_by_dmu.csv"),
    loadCsv("./data/clean_lca/crop_protection/inventory/crop_protection_inventory_by_dmu.csv"),
    loadCsv("./data/clean_lca/machines/inventory/machines_inventory_by_dmu.csv"),
  ]);
  await loadLcaRows();

  const map = new Map();
  fertilisation.forEach((row) => mergeRecord(map, row, {
    n_kg_ha: toNumber(row.n_kg_ha),
    n_kg_tonne: toNumber(row.n_kg_tonne),
    p_kg_ha: toNumber(row.p_kg_ha),
    p_kg_tonne: toNumber(row.p_kg_tonne),
    k_kg_ha: toNumber(row.k_kg_ha),
    k_kg_tonne: toNumber(row.k_kg_tonne),
  }));
  cropProtection.forEach((row) => {
    const herbHa = toNumber(row.herbicide_kg_ha) || 0;
    const fungHa = toNumber(row.fungicide_kg_ha) || 0;
    const pestHa = toNumber(row.pesticide_kg_ha) || 0;
    const herbTonne = toNumber(row.herbicide_kg_tonne) || 0;
    const fungTonne = toNumber(row.fungicide_kg_tonne) || 0;
    const pestTonne = toNumber(row.pesticide_kg_tonne) || 0;
    const area = toNumber(row.area_ha);
    const production = toNumber(row.production_t);
    mergeRecord(map, row, {
      area_ha: area,
      production_t: production,
      yield_t_ha: area && production ? production / area : null,
      active_ingredient_kg_ha: herbHa + fungHa + pestHa,
      active_ingredient_kg_tonne: herbTonne + fungTonne + pestTonne,
    });
  });
  machines.forEach((row) => mergeRecord(map, row, {
    machine_worked_ha_per_ha: sumMatching(row, "_ha_worked_per_ha"),
    machine_worked_ha_per_tonne: sumMatching(row, "_ha_worked_per_tonne"),
  }));

  state.records = Array.from(map.values()).sort((a, b) => a.dmu_id.localeCompare(b.dmu_id));
  hydrateFilters();
  attachEvents();
  render();
}

async function loadLcaRows() {
  const tasks = LCA_SOURCES.flatMap((source) =>
    ["ha", "tonne"].map(async (basis) => {
      const path = `./data/clean_lca/${source.key}/characterisation/${source.key}_characterisation_by_dmu_${basis}.csv`;
      const rows = await loadCsv(path);
      rows.forEach((row) => addLcaRow(source, row));
    })
  );
  await Promise.all(tasks);
}

function mergeRecord(map, row, values) {
  const dmuId = row.dmu_id || "";
  if (!dmuId) return;
  const current = map.get(dmuId) || {
    dmu_id: dmuId,
    farmer_id: row.farmer_id || dmuId.replace(/_\d{4}$/, ""),
    year: String(row.year || ""),
  };
  Object.assign(current, values);
  map.set(dmuId, current);
}

function sumMatching(row, suffix) {
  return Object.entries(row)
    .filter(([key]) => key.endsWith(suffix))
    .reduce((sum, [, value]) => sum + (toNumber(value) || 0), 0);
}

function addLcaRow(source, row) {
  const dmuId = row.dmu_id || "";
  const basis = row.basis || "";
  const category = row.impact_category || "";
  if (!dmuId || !basis || !category || category === "Total") return;

  const key = lcaKey(dmuId, basis, category);
  const current = state.lca.get(key) || { unit: row.impact_unit || "", entries: [] };
  if (!current.unit && row.impact_unit) current.unit = row.impact_unit;
  componentEntries(source, row).forEach((entry) => {
    if (!Number.isFinite(entry.value)) return;
    current.entries.push(entry);
  });
  state.lca.set(key, current);
}

function componentEntries(source, row) {
  if (source.key === "crop_protection") {
    return [
      componentEntry(source.label, "Herbicides", row.herbicide_impact),
      componentEntry(source.label, "Fungicides", row.fungicide_impact),
      componentEntry(source.label, "Insecticides", row.pesticide_impact),
    ];
  }
  if (source.key === "fertilisation") {
    return [
      componentEntry(source.label, "Nitrogen fertiliser", row.n_impact),
      componentEntry(source.label, "Phosphorus fertiliser", row.p_impact),
      componentEntry(source.label, "Potassium fertiliser", row.k_impact),
    ];
  }
  if (source.key === "machines") {
    return Object.entries(row)
      .filter(([key]) => key.endsWith("_impact") && key !== source.totalColumn)
      .map(([key, value]) => componentEntry(source.label, titleCase(key.replace(/_impact$/, "")), value));
  }
  if (source.key === "field_emissions") {
    return [componentEntry(source.label, fieldEmissionLabel(row), row[source.totalColumn])];
  }
  return [componentEntry(source.label, source.label, row[source.totalColumn])];
}

function componentEntry(group, label, value) {
  return { group, label, value: toNumber(value) || 0 };
}

function fieldEmissionLabel(row) {
  const component = String(row.component || "").toLowerCase();
  const gas = String(row.gas || "").toLowerCase();
  if (gas === "ch4" || component.includes("ch4")) return "Flooded-field methane";
  if (component.includes("straw")) return "Straw N2O";
  if (component.includes("volatilisation")) return "Indirect N2O volatilisation";
  if (component.includes("leaching")) return "Indirect N2O leaching";
  if (component.includes("direct")) return "Direct N2O fertiliser";
  if (gas === "co2" || component.includes("urea")) return "Urea CO2";
  if (gas === "n2o") return "N2O emissions";
  return "Other field emissions";
}

function titleCase(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lcaKey(dmuId, basis, category) {
  return `${dmuId}||${basis}||${category}`;
}

const INDICATORS = [
  {
    key: "yield_t_ha",
    domain: "productivity",
    label: "Yield",
    unit: "t/ha",
    value: (row) => row.yield_t_ha,
    interpretation: "Yield mediates every environmental result expressed per tonne.",
    regionalDefault: true,
  },
  {
    key: "n_kg_ha",
    domain: "nitrogen",
    label: "N input",
    unit: "kg N/ha",
    value: (row) => row.n_kg_ha,
    interpretation: "Land-based nitrogen pressure from fertilisation.",
    regionalDefault: true,
  },
  {
    key: "n_kg_tonne",
    domain: "nitrogen",
    label: "N input",
    unit: "kg N/t rice",
    value: (row) => row.n_kg_tonne,
    interpretation: "Nitrogen demand relative to output.",
  },
  impactIndicator("nitrogen_climate_ha", "nitrogen", "Nitrogen-related climate impact", "ha", "Climate change", ["Fertilisation", "Field emissions"], "kg CO2 eq/ha", "Climate burden from N fertiliser production, N2O pathways, straw N2O, and urea CO2; flooded-field methane is excluded.", true, nitrogenClimateFilter),
  impactIndicator("nitrogen_climate_tonne", "nitrogen", "Nitrogen-related climate impact", "tonne", "Climate change", ["Fertilisation", "Field emissions"], "kg CO2 eq/t", "Nitrogen-related climate burden relative to output; flooded-field methane is excluded.", false, nitrogenClimateFilter),
  impactIndicator("n_acidification_ha", "nitrogen", "N fertiliser acidification", "ha", "Acidification", ["Fertilisation"], "mol H+ eq/ha", "Acidification associated with nitrogen fertiliser production per hectare.", false, nutrientFilter("Nitrogen fertiliser")),
  impactIndicator("n_acidification_tonne", "nitrogen", "N fertiliser acidification", "tonne", "Acidification", ["Fertilisation"], "mol H+ eq/t", "Acidification associated with nitrogen fertiliser production per tonne.", false, nutrientFilter("Nitrogen fertiliser")),
  impactIndicator("n_eutrophication_fw_ha", "nitrogen", "N fertiliser freshwater eutrophication", "ha", "Eutrophication, freshwater", ["Fertilisation"], "kg P eq/ha", "Freshwater eutrophication potential associated with nitrogen fertiliser production per hectare.", false, nutrientFilter("Nitrogen fertiliser")),
  impactIndicator("n_eutrophication_fw_tonne", "nitrogen", "N fertiliser freshwater eutrophication", "tonne", "Eutrophication, freshwater", ["Fertilisation"], "kg P eq/t", "Freshwater eutrophication potential associated with nitrogen fertiliser production per tonne.", false, nutrientFilter("Nitrogen fertiliser")),
  {
    key: "p_kg_ha",
    domain: "phosphorus",
    label: "P fertiliser input",
    unit: "kg P2O5/ha",
    value: (row) => row.p_kg_ha,
    interpretation: "Land-based phosphorus fertiliser pressure.",
    regionalDefault: true,
  },
  {
    key: "p_kg_tonne",
    domain: "phosphorus",
    label: "P fertiliser input",
    unit: "kg P2O5/t rice",
    value: (row) => row.p_kg_tonne,
    interpretation: "Phosphorus fertiliser demand relative to output.",
  },
  impactIndicator("p_eutrophication_fw_ha", "phosphorus", "P fertiliser freshwater eutrophication", "ha", "Eutrophication, freshwater", ["Fertilisation"], "kg P eq/ha", "Freshwater eutrophication potential associated with phosphorus fertiliser production per hectare.", true, nutrientFilter("Phosphorus fertiliser")),
  impactIndicator("p_eutrophication_fw_tonne", "phosphorus", "P fertiliser freshwater eutrophication", "tonne", "Eutrophication, freshwater", ["Fertilisation"], "kg P eq/t", "Freshwater eutrophication potential associated with phosphorus fertiliser production per tonne.", false, nutrientFilter("Phosphorus fertiliser")),
  impactIndicator("p_climate_ha", "phosphorus", "P fertiliser climate impact", "ha", "Climate change", ["Fertilisation"], "kg CO2 eq/ha", "Climate burden associated with phosphorus fertiliser production per hectare.", false, nutrientFilter("Phosphorus fertiliser")),
  impactIndicator("p_climate_tonne", "phosphorus", "P fertiliser climate impact", "tonne", "Climate change", ["Fertilisation"], "kg CO2 eq/t", "Climate burden associated with phosphorus fertiliser production per tonne.", false, nutrientFilter("Phosphorus fertiliser")),
  impactIndicator("p_acidification_ha", "phosphorus", "P fertiliser acidification", "ha", "Acidification", ["Fertilisation"], "mol H+ eq/ha", "Acidification associated with phosphorus fertiliser production per hectare.", false, nutrientFilter("Phosphorus fertiliser")),
  impactIndicator("p_acidification_tonne", "phosphorus", "P fertiliser acidification", "tonne", "Acidification", ["Fertilisation"], "mol H+ eq/t", "Acidification associated with phosphorus fertiliser production per tonne.", false, nutrientFilter("Phosphorus fertiliser")),
  impactIndicator("p_resource_minerals_ha", "phosphorus", "P fertiliser mineral-resource use", "ha", "Resource use, minerals and metals", ["Fertilisation"], "kg Sb eq/ha", "Mineral-resource burden associated with phosphorus fertiliser production per hectare.", false, nutrientFilter("Phosphorus fertiliser")),
  impactIndicator("p_resource_minerals_tonne", "phosphorus", "P fertiliser mineral-resource use", "tonne", "Resource use, minerals and metals", ["Fertilisation"], "kg Sb eq/t", "Mineral-resource burden associated with phosphorus fertiliser production per tonne.", false, nutrientFilter("Phosphorus fertiliser")),
  {
    key: "k_kg_ha",
    domain: "potassium",
    label: "K fertiliser input",
    unit: "kg K2O/ha",
    value: (row) => row.k_kg_ha,
    interpretation: "Land-based potassium fertiliser pressure.",
    regionalDefault: true,
  },
  {
    key: "k_kg_tonne",
    domain: "potassium",
    label: "K fertiliser input",
    unit: "kg K2O/t rice",
    value: (row) => row.k_kg_tonne,
    interpretation: "Potassium fertiliser demand relative to output.",
  },
  impactIndicator("k_climate_ha", "potassium", "K fertiliser climate impact", "ha", "Climate change", ["Fertilisation"], "kg CO2 eq/ha", "Climate burden associated with potassium fertiliser production per hectare.", false, nutrientFilter("Potassium fertiliser")),
  impactIndicator("k_climate_tonne", "potassium", "K fertiliser climate impact", "tonne", "Climate change", ["Fertilisation"], "kg CO2 eq/t", "Climate burden associated with potassium fertiliser production per tonne.", false, nutrientFilter("Potassium fertiliser")),
  impactIndicator("k_acidification_ha", "potassium", "K fertiliser acidification", "ha", "Acidification", ["Fertilisation"], "mol H+ eq/ha", "Acidification associated with potassium fertiliser production per hectare.", false, nutrientFilter("Potassium fertiliser")),
  impactIndicator("k_acidification_tonne", "potassium", "K fertiliser acidification", "tonne", "Acidification", ["Fertilisation"], "mol H+ eq/t", "Acidification associated with potassium fertiliser production per tonne.", false, nutrientFilter("Potassium fertiliser")),
  impactIndicator("k_resource_minerals_ha", "potassium", "K fertiliser mineral-resource use", "ha", "Resource use, minerals and metals", ["Fertilisation"], "kg Sb eq/ha", "Mineral-resource burden associated with potassium fertiliser production per hectare.", false, nutrientFilter("Potassium fertiliser")),
  impactIndicator("k_resource_minerals_tonne", "potassium", "K fertiliser mineral-resource use", "tonne", "Resource use, minerals and metals", ["Fertilisation"], "kg Sb eq/t", "Mineral-resource burden associated with potassium fertiliser production per tonne.", false, nutrientFilter("Potassium fertiliser")),
  {
    key: "active_ingredient_kg_ha",
    domain: "crop_protection",
    label: "Active ingredient",
    unit: "kg/ha",
    value: (row) => row.active_ingredient_kg_ha,
    interpretation: "Chemical pressure applied per hectare.",
    regionalDefault: true,
  },
  {
    key: "active_ingredient_kg_tonne",
    domain: "crop_protection",
    label: "Active ingredient",
    unit: "kg/t rice",
    value: (row) => row.active_ingredient_kg_tonne,
    interpretation: "Chemical pressure relative to output.",
  },
  impactIndicator("crop_ecotox_fw_ha", "crop_protection", "Freshwater ecotoxicity", "ha", "Ecotoxicity, freshwater", ["Crop protection"], "CTUe/ha", "Toxicity burden from the crop-protection portfolio per hectare.", true),
  impactIndicator("crop_ecotox_fw_tonne", "crop_protection", "Freshwater ecotoxicity", "tonne", "Ecotoxicity, freshwater", ["Crop protection"], "CTUe/t", "Toxicity burden from the crop-protection portfolio per tonne."),
  impactIndicator("crop_human_tox_non_cancer_ha", "crop_protection", "Human toxicity, non-cancer", "ha", "Human toxicity, non-cancer", ["Crop protection"], "CTUh/ha", "Human-toxicity pressure associated with crop-protection inputs per hectare."),
  impactIndicator("crop_human_tox_non_cancer_tonne", "crop_protection", "Human toxicity, non-cancer", "tonne", "Human toxicity, non-cancer", ["Crop protection"], "CTUh/t", "Human-toxicity pressure associated with crop-protection inputs per tonne."),
  {
    key: "machine_worked_ha_per_ha",
    domain: "mechanisation",
    label: "Worked area intensity",
    unit: "ha worked/ha",
    value: (row) => row.machine_worked_ha_per_ha,
    interpretation: "Operational intensity per hectare.",
    regionalDefault: true,
  },
  {
    key: "machine_worked_ha_per_tonne",
    domain: "mechanisation",
    label: "Worked area intensity",
    unit: "ha worked/t rice",
    value: (row) => row.machine_worked_ha_per_tonne,
    interpretation: "Operational intensity relative to output.",
  },
  impactIndicator("machinery_fossils_ha", "mechanisation", "Fossil-resource use", "ha", "Resource use, fossils", ["Machinery"], "MJ/ha", "Machinery-related fossil-resource burden per hectare.", true),
  impactIndicator("machinery_fossils_tonne", "mechanisation", "Fossil-resource use", "tonne", "Resource use, fossils", ["Machinery"], "MJ/t", "Machinery-related fossil-resource burden per tonne."),
  impactIndicator("machinery_climate_ha", "mechanisation", "Machinery climate impact", "ha", "Climate change", ["Machinery"], "kg CO2 eq/ha", "Climate burden from machinery operations per hectare."),
  impactIndicator("machinery_climate_tonne", "mechanisation", "Machinery climate impact", "tonne", "Climate change", ["Machinery"], "kg CO2 eq/t", "Climate burden from machinery operations per tonne."),
  impactIndicator("machinery_ionising_ha", "mechanisation", "Ionising radiation", "ha", "Ionising radiation", ["Machinery"], "kBq U-235 eq/ha", "Machinery-related ionising-radiation indicator per hectare."),
  impactIndicator("machinery_ionising_tonne", "mechanisation", "Ionising radiation", "tonne", "Ionising radiation", ["Machinery"], "kBq U-235 eq/t", "Machinery-related ionising-radiation indicator per tonne."),
  impactIndicator("profile_climate_ha", "lca_profile", "Climate change", "ha", "Climate change", null, "kg CO2 eq/ha", "Land-based climate result. Limited differentiation is expected where methane dominates.", true),
  impactIndicator("profile_climate_tonne", "lca_profile", "Climate change", "tonne", "Climate change", null, "kg CO2 eq/t", "Output-normalised climate result; differences mostly reflect yield when methane dominates."),
  impactIndicator("profile_ecotox_fw_ha", "lca_profile", "Freshwater ecotoxicity", "ha", "Ecotoxicity, freshwater", null, "CTUe/ha", "Land-based freshwater ecotoxicity across all modelled sources."),
  impactIndicator("profile_ecotox_fw_tonne", "lca_profile", "Freshwater ecotoxicity", "tonne", "Ecotoxicity, freshwater", null, "CTUe/t", "Output-normalised freshwater ecotoxicity across all modelled sources."),
  impactIndicator("profile_human_tox_ha", "lca_profile", "Human toxicity, non-cancer", "ha", "Human toxicity, non-cancer", null, "CTUh/ha", "Land-based human-toxicity result across all modelled sources."),
  impactIndicator("profile_human_tox_tonne", "lca_profile", "Human toxicity, non-cancer", "tonne", "Human toxicity, non-cancer", null, "CTUh/t", "Output-normalised human-toxicity result across all modelled sources."),
  impactIndicator("profile_fossils_ha", "lca_profile", "Fossil-resource use", "ha", "Resource use, fossils", null, "MJ/ha", "Land-based fossil-resource use across all modelled sources."),
  impactIndicator("profile_fossils_tonne", "lca_profile", "Fossil-resource use", "tonne", "Resource use, fossils", null, "MJ/t", "Output-normalised fossil-resource use across all modelled sources."),
  impactIndicator("profile_water_ha", "lca_profile", "Water-use impact", "ha", "Water use", null, "m3 depriv./ha", "Background-process water-use burden embedded in upstream inputs; not measured on-farm irrigation demand."),
  impactIndicator("profile_water_tonne", "lca_profile", "Water-use impact", "tonne", "Water use", null, "m3 depriv./t", "Background-process water-use burden embedded in upstream inputs and divided by yield; not measured on-farm irrigation demand."),
];

function impactIndicator(key, domain, label, basis, category, groups, unit, interpretation, regionalDefault = false, entryFilter = null) {
  return {
    key,
    domain,
    label,
    basis,
    lcaCategory: category,
    groups,
    unit,
    interpretation,
    regionalDefault,
    value: (row) => lcaValue(row.dmu_id, basis, category, groups, entryFilter).value,
    contributor: (row) => lcaDominant(row.dmu_id, basis, category, groups, entryFilter),
  };
}

function nutrientFilter(label) {
  return (entry) => entry.label === label;
}

function nitrogenClimateFilter(entry) {
  if (entry.group === "Fertilisation") return entry.label === "Nitrogen fertiliser";
  if (entry.group === "Field emissions") return entry.label !== "Flooded-field methane";
  return false;
}

function lcaValue(dmuId, basis, category, groups = null, entryFilter = null) {
  const found = state.lca.get(lcaKey(dmuId, basis, category));
  if (!found) return { value: null, unit: "" };
  const entries = filteredEntries(found.entries, groups, entryFilter);
  return {
    value: entries.reduce((sum, entry) => sum + entry.value, 0),
    unit: found.unit,
  };
}

function lcaDominant(dmuId, basis, category, groups = null, entryFilter = null) {
  const found = state.lca.get(lcaKey(dmuId, basis, category));
  if (!found) return null;
  const entries = filteredEntries(found.entries, groups, entryFilter).filter((entry) => Number.isFinite(entry.value));
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (!entries.length || total === 0) return null;
  const byLabel = new Map();
  entries.forEach((entry) => byLabel.set(entry.label, (byLabel.get(entry.label) || 0) + entry.value));
  const [label, value] = Array.from(byLabel.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  return { label, value, share: total ? (value / total) * 100 : null };
}

function filteredEntries(entries, groups, entryFilter) {
  return entries.filter((entry) => {
    if (groups && !groups.includes(entry.group)) return false;
    if (entryFilter && !entryFilter(entry)) return false;
    return true;
  });
}

function hydrateFilters() {
  const farmers = unique(state.records.map((row) => row.farmer_id)).sort((a, b) => a.localeCompare(b));
  const years = unique(state.records.map((row) => row.year)).sort();
  fillSelect(elements.farmer, farmers);
  fillSelect(elements.year, years);
  state.filters.farmer = farmers[0] || "";
  state.filters.year = years[0] || "";
  elements.farmer.value = state.filters.farmer;
  elements.year.value = state.filters.year;
  hydrateProfileIndicators();
  hydrateRegionalIndicators();
}

function hydrateProfileIndicators() {
  const current = state.filters.profileIndicator;
  const options = indicatorsForDomain(state.filters.domain)
    .filter((indicator) => !indicator.pending)
    .filter((indicator) => hasAnyValues(indicator));
  elements.profileIndicator.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "All indicators in domain";
  elements.profileIndicator.appendChild(all);
  options.forEach((indicator) => {
    const option = document.createElement("option");
    option.value = indicator.key;
    option.textContent = indicatorOptionLabel(indicator);
    elements.profileIndicator.appendChild(option);
  });
  state.filters.profileIndicator = current === "all" || options.some((indicator) => indicator.key === current)
    ? current
    : "all";
  elements.profileIndicator.value = state.filters.profileIndicator;
}

function hydrateRegionalIndicators() {
  const current = state.filters.regionalIndicator;
  const options = indicatorsForDomain(state.filters.domain)
    .filter((indicator) => !indicator.pending)
    .filter((indicator) => hasAnyValues(indicator));
  elements.regionalIndicator.innerHTML = "";
  options.forEach((indicator) => {
    const option = document.createElement("option");
    option.value = indicator.key;
    option.textContent = indicatorOptionLabel(indicator);
    elements.regionalIndicator.appendChild(option);
  });
  const preferred = options.find((indicator) => indicator.key === current)
    || options.find((indicator) => indicator.regionalDefault)
    || options[0];
  state.filters.regionalIndicator = preferred ? preferred.key : "";
  elements.regionalIndicator.value = state.filters.regionalIndicator;
}

function indicatorOptionLabel(indicator) {
  const unit = indicator.unit ? ` (${indicator.unit})` : "";
  return `${DOMAIN_LABELS[indicator.domain]} - ${indicator.label}${unit}`;
}

function attachEvents() {
  elements.view.addEventListener("change", () => {
    state.filters.view = elements.view.value;
    syncReferenceForView();
    render();
  });
  elements.farmer.addEventListener("change", () => {
    state.filters.farmer = elements.farmer.value;
    render();
  });
  elements.year.addEventListener("change", () => {
    state.filters.year = elements.year.value;
    render();
  });
  elements.reference.addEventListener("change", () => {
    state.filters.reference = elements.reference.value;
    render();
  });
  elements.domain.addEventListener("change", () => {
    state.filters.domain = elements.domain.value;
    state.filters.profileIndicator = "all";
    hydrateProfileIndicators();
    hydrateRegionalIndicators();
    render();
  });
  elements.profileIndicator.addEventListener("change", () => {
    state.filters.profileIndicator = elements.profileIndicator.value;
    render();
  });
  elements.regionalIndicator.addEventListener("change", () => {
    state.filters.regionalIndicator = elements.regionalIndicator.value;
    render();
  });
  elements.reset.addEventListener("click", () => {
    const firstFarmer = elements.farmer.options[0]?.value || "";
    const firstYear = elements.year.options[0]?.value || "";
    Object.assign(state.filters, {
      view: "profile",
      farmer: firstFarmer,
      year: firstYear,
      reference: "both",
      domain: "all",
      profileIndicator: "all",
      regionalIndicator: "",
    });
    elements.view.value = "profile";
    elements.farmer.value = firstFarmer;
    elements.year.value = firstYear;
    elements.reference.value = "both";
    elements.domain.value = "all";
    hydrateProfileIndicators();
    hydrateRegionalIndicators();
    render();
  });
}

function render() {
  const selected = selectedRecord();
  const indicators = indicatorsForDomain(state.filters.domain);
  const profileIndicators = focusedProfileIndicators(indicators);
  syncReferenceForView();
  renderViewMode();
  renderActive(selected);
  renderStats(selected);
  renderProfile(selected, profileIndicators);
  renderRegional();
  renderDetail(selected, state.filters.view === "profile" ? profileIndicators : indicators);
}

function syncReferenceForView() {
  if (state.filters.view === "regional") {
    state.filters.reference = "annual";
    elements.reference.value = "annual";
    elements.reference.disabled = true;
    return;
  }
  elements.reference.disabled = false;
}

function renderViewMode() {
  elements.viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== state.filters.view;
  });
}

function selectedRecord() {
  return state.records.find((row) => row.farmer_id === state.filters.farmer && row.year === state.filters.year)
    || state.records.find((row) => row.farmer_id === state.filters.farmer)
    || state.records[0];
}

function indicatorsForDomain(domain) {
  if (domain && domain !== "all") return INDICATORS.filter((indicator) => indicator.domain === domain);
  return INDICATORS;
}

function focusedProfileIndicators(indicators) {
  if (state.filters.profileIndicator === "all") return indicators;
  const selected = indicators.find((indicator) => indicator.key === state.filters.profileIndicator);
  return selected ? [selected] : indicators;
}

function renderActive(selected) {
  const viewLabel = state.filters.view === "regional" ? "All farmers by year" : "Selected farmer-year profile";
  const indicatorLabel = state.filters.view === "profile" && state.filters.profileIndicator !== "all"
    ? ` | ${indicatorByKey(state.filters.profileIndicator)?.label || "Selected indicator"}`
    : "";
  elements.active.textContent = selected
    ? `${viewLabel} | ${selected.dmu_id} | ${referenceLabel(state.filters.reference)} | ${state.filters.domain === "all" ? "Complete profile" : DOMAIN_LABELS[state.filters.domain]}${indicatorLabel}`
    : "No farmer-year selected";
}

function renderStats(selected) {
  if (!selected) {
    elements.statGrid.innerHTML = `<p class="empty">No farmer-year records are available.</p>`;
    return;
  }
  const yieldIndicator = indicatorByKey("yield_t_ha");
  const yieldValue = yieldIndicator.value(selected);
  const annual = benchmarkFor(yieldIndicator, selected, "annual");
  const pooled = benchmarkFor(yieldIndicator, selected, "pooled");
  const pressure = pressureSummary(selected);
  const yieldPosition = annual.deviationPct == null
    ? "Yield position unavailable"
    : annual.deviationPct < 0
      ? "Below annual median yield"
      : annual.deviationPct > 0
        ? "Above annual median yield"
        : "At annual median yield";
  const cards = [
    { label: "Yield", value: `${formatNumber(yieldValue, 2)} t/ha`, sub: selected.dmu_id },
    { label: "Annual yield percentile", value: percentileLabel(annual.percentile), sub: `Same-year median ${formatNumber(annual.stats.median, 2)} t/ha` },
    { label: "Pooled yield percentile", value: percentileLabel(pooled.percentile), sub: `2022-2024 median ${formatNumber(pooled.stats.median, 2)} t/ha` },
    { label: "Land-based pressure", value: pressure.label, sub: pressure.sub },
    { label: "Output-normalised driver", value: yieldPosition, sub: "Per-tonne values are yield mediated" },
  ];
  elements.statGrid.innerHTML = cards.map((card) => `
    <div class="stat">
      <small>${card.label}</small>
      <strong>${card.value}</strong>
      <small>${card.sub}</small>
    </div>
  `).join("");
}

function pressureSummary(selected) {
  const candidates = ["n_kg_ha", "active_ingredient_kg_ha", "machine_worked_ha_per_ha"]
    .map((key) => {
      const indicator = indicatorByKey(key);
      const bench = benchmarkFor(indicator, selected, "annual");
      return { indicator, bench };
    })
    .filter((item) => Number.isFinite(item.bench.percentile));
  if (!candidates.length) return { label: "Unavailable", sub: "No land-based indicators" };
  const strongest = candidates.sort((a, b) => Math.abs((b.bench.percentile || 50) - 50) - Math.abs((a.bench.percentile || 50) - 50))[0];
  return {
    label: strongest.indicator.label,
    sub: `${DOMAIN_LABELS[strongest.indicator.domain]} | ${percentileLabel(strongest.bench.percentile)} annual percentile`,
  };
}

function renderProfile(selected, indicators) {
  const domains = unique(indicators.map((indicator) => indicator.domain));
  elements.profileCount.textContent = `${indicators.filter((indicator) => !indicator.pending).length} active indicators`;
  if (!selected) {
    elements.profileBlocks.innerHTML = `<p class="empty">No farmer-year record matches this selection.</p>`;
    return;
  }
  elements.profileBlocks.innerHTML = domains.map((domain) => renderDomainBlock(selected, domain, indicators.filter((indicator) => indicator.domain === domain))).join("");
}

function renderDomainBlock(selected, domain, indicators) {
  return `
    <section class="profile-domain">
      <div class="profile-domain-header">
        <div>
          <h3>${DOMAIN_LABELS[domain]}</h3>
          <p>${DOMAIN_NOTES[domain]}</p>
        </div>
      </div>
      <div class="indicator-list">
        ${indicators.map((indicator) => renderIndicator(selected, indicator)).join("")}
      </div>
    </section>
  `;
}

function renderIndicator(selected, indicator) {
  if (indicator.pending) {
    return `
      <div class="indicator-card pending">
        <div class="indicator-main">
          <strong>${indicator.label}</strong>
          <span>${indicator.interpretation}</span>
        </div>
        <div class="pending-pill">Pending assumptions</div>
      </div>
    `;
  }
  const annual = benchmarkFor(indicator, selected, "annual");
  const pooled = benchmarkFor(indicator, selected, "pooled");
  const value = indicator.value(selected);
  const contributor = indicator.contributor ? indicator.contributor(selected) : null;
  const contributorText = contributor
    ? `${contributor.label} (${formatNumber(contributor.share, 1)}% contribution)`
    : "Not source-specific";
  const contributorClass = contributor && contributor.label === "Flooded-field methane" ? "limited" : "";
  const plots = [
    state.filters.reference !== "pooled" ? rangePlot("Annual", annual, indicator) : "",
    state.filters.reference !== "annual" ? rangePlot("Pooled", pooled, indicator) : "",
  ].join("");
  return `
    <div class="indicator-card">
      <div class="indicator-main">
        <strong>${indicator.label}${indicator.basis ? ` / ${indicator.basis}` : ""}</strong>
        <span>${indicator.interpretation}</span>
      </div>
      <div class="indicator-value">
        <strong>${formatNumber(value, 3)}</strong>
        <span>${indicator.unit}</span>
      </div>
      <div class="range-pair">
        ${plots}
      </div>
      <div class="indicator-meta">
        <span>Annual ${percentileLabel(annual.percentile)} | ${formatSigned(annual.deviationPct, 1)}% vs median</span>
        <span>Pooled ${percentileLabel(pooled.percentile)} | ${formatSigned(pooled.deviationPct, 1)}% vs median</span>
        ${indicator.lcaCategory ? `<span class="${contributorClass}">Dominant contributor: ${contributorText}</span>` : ""}
      </div>
    </div>
  `;
}

function rangePlot(label, benchmark, indicator) {
  const stats = benchmark.stats;
  if (!stats || stats.n === 0 || benchmark.value == null) {
    return `<div class="range-plot"><span>${label}: unavailable</span></div>`;
  }
  const span = stats.max - stats.min;
  const q1 = plotPct(stats.q1, stats);
  const q3 = plotPct(stats.q3, stats);
  const median = plotPct(stats.median, stats);
  const selected = plotPct(benchmark.value, stats);
  return `
    <div class="range-plot" title="${label}: min ${formatNumber(stats.min, 3)}, Q1 ${formatNumber(stats.q1, 3)}, median ${formatNumber(stats.median, 3)}, Q3 ${formatNumber(stats.q3, 3)}, max ${formatNumber(stats.max, 3)} ${indicator.unit}">
      <div class="range-head">
        <span>${label}</span>
        <span>${formatNumber(stats.min, 2)} - ${formatNumber(stats.max, 2)} ${indicator.unit}</span>
      </div>
      <div class="range-track ${span === 0 ? "flat" : ""}">
        <span class="range-iqr" style="left:${q1}%; width:${Math.max(1, q3 - q1)}%"></span>
        <span class="range-median" style="left:${median}%"></span>
        <span class="range-selected" style="left:${selected}%"></span>
      </div>
    </div>
  `;
}

function renderRegional() {
  const indicator = indicatorByKey(state.filters.regionalIndicator);
  if (!indicator) {
    elements.regionalCount.textContent = "No indicator";
    elements.regionalSummary.innerHTML = "";
    elements.regionalChart.innerHTML = `<p class="empty">No regional indicator is available for this domain.</p>`;
    return;
  }
  const years = unique(state.records.map((row) => row.year)).sort();
  const panels = years.map((year) => regionalYearPanel(year, indicator)).filter((panel) => panel.rows.length);
  const totalRows = panels.reduce((sum, panel) => sum + panel.rows.length, 0);
  elements.regionalCount.textContent = `${totalRows} farmer-years | ${indicator.label}`;
  if (!panels.length) {
    elements.regionalSummary.innerHTML = "";
    elements.regionalChart.innerHTML = `<p class="empty">No regional values match this selection.</p>`;
    return;
  }
  elements.regionalSummary.innerHTML = panels.map((panel) => regionalSummaryCard(panel, indicator)).join("");
  elements.regionalChart.innerHTML = panels.map((panel) => regionalPanelMarkup(panel, indicator)).join("");
}

function regionalYearPanel(year, indicator) {
  const yearRows = state.records.filter((row) => row.year === year);
  const values = yearRows.map((row) => indicator.value(row)).filter(Number.isFinite);
  const stats = distributionStats(values);
  const rows = yearRows
    .map((row) => ({ row, value: indicator.value(row), bench: benchmarkFor(indicator, row, "annual") }))
    .filter((item) => Number.isFinite(item.value) && item.bench.stats && item.bench.stats.median !== 0)
    .sort((a, b) => a.bench.deviationPct - b.bench.deviationPct);
  const deviations = rows.map((item) => item.bench.deviationPct).filter(Number.isFinite);
  const maxAbs = Math.max(5, ...deviations.map((value) => Math.abs(value)));
  return { year, rows, stats, maxAbs };
}

function regionalSummaryCard(panel, indicator) {
  const lower = panel.rows.reduce((best, item) => (!best || item.value < best.value ? item : best), null);
  const upper = panel.rows.reduce((best, item) => (!best || item.value > best.value ? item : best), null);
  return `
    <div class="year-summary-card">
      <small>${panel.year}</small>
      <strong>${formatNumber(panel.stats.median, 3)} ${indicator.unit}</strong>
      <span>Annual median</span>
      <dl>
        <div><dt>Lower observed</dt><dd>${lower ? `${lower.row.dmu_id} | ${formatNumber(lower.value, 3)}` : "-"}</dd></div>
        <div><dt>Upper observed</dt><dd>${upper ? `${upper.row.dmu_id} | ${formatNumber(upper.value, 3)}` : "-"}</dd></div>
        <div><dt>IQR</dt><dd>${formatNumber(panel.stats.q1, 3)} - ${formatNumber(panel.stats.q3, 3)}</dd></div>
      </dl>
    </div>
  `;
}

function regionalPanelMarkup(panel, indicator) {
  const stats = panel.stats;
  const iqrLeft = deviationToPct(percentDeviation(stats.q1, stats.median), panel.maxAbs);
  const iqrRight = deviationToPct(percentDeviation(stats.q3, stats.median), panel.maxAbs);
  return `
    <section class="dotplot-panel">
      <div class="dotplot-title">
        <h3>${panel.year}</h3>
        <span>${panel.rows.length} farmer-years | median ${formatNumber(stats.median, 3)} ${indicator.unit}</span>
      </div>
      <div class="dotplot-axis">
        <span>${formatSigned(-panel.maxAbs, 0)}%</span>
        <span>Annual median</span>
        <span>${formatSigned(panel.maxAbs, 0)}%</span>
      </div>
      <div class="dotplot-body">
        <span class="dotplot-iqr" style="left:${Math.min(iqrLeft, iqrRight)}%; width:${Math.max(1, Math.abs(iqrRight - iqrLeft))}%"></span>
        <span class="dotplot-median"></span>
        ${panel.rows.map((item) => {
          const pct = deviationToPct(item.bench.deviationPct, panel.maxAbs);
          const selected = item.row.farmer_id === state.filters.farmer ? " selected" : "";
          const currentYear = item.row.farmer_id === state.filters.farmer && item.row.year === state.filters.year ? " current-year" : "";
          return `
            <div class="dotplot-row${selected}${currentYear}" title="${item.row.dmu_id}: ${formatNumber(item.value, 3)} ${indicator.unit}; ${formatSigned(item.bench.deviationPct, 1)}% vs annual median">
              <span class="dotplot-label">${item.row.dmu_id}</span>
              <span class="dotplot-line">
                <span class="dotplot-point" style="left:${pct}%"></span>
              </span>
              <span class="dotplot-value">${formatSigned(item.bench.deviationPct, 1)}%</span>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderDetail(selected, indicators) {
  const usable = indicators.filter((indicator) => !indicator.pending && hasAnyValues(indicator));
  elements.detailCount.textContent = `${usable.length} indicators`;
  if (!selected || !usable.length) {
    elements.detailTable.innerHTML = `<p class="empty">No benchmark values match this selection.</p>`;
    return;
  }
  elements.detailTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Indicator</th>
          <th>Value</th>
          <th>Annual median</th>
          <th>Annual IQR</th>
          <th>Annual percentile</th>
          <th>Annual deviation</th>
          <th>Pooled median</th>
          <th>Pooled IQR</th>
          <th>Pooled percentile</th>
          <th>Pooled deviation</th>
          <th>Interpretation</th>
        </tr>
      </thead>
      <tbody>
        ${usable.map((indicator) => detailRow(selected, indicator)).join("")}
      </tbody>
    </table>
  `;
}

function detailRow(selected, indicator) {
  const annual = benchmarkFor(indicator, selected, "annual");
  const pooled = benchmarkFor(indicator, selected, "pooled");
  const value = indicator.value(selected);
  return `
    <tr>
      <td>${DOMAIN_LABELS[indicator.domain]}</td>
      <td>${indicator.label}${indicator.basis ? ` / ${indicator.basis}` : ""}</td>
      <td>${formatNumber(value, 4)} ${indicator.unit}</td>
      <td>${formatNumber(annual.stats.median, 4)}</td>
      <td>${formatNumber(annual.stats.q1, 4)} - ${formatNumber(annual.stats.q3, 4)}</td>
      <td>${percentileLabel(annual.percentile)}</td>
      <td>${formatSigned(annual.deviationPct, 1)}%</td>
      <td>${formatNumber(pooled.stats.median, 4)}</td>
      <td>${formatNumber(pooled.stats.q1, 4)} - ${formatNumber(pooled.stats.q3, 4)}</td>
      <td>${percentileLabel(pooled.percentile)}</td>
      <td>${formatSigned(pooled.deviationPct, 1)}%</td>
      <td>${indicator.interpretation}</td>
    </tr>
  `;
}

function benchmarkFor(indicator, selected, scope) {
  const values = state.records
    .filter((row) => scope === "pooled" || row.year === selected.year)
    .map((row) => indicator.value(row))
    .filter(Number.isFinite);
  const value = indicator.value(selected);
  const foundStats = distributionStats(values);
  return {
    value,
    stats: foundStats,
    percentile: percentile(value, values),
    deviationPct: Number.isFinite(value) && foundStats.median ? ((value - foundStats.median) / foundStats.median) * 100 : null,
  };
}

function distributionStats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0, min: null, q1: null, median: null, q3: null, max: null };
  return {
    n: sorted.length,
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  };
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return null;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1];
  return next === undefined ? sortedValues[base] : sortedValues[base] + rest * (next - sortedValues[base]);
}

function percentile(value, values) {
  if (!Number.isFinite(value) || !values.length) return null;
  const usable = values.filter(Number.isFinite);
  const less = usable.filter((other) => other < value).length;
  const equal = usable.filter((other) => other === value).length;
  return ((less + equal * 0.5) / usable.length) * 100;
}

function plotPct(value, stats) {
  if (!Number.isFinite(value) || !Number.isFinite(stats.min) || !Number.isFinite(stats.max)) return 50;
  const span = stats.max - stats.min;
  if (span === 0) return 50;
  return Math.max(0, Math.min(100, ((value - stats.min) / span) * 100));
}

function percentDeviation(value, medianValue) {
  if (!Number.isFinite(value) || !Number.isFinite(medianValue) || medianValue === 0) return 0;
  return ((value - medianValue) / medianValue) * 100;
}

function deviationToPct(value, maxAbs) {
  if (!Number.isFinite(value) || !Number.isFinite(maxAbs) || maxAbs <= 0) return 50;
  return Math.max(0, Math.min(100, ((value + maxAbs) / (2 * maxAbs)) * 100));
}

function fillSelect(select, values) {
  select.innerHTML = "";
  values.forEach((value) => {
    if (value === undefined || value === null || value === "") return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== "")));
}

function indicatorByKey(key) {
  return INDICATORS.find((indicator) => indicator.key === key);
}

function hasAnyValues(indicator) {
  return state.records.some((row) => Number.isFinite(indicator.value(row)));
}

function referenceLabel(reference) {
  if (reference === "annual") return "same-year reference";
  if (reference === "pooled") return "pooled 2022-2024 reference";
  return "annual + pooled references";
}

function percentileLabel(value) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value);
  const suffix = rounded % 10 === 1 && rounded % 100 !== 11
    ? "st"
    : rounded % 10 === 2 && rounded % 100 !== 12
      ? "nd"
      : rounded % 10 === 3 && rounded % 100 !== 13
        ? "rd"
        : "th";
  return `${rounded}${suffix}`;
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
