#!/usr/bin/env python3
"""
Refresh GitHub Pages data from the cleaned LCA project.

GitHub Pages publishes the docs/ folder, so browser code cannot read directly
from 01_input_data or 03_outputs on the live site. This script keeps docs/data
in sync with the cleaned source files before local preview, commit, or push.
"""

from __future__ import annotations

import hashlib
import csv
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS_DATA = ROOT / "docs" / "data"
PIVOT_SOURCE = ROOT / "01_input_data" / "01_farm_operation_data" / "pivot_tables"
OUTPUT_SOURCE = ROOT / "03_outputs"
NAO_SOURCE = Path("/Users/marcia/Desktop/article2_NAO")

PIVOT_TARGET = DOCS_DATA / "pivot_tables"
CLEAN_LCA_TARGET = DOCS_DATA / "clean_lca"
DIAGNOSTICS_TARGET = DOCS_DATA / "diagnostics"
CONTEXT_TARGET = DOCS_DATA / "context"
MANIFEST = DOCS_DATA / "site_data_manifest.json"

PIVOT_FILES = [
    "operations_mastersheet - CROP_PROTECTION.csv",
    "operations_mastersheet - FERTILISATION.csv",
    "operations_mastersheet - Machines_No_Inputs.csv",
    "operations_mastersheet - SOWING.csv",
    "operations_mastersheet - Water.csv",
    "seed_rate_per_dmu_with_operations.csv",
]

DIAGNOSTIC_FILES = [
    "dea/technical_dea_vrs_crs_results.csv",
    "dea/technical_dea_vrs_crs_summary.csv",
    "dea/technical_dea_leave_one_out_summary.csv",
    "dea/non_ch4_climate_adjusted_dea_results.csv",
    "dea/non_ch4_climate_adjusted_dea_summary.csv",
    "dea/climate_adjusted_dea_results.csv",
    "dea/climate_adjusted_dea_summary.csv",
    "pca_hcpc/pca_hcpc_sensitivity_summary.csv",
    "pca_hcpc/pca_hcpc_leave_one_out_summary.csv",
    "pca_hcpc/pca_hcpc_loadings.csv",
    "pca_hcpc/pca_hcpc_cluster_centroids.csv",
]

CONTEXT_CLIMATE_SOURCE = (
    NAO_SOURCE
    / "outputs"
    / "climate_masked"
    / "summary_csv"
    / "nao_climate"
    / "climate_monthly_metrics_aug_sep_oct.csv"
)
CONTEXT_NAO_SOURCE = NAO_SOURCE / "inputs" / "NAO" / "nao_1950_2025.csv"
CONTEXT_YIELD_SOURCE = (
    NAO_SOURCE
    / "outputs"
    / "yield_detrending"
    / "regional"
    / "regional_yield_detrend_all.csv"
)
CONTEXT_TARGET_FILE = CONTEXT_TARGET / "sado_climate_nao_context_1991_2024_aug_sep_oct.csv"

MONTH_NAMES = {
    8: "August",
    9: "September",
    10: "October",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_file(source: Path, target: Path) -> dict[str, object]:
    if not source.exists():
        raise SystemExit(f"Missing source file: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return {
        "source": str(source.relative_to(ROOT)),
        "target": str(target.relative_to(ROOT)),
        "bytes": target.stat().st_size,
        "sha256": sha256(target),
    }


def sync_pivot_tables() -> list[dict[str, object]]:
    PIVOT_TARGET.mkdir(parents=True, exist_ok=True)
    expected = set(PIVOT_FILES)
    for existing in PIVOT_TARGET.glob("*.csv"):
        if existing.name not in expected:
            existing.unlink()

    copied = []
    for filename in PIVOT_FILES:
        copied.append(copy_file(PIVOT_SOURCE / filename, PIVOT_TARGET / filename))
    return copied


def sync_clean_lca_outputs() -> list[dict[str, object]]:
    if CLEAN_LCA_TARGET.exists():
        shutil.rmtree(CLEAN_LCA_TARGET)
    CLEAN_LCA_TARGET.mkdir(parents=True, exist_ok=True)

    copied = []
    for source in sorted(OUTPUT_SOURCE.glob("*/*/*.csv")):
        target = CLEAN_LCA_TARGET / source.relative_to(OUTPUT_SOURCE)
        copied.append(copy_file(source, target))
    return copied


def sync_diagnostics() -> list[dict[str, object]]:
    if DIAGNOSTICS_TARGET.exists():
        shutil.rmtree(DIAGNOSTICS_TARGET)
    DIAGNOSTICS_TARGET.mkdir(parents=True, exist_ok=True)

    copied = []
    for filename in DIAGNOSTIC_FILES:
        source = OUTPUT_SOURCE / filename
        target = DIAGNOSTICS_TARGET / filename
        copied.append(copy_file(source, target))
    return copied


def parse_decimal(value: str) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    return float(str(value).strip().replace(",", "."))


def load_nao_values() -> dict[tuple[int, int], float | None]:
    month_lookup = {
        "Aug": 8,
        "Sep": 9,
        "Oct": 10,
    }
    values: dict[tuple[int, int], float | None] = {}
    if not CONTEXT_NAO_SOURCE.exists():
        raise SystemExit(f"Missing NAO source file: {CONTEXT_NAO_SOURCE}")
    with CONTEXT_NAO_SOURCE.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row in reader:
            year = int(row["Year"])
            for column, month in month_lookup.items():
                values[(year, month)] = parse_decimal(row.get(column, ""))
    return values


def load_sado_yield_values() -> dict[int, dict[str, float | None]]:
    values: dict[int, dict[str, float | None]] = {}
    if not CONTEXT_YIELD_SOURCE.exists():
        raise SystemExit(f"Missing yield source file: {CONTEXT_YIELD_SOURCE}")
    with CONTEXT_YIELD_SOURCE.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row.get("Region") != "Alentejo":
                continue
            year = int(row["Year"])
            values[year] = {
                "yield_kg_ha": parse_decimal(row.get("Yield_kg_per_ha", "")),
                "yield_residual_pct": parse_decimal(row.get("ResidualsPct", "")),
            }
    return values


def sync_context() -> list[dict[str, object]]:
    if CONTEXT_TARGET.exists():
        shutil.rmtree(CONTEXT_TARGET)
    CONTEXT_TARGET.mkdir(parents=True, exist_ok=True)

    if not CONTEXT_CLIMATE_SOURCE.exists():
        raise SystemExit(f"Missing context climate source file: {CONTEXT_CLIMATE_SOURCE}")

    nao_values = load_nao_values()
    yield_values = load_sado_yield_values()
    rows = []
    with CONTEXT_CLIMATE_SOURCE.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if row.get("Region") != "sado":
                continue
            year = int(row["Year"])
            month = int(row["Month"])
            if month not in MONTH_NAMES:
                continue
            rows.append(
                {
                    "region": "sado",
                    "year": year,
                    "month": month,
                    "month_name": MONTH_NAMES[month],
                    "tmax_mean_c": parse_decimal(row.get("Tmax_mean", "")),
                    "days35": parse_decimal(row.get("Days35", "")),
                    "days40": parse_decimal(row.get("Days40", "")),
                    "hw35": parse_decimal(row.get("HW35", "")),
                    "hw40": parse_decimal(row.get("HW40", "")),
                    "vpd_mean_kpa": parse_decimal(row.get("VPD_mean", "")),
                    "precip_mm": parse_decimal(row.get("Precip_mm", "")),
                    "nao_index": nao_values.get((year, month)),
                    "yield_kg_ha": yield_values.get(year, {}).get("yield_kg_ha"),
                    "yield_residual_pct": yield_values.get(year, {}).get("yield_residual_pct"),
                    "is_lca_year": year in {2022, 2023, 2024},
                }
            )

    fieldnames = [
        "region",
        "year",
        "month",
        "month_name",
        "tmax_mean_c",
        "days35",
        "days40",
        "hw35",
        "hw40",
        "vpd_mean_kpa",
        "precip_mm",
        "nao_index",
        "yield_kg_ha",
        "yield_residual_pct",
        "is_lca_year",
    ]
    with CONTEXT_TARGET_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return [
        {
            "source": str(CONTEXT_CLIMATE_SOURCE),
            "source_nao": str(CONTEXT_NAO_SOURCE),
            "source_yield": str(CONTEXT_YIELD_SOURCE),
            "target": str(CONTEXT_TARGET_FILE.relative_to(ROOT)),
            "rows": len(rows),
            "bytes": CONTEXT_TARGET_FILE.stat().st_size,
            "sha256": sha256(CONTEXT_TARGET_FILE),
        }
    ]


def write_manifest(
    pivot_files: list[dict[str, object]],
    lca_files: list[dict[str, object]],
    diagnostic_files: list[dict[str, object]],
    context_files: list[dict[str, object]],
) -> None:
    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "project_root": str(ROOT),
        "rules": [
            "docs/data is generated from cleaned inputs and outputs.",
            "Do not manually edit generated files in docs/data.",
            "Run this script after changing input tables or regenerating LCA outputs.",
        ],
        "pivot_tables": pivot_files,
        "clean_lca_outputs": lca_files,
        "diagnostics": diagnostic_files,
        "context": context_files,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    pivot_files = sync_pivot_tables()
    lca_files = sync_clean_lca_outputs()
    diagnostic_files = sync_diagnostics()
    context_files = sync_context()
    write_manifest(pivot_files, lca_files, diagnostic_files, context_files)
    print(f"Synced {len(pivot_files)} pivot/input table files.")
    print(f"Synced {len(lca_files)} clean LCA output files.")
    print(f"Synced {len(diagnostic_files)} diagnostic output files.")
    print(f"Synced {len(context_files)} context output files.")
    print(f"Wrote {MANIFEST}")


if __name__ == "__main__":
    main()
