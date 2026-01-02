export async function loadCsv(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Unable to load ${path}`);
  const text = await res.text();
  return parseCsv(text);
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  let str = String(value).trim();
  if (!str) return null;
  str = str.replace(/\s+/g, "");
  if (str.includes(",") && str.includes(".")) {
    str = str.replace(/,/g, "");
  } else if (str.includes(",") && !str.includes(".")) {
    str = str.replace(/,/g, ".");
  }
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export function baseFarmerId(dmuId) {
  if (!dmuId) return "";
  const parts = String(dmuId).split("_");
  if (parts.length >= 2 && /^\d{4}$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join("_");
  }
  return String(dmuId);
}

export function extractSeasonFromId(value) {
  if (!value) return "";
  const match = String(value).trim().match(/(\d{4})$/);
  return match ? match[1] : "";
}

export function extractSeason(row) {
  if (!row) return "";
  const direct =
    row.season ??
    row.Season ??
    row.year ??
    row.Year ??
    row.SEASON ??
    row.YEAR ??
    row.season_id ??
    row.Season_ID;
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
    const numeric = toNumber(direct);
    if (numeric != null) return numeric;
    const trimmed = String(direct).trim();
    const extracted = extractSeasonFromId(trimmed);
    return extracted ? toNumber(extracted) ?? extracted : trimmed;
  }
  const fallbackId =
    row.dmu_id || row.DMU_ID || row.dmuId || row.farmer_id || row.FARMER_ID || row.farmerId || row.dmu || "";
  const extracted = extractSeasonFromId(fallbackId);
  return extracted ? toNumber(extracted) ?? extracted : "";
}

export function buildDate(year, month, day) {
  if (!year) return "";
  const y = String(year).padStart(4, "0");
  const m = month ? String(month).padStart(2, "0") : "";
  const d = day ? String(day).padStart(2, "0") : "";
  if (m && d) return `${y}-${m}-${d}`;
  if (m) return `${y}-${m}`;
  return y;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) return [];
  const header = rows.shift().map((h, idx) => {
    const trimmed = h.trim();
    return idx === 0 ? trimmed.replace(/^\ufeff/, "") : trimmed;
  });
  return rows.map((cells) => {
    const record = {};
    header.forEach((key, idx) => {
      record[key] = cells[idx] ?? "";
    });
    return record;
  });
}
