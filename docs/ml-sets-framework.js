const COMPONENTS = {
  "regime-diagnosis": {
    eyebrow: "Analytical pipeline",
    title: "Regime diagnosis and interpretation question",
    note:
      "Defines whether indicators are being used for classification, comparison, learning or transition guidance before any result is interpreted.",
    rows: [
      ["In the tool", "The prototype treats farm-record indicators as evidence for interpretation, not as final compliance verdicts."],
      ["ML-SETS role", "Connects the local Sado rice system to wider policy, market, infrastructure and climate pressures."],
      ["Boundary", "The tool can show where farmer-years sit within the observed sample; it cannot explain regime change by itself."],
    ],
  },
  "data-foundation": {
    eyebrow: "Analytical pipeline",
    title: "Data foundation and harmonisation",
    note:
      "CAP farm notebooks are reorganised into cleaned farmer-year records, then linked to production data and technical product information.",
    rows: [
      ["Recorded evidence", "Applications, products, dates, treated or operated area, crop varieties, sowing, machinery operations and fertilisation records."],
      ["Reconstruction", "Products are translated into active ingredients or nutrients; operations are standardised; farmer-year inventories are calculated."],
      ["Evidence gap", "Soil condition, salinity, field hydrology, measured pest pressure, water delivery and farmer decision rationales remain partly visible or absent."],
    ],
  },
  "practice-archetypes": {
    eyebrow: "Analytical pipeline",
    title: "Practice archetypes",
    note:
      "Explores whether farmer-years cluster into management configurations, without treating those groups as fixed production types.",
    rows: [
      ["In the tool", "PCA and clustering diagnostics can show whether input-use, yield and impact variables move together."],
      ["Interpretation", "These patterns are possible pressure-response configurations within the bioregion."],
      ["Caution", "The sample is small, so archetypes are exploratory and should not be used as definitive farm classifications."],
    ],
  },
  "relative-efficiency": {
    eyebrow: "Analytical pipeline",
    title: "Relative input-use performance",
    note:
      "DEA is positioned as a farm-system benchmarking diagnostic for relative input-output performance within the observed sample.",
    rows: [
      ["In the tool", "DEA compares how farmer-years combine selected inputs and harvested output inside the same observed Sado sample."],
      ["What it adds", "It can flag observations that appear input-intensive or output-efficient relative to peers."],
      ["Caution", "The frontier is sample-sensitive; DEA scores are not environmental efficiency, compliance or sustainability rankings."],
    ],
  },
  "environmental-burdens": {
    eyebrow: "Analytical pipeline",
    title: "Environmental burden profiles",
    note:
      "LCA translates record-derived inventories into potential environmental burdens and keeps the hectare and tonne interpretations separate.",
    rows: [
      ["Per hectare", "Shows modelled land-based pressure associated with reconstructed management activity."],
      ["Per tonne", "Shows output-normalised burden, where yield mediates the result."],
      ["Caution", "LCA signals are potential impacts shaped by inventory completeness, background datasets and field-emission assumptions."],
    ],
  },
  guidance: {
    eyebrow: "Analytical pipeline",
    title: "Interpretation and bioregional guidance",
    note:
      "The final layer turns indicators back into situated questions: why was a result produced, what is observable, and who could act on it?",
    rows: [
      ["Comparison", "Benchmarks are internal to the bioregion and annual reference distributions; no external ideal farm is implied."],
      ["Learning", "The tool distinguishes common measures from the local conditions needed to interpret them."],
      ["Feedback", "The useful governance output is not only a score, but evidence for farmers, advisors and cooperative actors to discuss recurrent constraints."],
    ],
  },
  landscape: {
    eyebrow: "ML-SETS framework",
    title: "Landscape pressures",
    note:
      "Landscape pressures alter the conditions under which farmer-year performance is produced, often outside direct farmer control.",
    rows: [
      ["Climate and ecology", "Heat, rainfall, water availability, salinity risk, pest and weed dynamics and annual yield volatility."],
      ["Markets", "Fertiliser, pesticide and paddy-rice price volatility that changes the meaning of input choices and margins."],
      ["Tool link", "Weather context, pest-pressure proxy and exploratory economic profiling."],
    ],
  },
  "technical-regime": {
    eyebrow: "ML-SETS framework",
    title: "Technical-infrastructure regime",
    note:
      "The rice system is stabilised by production infrastructure, machinery, water management, logistics and processing arrangements.",
    rows: [
      ["Examples", "Irrigation infrastructure, land levelling, sowing systems, machinery access, processing logistics and input supply chains."],
      ["Tool link", "Machinery records, sowing records, LCA boundary and water-observability cautions."],
      ["Interpretation", "Some practices may look individually selectable but depend on infrastructure and shared production arrangements."],
    ],
  },
  "policy-regime": {
    eyebrow: "ML-SETS framework",
    title: "Policy and regulatory regimes",
    note:
      "CAP support, conditionality, farm-notebook templates and sustainability criteria shape what must be recorded and what becomes visible.",
    rows: [
      ["Examples", "Mandatory farm notebooks, input authorisations, environmental commitments, Taxonomy-related evidence demands and reporting templates."],
      ["Tool link", "Farm-Record Backstage, calculation notes and Taxonomy observability assessment."],
      ["Interpretation", "The record is not neutral: it reflects a policy template and therefore makes some dimensions easier to see than others."],
    ],
  },
  "sustainability-intervention": {
    eyebrow: "Connecting intervention",
    title: "Sustainability criteria and reporting intervention",
    note:
      "This layer shows how indicators and reporting requirements travel from policy or finance into local farm systems.",
    rows: [
      ["Function", "Criteria, benchmarks and LCA indicators create common measures that support comparison and coordination."],
      ["Local encounter", "The same measure is produced through different combinations of soils, water, yield, pest pressure, infrastructure and management."],
      ["Main caution", "Classification identifies a condition; it does not explain the causal pathway or the appropriate intervention."],
    ],
  },
  "resource-system": {
    eyebrow: "Focal social-ecological system",
    title: "Resource systems and units",
    note:
      "The focal resource system is the irrigated Sado rice system: fields, rice crop, soils, hydrology and seasonal production cycles.",
    rows: [
      ["Observed", "Cultivated area, crop variety, dated operations, harvested output and yield."],
      ["Partly absent", "Soil condition, salinity, drainage, actual water dynamics and biological pest pressure."],
      ["Interpretation", "Similar input records can produce different outcomes if resource conditions differ."],
    ],
  },
  "governance-system": {
    eyebrow: "Focal social-ecological system",
    title: "Governance system",
    note:
      "The governance system connects farmers, cooperative support, CAP rules, input authorisations and water/resource arrangements.",
    rows: [
      ["Rules", "Conditionality, authorised products, farm-notebook reporting, water allocation and area-based support."],
      ["Intermediaries", "Cooperative and advisory actors can aggregate evidence, support interpretation and communicate recurrent implementation constraints."],
      ["Tool link", "Record audit, methodology notes and observability cautions."],
    ],
  },
  actors: {
    eyebrow: "Focal social-ecological system",
    title: "Actors",
    note:
      "Actors mediate how evidence is produced, cleaned, interpreted and potentially translated into advisory or governance decisions.",
    rows: [
      ["Farmers", "Different histories, fields, equipment access, risk exposure and management choices."],
      ["Cooperative and advisors", "Support reporting, input access, production data, marketing and potential peer-learning processes."],
      ["Caution", "The tool does not observe farmer rationale directly; it observes what the reporting system makes available."],
    ],
  },
  "empirical-evidence": {
    eyebrow: "Empirical evidence layer",
    title: "Interactions and outcomes",
    note:
      "This is the empirical layer where reported actions, reconstructed inventories, yields and modelled impacts become visible.",
    rows: [
      ["Recorded", "Input applications, field operations, products, dates, areas, production data and derived LCA profiles."],
      ["What it can compare", "Farmer-year positions, input pressure, environmental burdens, costs and contextual signals."],
      ["Interpretation limit", "The evidence layer does not directly measure decision rationale, crop damage, ecological condition or all causal mechanisms."],
    ],
  },
  "related-ecosystems": {
    eyebrow: "Related ecosystems",
    title: "Environmental LCA signals",
    note:
      "The focal farm system is not ecologically closed; LCA represents selected exchanges with related ecosystems and background supply chains.",
    rows: [
      ["Signals", "Greenhouse gas emissions, toxicity and ecotoxicity pressure, eutrophication, resource use, land use and background water-use signals."],
      ["Functional bases", "Per hectare and per tonne of paddy rice, kept separate to avoid hiding yield-mediated effects."],
      ["Caution", "LCA signals extend the assessment boundary, but they do not replace situated analysis of actors, rules and ecological conditions."],
    ],
  },
};

const elements = {
  title: document.getElementById("mlsets-detail-title"),
  eyebrow: document.getElementById("mlsets-detail-eyebrow"),
  note: document.getElementById("mlsets-detail-note"),
  content: document.getElementById("mlsets-detail-content"),
  buttons: Array.from(document.querySelectorAll("[data-mlsets-key]")),
  backLink: document.getElementById("mlsets-back-link"),
};

const backTargets = {
  farmers: ["./farmer.html", "Back to Farm-Record Backstage"],
  bioregional: ["./bioregional.html", "Back to Bioregional Benchmarking"],
  overview: ["./choose-lens.html", "Back to overview"],
};

const from = new URLSearchParams(window.location.search).get("from") || "overview";
const [backHref, backLabel] = backTargets[from] || backTargets.overview;
if (elements.backLink) {
  elements.backLink.href = backHref;
  elements.backLink.textContent = backLabel;
}

elements.buttons.forEach((button) => {
  button.addEventListener("click", () => renderComponent(button.dataset.mlsetsKey));
});

renderComponent("data-foundation");

function renderComponent(key) {
  const component = COMPONENTS[key] || COMPONENTS["data-foundation"];
  elements.buttons.forEach((button) => button.classList.toggle("active", button.dataset.mlsetsKey === key));
  elements.eyebrow.textContent = component.eyebrow;
  elements.title.textContent = component.title;
  elements.note.textContent = component.note;
  elements.content.innerHTML = tableHtml(["Aspect", "Interpretation"], component.rows);
}

function tableHtml(headers, rows) {
  return `
    <div class="boundary-table-shell">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
