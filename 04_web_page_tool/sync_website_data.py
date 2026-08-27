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
SINGLE_SCORE_FACTOR_SOURCE = (
    ROOT / "01_input_data" / "02_environmental_impact_input_data" / "02_single_scores"
)
OUTPUT_SOURCE = ROOT / "03_outputs"
ECONOMIC_SOURCE = ROOT / "01_input_data" / "03_economic_input_data"
NAO_SOURCE = Path("/Users/marcia/Desktop/article2_NAO")
EXPLORATORY_SOURCE = (
    ROOT
    / "99_archive_do_not_use"
    / "removed_from_revised_article_2026-08-05"
    / "03_outputs"
)

PIVOT_TARGET = DOCS_DATA / "pivot_tables"
SINGLE_SCORE_FACTOR_TARGET = DOCS_DATA / "single_score_factors"
CLEAN_LCA_TARGET = DOCS_DATA / "clean_lca"
ECONOMIC_TARGET = DOCS_DATA / "economic"
CONTEXT_TARGET = DOCS_DATA / "context"
DIAGNOSTICS_TARGET = DOCS_DATA / "diagnostics"
MANIFEST = DOCS_DATA / "site_data_manifest.json"
LEGACY_DOCS_DATA_PATHS = [
    DOCS_DATA / "cluster_impacts",
    DOCS_DATA / "clusters",
    DOCS_DATA / "singlescore.json",
]

PIVOT_FILES = [
    "operations_mastersheet - CROP_PROTECTION.csv",
    "operations_mastersheet - FERTILISATION.csv",
    "operations_mastersheet - Machines_No_Inputs.csv",
    "operations_mastersheet - SOWING.csv",
    "operations_mastersheet - Water.csv",
    "seed_rate_per_dmu_with_operations.csv",
]

SINGLE_SCORE_FACTOR_FILES = [
    SINGLE_SCORE_FACTOR_SOURCE
    / "crop_protection"
    / "crop_protection_single_score_factors.csv",
    SINGLE_SCORE_FACTOR_SOURCE / "fertilisation" / "fertilisation_single_score_factors.csv",
    SINGLE_SCORE_FACTOR_SOURCE / "machines" / "machines_single_score_factors.csv",
    SINGLE_SCORE_FACTOR_SOURCE / "sowing" / "sowing_single_score_factors.csv",
    SINGLE_SCORE_FACTOR_SOURCE / "water" / "water_single_score_factors.csv",
]

ACTIVE_LCA_OUTPUTS = {
    "crop_protection": {"inventory", "characterisation", "single_score"},
    "fertilisation": {"inventory", "characterisation", "single_score"},
    "field_emissions": {"inventory", "characterisation", "single_score"},
    "machines": {"inventory", "characterisation", "single_score"},
    "sowing": {"inventory", "characterisation", "single_score"},
}

ECONOMIC_FILES = [
    "crop_protection_price_scenarios_2024.csv",
    "fertiliser_price_scenarios_2024.csv",
    "rice_paddy_price_scenarios_by_year.csv",
    "rice_variety_price_group_map.csv",
]

EXPLORATORY_DIAGNOSTIC_FILES = [
    (
        EXPLORATORY_SOURCE / "dea" / "dea_exploratory_diagnostics_summary_rounded.csv",
        DIAGNOSTICS_TARGET / "dea" / "dea_exploratory_diagnostics_summary_rounded.csv",
    ),
    (
        EXPLORATORY_SOURCE / "dea" / "dea_model_comparison_scores.csv",
        DIAGNOSTICS_TARGET / "dea" / "dea_model_comparison_scores.csv",
    ),
    (
        EXPLORATORY_SOURCE / "dea" / "technical_dea_leave_one_out_summary.csv",
        DIAGNOSTICS_TARGET / "dea" / "technical_dea_leave_one_out_summary.csv",
    ),
    (
        EXPLORATORY_SOURCE / "pca_hcpc" / "pca_hcpc_sensitivity_summary.csv",
        DIAGNOSTICS_TARGET / "pca_hcpc" / "pca_hcpc_sensitivity_summary.csv",
    ),
    (
        EXPLORATORY_SOURCE / "pca_hcpc" / "pca_hcpc_leave_one_out_summary.csv",
        DIAGNOSTICS_TARGET / "pca_hcpc" / "pca_hcpc_leave_one_out_summary.csv",
    ),
    (
        EXPLORATORY_SOURCE / "pca_hcpc" / "pca_hcpc_loadings.csv",
        DIAGNOSTICS_TARGET / "pca_hcpc" / "pca_hcpc_loadings.csv",
    ),
    (
        EXPLORATORY_SOURCE / "pca_hcpc" / "pca_hcpc_sensitivity_labels.csv",
        DIAGNOSTICS_TARGET / "pca_hcpc" / "pca_hcpc_sensitivity_labels.csv",
    ),
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


def copy_lca_file(source: Path, target: Path) -> dict[str, object]:
    if source.parent.name != "characterisation":
        return copy_file(source, target)
    if not source.exists():
        raise SystemExit(f"Missing source file: {source}")

    target.parent.mkdir(parents=True, exist_ok=True)
    with source.open(encoding="utf-8-sig", newline="") as input_handle:
        reader = csv.DictReader(input_handle)
        fieldnames = [
            name for name in (reader.fieldnames or [])
            if not name.endswith("_single_score_file") and name != "single_score_file"
        ]
        with target.open("w", encoding="utf-8", newline="") as output_handle:
            writer = csv.DictWriter(output_handle, fieldnames=fieldnames)
            writer.writeheader()
            for row in reader:
                writer.writerow({name: row.get(name, "") for name in fieldnames})

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


def sync_single_score_reference_factors() -> list[dict[str, object]]:
    if SINGLE_SCORE_FACTOR_TARGET.exists():
        shutil.rmtree(SINGLE_SCORE_FACTOR_TARGET)
    SINGLE_SCORE_FACTOR_TARGET.mkdir(parents=True, exist_ok=True)

    copied = []
    for source in SINGLE_SCORE_FACTOR_FILES:
        copied.append(copy_file(source, SINGLE_SCORE_FACTOR_TARGET / source.name))
    return copied


def sync_clean_lca_outputs() -> list[dict[str, object]]:
    if CLEAN_LCA_TARGET.exists():
        shutil.rmtree(CLEAN_LCA_TARGET)
    CLEAN_LCA_TARGET.mkdir(parents=True, exist_ok=True)

    copied = []
    for source in sorted(OUTPUT_SOURCE.glob("*/*/*.csv")):
        group, output_type = source.relative_to(OUTPUT_SOURCE).parts[:2]
        if output_type not in ACTIVE_LCA_OUTPUTS.get(group, set()):
            continue
        target = CLEAN_LCA_TARGET / source.relative_to(OUTPUT_SOURCE)
        copied.append(copy_lca_file(source, target))
    return copied


def sync_economic_inputs() -> list[dict[str, object]]:
    if ECONOMIC_TARGET.exists():
        shutil.rmtree(ECONOMIC_TARGET)
    ECONOMIC_TARGET.mkdir(parents=True, exist_ok=True)

    copied = []
    for filename in ECONOMIC_FILES:
        copied.append(copy_file(ECONOMIC_SOURCE / filename, ECONOMIC_TARGET / filename))
    return copied


def remove_legacy_public_data() -> None:
    for path in LEGACY_DOCS_DATA_PATHS:
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()


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


def sync_exploratory_diagnostics() -> list[dict[str, object]]:
    if DIAGNOSTICS_TARGET.exists():
        shutil.rmtree(DIAGNOSTICS_TARGET)
    DIAGNOSTICS_TARGET.mkdir(parents=True, exist_ok=True)
    return [copy_file(source, target) for source, target in EXPLORATORY_DIAGNOSTIC_FILES]


def write_manifest(
    pivot_files: list[dict[str, object]],
    single_score_factor_files: list[dict[str, object]],
    lca_files: list[dict[str, object]],
    economic_files: list[dict[str, object]],
    context_files: list[dict[str, object]],
    diagnostic_files: list[dict[str, object]],
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
        "single_score_reference_factors": single_score_factor_files,
        "clean_lca_outputs": lca_files,
        "economic_inputs": economic_files,
        "context": context_files,
        "exploratory_diagnostics": diagnostic_files,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    remove_legacy_public_data()
    pivot_files = sync_pivot_tables()
    single_score_factor_files = sync_single_score_reference_factors()
    lca_files = sync_clean_lca_outputs()
    economic_files = sync_economic_inputs()
    context_files = sync_context()
    diagnostic_files = sync_exploratory_diagnostics()
    write_manifest(
        pivot_files,
        single_score_factor_files,
        lca_files,
        economic_files,
        context_files,
        diagnostic_files,
    )
    print(f"Synced {len(pivot_files)} pivot/input table files.")
    print(f"Synced {len(single_score_factor_files)} single-score reference factor files.")
    print(f"Synced {len(lca_files)} clean LCA output files.")
    print(f"Synced {len(economic_files)} economic input files.")
    print(f"Synced {len(context_files)} context output files.")
    print(f"Synced {len(diagnostic_files)} exploratory diagnostic files.")
    print(f"Wrote {MANIFEST}")


if __name__ == "__main__":
    main()
