# Web Page Tool Settings

This folder records how the cleaned LCA workflow connects to the GitHub Pages
tool. The website is a separate publication layer: it reads exported copies of
the cleaned outputs, but it is not the source of the LCA calculations.

Live page:

```text
https://marciaarfigueira-dev.github.io/lca_view/
```

Previous local GitHub Pages source:

```text
/Users/marcia/Desktop/ml_sets_report/docs
```

New intended repository root:

```text
/Users/marcia/Desktop/lca_python_organised
```

New intended GitHub Pages source:

```text
/Users/marcia/Desktop/lca_python_organised/docs
```

Git remote:

```text
https://github.com/marciaarfigueira-dev/lca_view.git
```

Clean LCA project root:

```text
/Users/marcia/Desktop/lca_python_organised
```

Important rule: the website should not calculate or preserve LCA values from
old copied files. The cleaned route is:

```text
original input files -> 02_scripts/02_lca_calculations -> 03_outputs -> website data exports
```

Refresh website data with:

```text
python3 04_web_page_tool/sync_website_data.py
```

This updates:

```text
docs/data/pivot_tables
docs/data/clean_lca
docs/data/context
docs/data/diagnostics
docs/data/site_data_manifest.json
```

GitHub Pages cannot read files outside `docs/` when published from `/docs`,
so `docs/data` is the generated website-facing copy of the clean sources.

Current cleaned LCA output groups used by the revised article:

```text
03_outputs/fertilisation
03_outputs/crop_protection
03_outputs/machines
03_outputs/sowing
03_outputs/field_emissions
03_outputs/environmental_baseline
03_outputs/farmer_year_environmental_benchmarking
03_outputs/interannual_management_yield
```

Irrigation records are retained for observability, but irrigation-water impacts
are not part of the interpreted revised LCA outputs.

The public web export is intentionally narrower than the full calculation
archive. It exports inventory, EF 3.0 midpoint characterisation and explicitly
labelled single-score CSVs for fertilisation, crop protection, machinery,
sowing and field emissions. Single-score results are available only in the
dedicated exploratory and reference views; they are not used in the manuscript
interpretation or as farm rankings. Foreground irrigation-water LCA outputs are
not exported to the active `docs/data/clean_lca` folder.

The optional exploratory-analysis page uses archived DEA and PCA/HCPC outputs
under `docs/data/diagnostics`. These diagnostics are included for thesis-facing
method development only. They should be described as prototype pattern-detection
and technical-efficiency checks, not as causal evidence, compliance assessment
or sustainability ranking.

Migration note:

```text
old local repo root: /Users/marcia/Desktop/ml_sets_report/docs
new local repo root: /Users/marcia/Desktop/lca_python_organised
new GitHub Pages folder: docs
```

On GitHub Pages, the repository should publish from the `main` branch and
`/docs` folder.
