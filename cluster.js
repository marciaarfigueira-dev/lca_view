import { baseFarmerId, loadCsv, toNumber } from "./pivot-data.js";

const state = {
  data: [],
  filters: {
    season: "all",
    farmer: "all",
    cluster: "all",
  },
  filtered: [],
};

const elements = {
  season: document.getElementById("season-filter"),
  farmer: document.getElementById("farmer-filter"),
  reset: document.getElementById("reset-filters"),
  active: document.getElementById("active-filters"),
  statGrid: document.getElementById("stat-grid"),
  deaGrid: document.getElementById("dea-grid"),
  deaCount: document.getElementById("dea-count"),
  scatter: document.getElementById("scatter"),
  tooltip: document.getElementById("tooltip"),
  legend: document.getElementById("legend"),
  pointCount: document.getElementById("point-count"),
  detailTable: document.getElementById("detail-table"),
  detailCount: document.getElementById("detail-count"),
  download: document.getElementById("download-csv"),
  cluster: document.getElementById("cluster-filter"),
  aboutBtn: document.getElementById("about-btn"),
  aboutPanel: document.getElementById("about-panel"),
  aboutClose: document.getElementById("about-close"),
};

const palette = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#14b8a6"];

init();

async function init() {
  const [clusterRows, deaRows] = await Promise.all([
    loadCsv("./data/clusters/dea_clusters_hcpc_full.csv"),
    loadCsv("./data/clusters/dea_results_hcpc.csv"),
  ]);
  const deaByDmu = new Map(
    deaRows
      .map((row) => {
        const key = String(row.dmu_id || "").trim();
        if (!key) return null;
        return [
          key,
          {
            theta: toNumber(row.dea_theta_hcpc),
            efficient: toBool(row.efficient_hcpc),
          },
        ];
      })
      .filter(Boolean)
  );
  state.data = clusterRows
    .map((row) => {
      const dmuId = row.dmu_id || "";
      const season = toNumber(row.season);
      const cluster = toNumber(row.cluster_hcpc_full);
      const dea = deaByDmu.get(String(dmuId).trim());
      return {
        dmu_id: dmuId,
        farmer_id: baseFarmerId(dmuId) || dmuId,
        season,
        mode: row.mode || "—",
        cluster,
        N_rate_kg_ha: toNumber(row.n_kg_ha),
        Pesticide_load_kg_ha: toNumber(row.total_crop_protection_kg_ha),
        Machinery_area_ratio: toNumber(row.mach_ratio_soil),
        Yield_kg_ha: toNumber(row.yield_kg_ha),
        pc1: toNumber(row.PC1),
        pc2: toNumber(row.PC2),
        dea_theta: dea ? dea.theta : null,
        dea_efficient: dea ? dea.efficient : null,
      };
    })
    .filter((row) => Number.isFinite(row.pc1) && Number.isFinite(row.pc2) && Number.isFinite(row.cluster));
  hydrateFilters();
  attachEvents();
  render();
}

function hydrateFilters() {
  fillSelect(elements.season, uniqueValues(state.data, "season").sort((a, b) => b - a), "Season");
  fillSelect(elements.farmer, uniqueValues(state.data, "farmer_id").sort(), "Farmer");
  if (elements.cluster) {
    elements.cluster.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All clusters";
    elements.cluster.appendChild(all);
    const clusters = uniqueValues(state.data, "cluster").sort((a, b) => a - b);
    clusters.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = `${c}`;
      opt.textContent = `Cluster ${c}`;
      elements.cluster.appendChild(opt);
    });
  }
}

function fillSelect(select, values, label) {
  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = `All ${label.toLowerCase()}s`;
  select.appendChild(optAll);
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
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
  if (elements.cluster) {
    elements.cluster.addEventListener("change", () => {
      state.filters.cluster = elements.cluster.value;
      render();
    });
  }
  elements.reset.addEventListener("click", () => {
    state.filters.season = "all";
    state.filters.farmer = "all";
    state.filters.cluster = "all";
    elements.season.value = "all";
    elements.farmer.value = "all";
    if (elements.cluster) elements.cluster.value = "all";
    render();
  });
  if (elements.aboutBtn && elements.aboutPanel) {
    elements.aboutBtn.addEventListener("click", () => {
      elements.aboutPanel.style.display = elements.aboutPanel.style.display === "none" ? "block" : "none";
    });
  }
  if (elements.aboutClose && elements.aboutPanel) {
    elements.aboutClose.addEventListener("click", () => {
      elements.aboutPanel.style.display = "none";
    });
  }
  if (elements.download) {
    elements.download.addEventListener("click", downloadCsv);
  }
}

function render() {
  const filtered = state.data.filter((row) => {
    if (state.filters.season !== "all" && `${row.season}` !== state.filters.season) return false;
    if (state.filters.farmer !== "all" && row.farmer_id !== state.filters.farmer) return false;
    if (state.filters.cluster !== "all" && `${row.cluster}` !== state.filters.cluster) return false;
    return true;
  });
  state.filtered = filtered;
  renderActive(filtered.length);
  renderStats(filtered);
  renderDea(filtered);
  renderScatter(filtered);
  renderDetail(filtered);
}

function renderActive(count) {
  const parts = [];
  if (state.filters.season !== "all") parts.push(`Season ${state.filters.season}`);
  if (state.filters.farmer !== "all") parts.push(`Farmer ${state.filters.farmer}`);
  if (state.filters.cluster !== "all") parts.push(`Cluster ${state.filters.cluster}`);
  parts.push("Basis: PCA scores");
  elements.active.textContent = parts.length
    ? `${parts.join(" • ")} — ${count} records`
    : `No filters applied — ${count} records`;
}

function renderStats(rows) {
  if (!rows.length) {
    elements.statGrid.innerHTML = `<p class="empty">No data.</p>`;
    return;
  }
  const clusters = Array.from(new Set(rows.map((r) => r.cluster))).sort((a, b) => a - b);
  const stats = clusters.map((cluster) => {
    const subset = rows.filter((r) => r.cluster === cluster);
    const avg = (key) => subset.reduce((s, r) => s + (r[key] || 0), 0) / subset.length;
    return {
      label: `Cluster ${cluster}`,
      value: `${subset.length} farms`,
      sub: `N ${formatNumber(avg("N_rate_kg_ha"), 1)} | Pest ${formatNumber(
        avg("Pesticide_load_kg_ha"),
        2
      )} | Yield ${formatNumber(avg("Yield_kg_ha"), 0)} kg/ha | Mech ${formatNumber(
        avg("Machinery_area_ratio"),
        2
      )}`,
    };
  });
  elements.statGrid.innerHTML = stats
    .map(
      (s) => `
        <div class="stat">
          <small>${s.label}</small>
          <strong>${s.value}</strong>
          <small>${s.sub}</small>
        </div>
      `
    )
    .join("");
}

function renderDea(rows) {
  if (!elements.deaGrid || !elements.deaCount) return;
  const deaRows = rows.filter((r) => Number.isFinite(r.dea_theta));
  elements.deaCount.textContent = `${deaRows.length} records`;
  if (!deaRows.length) {
    elements.deaGrid.innerHTML = `<p class="empty">No DEA scores for this selection.</p>`;
    return;
  }
  const clusters = uniqueValues(deaRows, "cluster").sort((a, b) => a - b);
  const stats = clusters.map((cluster) => {
    const subset = deaRows.filter((r) => r.cluster === cluster);
    const values = subset.map((r) => r.dea_theta).filter(Number.isFinite).sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const med = median(values);
    const min = values[0];
    const max = values[values.length - 1];
    const efficientCount = subset.filter((r) => r.dea_efficient).length;
    return {
      label: `Cluster ${cluster}`,
      value: `Mean theta ${formatNumber(mean, 2)}`,
      sub: `Median ${formatNumber(med, 2)} | Min ${formatNumber(min, 2)} | Max ${formatNumber(
        max,
        2
      )} | Efficient ${efficientCount}/${values.length}`,
    };
  });
  elements.deaGrid.innerHTML = stats
    .map(
      (s) => `
        <div class="stat">
          <small>${s.label}</small>
          <strong>${s.value}</strong>
          <small>${s.sub}</small>
        </div>
      `
    )
    .join("");
}

function renderScatter(rows) {
  elements.tooltip.style.display = "none";
  const w = elements.scatter.clientWidth || 800;
  const h = elements.scatter.clientHeight || 420;
  const padding = 30;
  const xs = rows.map((r) => r.pc1);
  const ys = rows.map((r) => r.pc2);
  const minX = Math.min(...xs, -1);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, -1);
  const maxY = Math.max(...ys, 1);
  const scaleX = (x) => padding + ((x - minX) / (maxX - minX || 1)) * (w - 2 * padding);
  const scaleY = (y) => h - padding - ((y - minY) / (maxY - minY || 1)) * (h - 2 * padding);
  const showLabels = state.filters.cluster !== "all";

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.setAttribute("width", w);
  svgEl.setAttribute("height", h);
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  rows.forEach((r) => {
    const color = palette[(r.cluster - 1) % palette.length];
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "pt");
    circle.setAttribute("cx", scaleX(r.pc1));
    circle.setAttribute("cy", scaleY(r.pc2));
    circle.setAttribute("r", 5);
    circle.setAttribute("fill", color);
    circle.setAttribute("opacity", "0.85");
    circle.dataset.label = `${r.farmer_id} (${r.season})`;
    circle.dataset.cluster = r.cluster;
    circle.dataset.n = formatNumber(r.N_rate_kg_ha, 1);
    circle.dataset.pest = formatNumber(r.Pesticide_load_kg_ha, 2);
    circle.dataset.yield = formatNumber(r.Yield_kg_ha, 0);
    circle.dataset.mech = formatNumber(r.Machinery_area_ratio, 2);
    circle.dataset.dea = formatNumber(r.dea_theta, 2);
    circle.dataset.efficient = r.dea_efficient == null ? "—" : r.dea_efficient ? "Yes" : "No";
    circle.dataset.pc1 = formatNumber(r.pc1, 2);
    circle.dataset.pc2 = formatNumber(r.pc2, 2);
    circle.dataset.mode = r.mode || "—";
    g.appendChild(circle);
    if (showLabels) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", scaleX(r.pc1) + 8);
      label.setAttribute("y", scaleY(r.pc2) - 8);
      label.setAttribute("fill", "#e2e8f0");
      label.setAttribute("font-size", "11px");
      label.setAttribute("font-family", "Outfit, Trebuchet MS, sans-serif");
      label.textContent = `${r.farmer_id} ${r.season}`;
      g.appendChild(label);
    }
  });
  svgEl.appendChild(g);
  const oldSvg = elements.scatter.querySelector("svg");
  if (oldSvg) oldSvg.remove();
  const tooltipEl = elements.tooltip;
  if (tooltipEl) {
    elements.scatter.insertBefore(svgEl, tooltipEl);
  } else {
    elements.scatter.appendChild(svgEl);
  }
  bindTooltip();
  elements.pointCount.textContent = `${rows.length} points`;
  renderLegend();
}

function bindTooltip() {
  const pts = elements.scatter.querySelectorAll("circle.pt");
  pts.forEach((pt) => {
    pt.addEventListener("mouseenter", (event) => {
      const t = event.target;
      const lines = [
        `<strong>${t.dataset.label}</strong>`,
        `Cluster ${t.dataset.cluster}`,
        `Mode: ${t.dataset.mode || "—"}`,
        `N rate: ${t.dataset.n} kg/ha`,
        `Pest load: ${t.dataset.pest} kg/ha`,
        `Yield: ${t.dataset.yield} kg/ha`,
        `Mach ratio: ${t.dataset.mech}`,
        `DEA theta: ${t.dataset.dea}`,
        `Efficient: ${t.dataset.efficient}`,
        `PC1 ${t.dataset.pc1} · PC2 ${t.dataset.pc2}`,
      ];
      elements.tooltip.innerHTML = lines.join("<br/>");
      elements.tooltip.style.display = "block";
    });
    pt.addEventListener("mouseleave", () => {
      elements.tooltip.style.display = "none";
    });
    pt.addEventListener("mousemove", (event) => {
      const bounds = elements.scatter.getBoundingClientRect();
      const x = event.clientX - bounds.left + 12;
      const y = event.clientY - bounds.top + 12;
      elements.tooltip.style.transform = `translate(${x}px, ${y}px)`;
    });
  });
}

function renderLegend() {
  const clusters = uniqueValues(state.data, "cluster").sort((a, b) => a - b);
  elements.legend.innerHTML = clusters
    .map(
      (c) => `
      <span><span class="dot" style="background:${palette[(c - 1) % palette.length]}"></span>Cluster ${c}</span>
    `
    )
    .join("");
}

function renderDetail(rows) {
  elements.detailCount.textContent = `${rows.length} records`;
  if (!rows.length) {
    elements.detailTable.innerHTML = `<p class="empty">Nothing to show. Broaden filters to see data.</p>`;
    return;
  }
  const table = `
    <table>
      <thead>
        <tr>
          <th>Season</th>
          <th>Farmer</th>
          <th>Cluster</th>
          <th>Mode</th>
          <th>DEA theta</th>
          <th>Efficient</th>
          <th>N (kg/ha)</th>
          <th>Pest (kg/ha)</th>
          <th>Yield (kg/ha)</th>
          <th>Mech ratio</th>
          <th>PC1</th>
          <th>PC2</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.season}</td>
                <td>${row.farmer_id}</td>
                <td>${row.cluster}</td>
                <td>${row.mode || "—"}</td>
                <td>${row.dea_theta == null ? "—" : formatNumber(row.dea_theta, 2)}</td>
                <td>${row.dea_efficient == null ? "—" : row.dea_efficient ? "Yes" : "No"}</td>
                <td>${row.N_rate_kg_ha == null ? "—" : formatNumber(row.N_rate_kg_ha, 1)}</td>
                <td>${row.Pesticide_load_kg_ha == null ? "—" : formatNumber(row.Pesticide_load_kg_ha, 2)}</td>
                <td>${row.Yield_kg_ha == null ? "—" : formatNumber(row.Yield_kg_ha, 0)}</td>
                <td>${row.Machinery_area_ratio == null ? "—" : formatNumber(row.Machinery_area_ratio, 2)}</td>
                <td>${formatNumber(row.pc1, 2)}</td>
                <td>${formatNumber(row.pc2, 2)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
  elements.detailTable.innerHTML = table;
}

function downloadCsv() {
  const rows = state.filtered || [];
  if (!rows.length) return;
  const header = [
    "season",
    "farmer_id",
    "cluster",
    "mode",
    "dea_theta",
    "efficient",
    "n_kg_ha",
    "total_crop_protection_kg_ha",
    "yield_kg_ha",
    "mach_ratio_soil",
    "pc1",
    "pc2",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.season,
        r.farmer_id,
        r.cluster,
        r.mode,
        r.dea_theta,
        r.dea_efficient,
        r.N_rate_kg_ha,
        r.Pesticide_load_kg_ha,
        r.Yield_kg_ha,
        r.Machinery_area_ratio,
        r.pc1,
        r.pc2,
      ]
        .map((v) => (v == null ? "" : v))
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cluster_results.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

function toBool(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
