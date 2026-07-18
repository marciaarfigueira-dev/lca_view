# Web Page Tool Settings

This folder records how the cleaned LCA workflow connects to the GitHub Pages
tool.

Live page:

```text
https://marciaarfigueira-dev.github.io/lca_view/
```

Current old local GitHub Pages source:

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

Important rule: the website should not calculate LCA values from old copied
files anymore. The cleaned route is:

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
docs/data/site_data_manifest.json
```

GitHub Pages cannot read files outside `docs/` when published from `/docs`,
so `docs/data` is the generated website-facing copy of the clean sources.

Current cleaned LCA output groups:

```text
03_outputs/fertilisation
03_outputs/crop_protection
03_outputs/machines
03_outputs/sowing
03_outputs/field_emissions
03_outputs/water
```

The next step before updating the website is to create one aggregation layer:

```text
03_outputs/_aggregated/
  characterisation_by_dmu_ha.csv
  characterisation_by_dmu_tonne.csv
  single_score_by_dmu_ha.csv
  single_score_by_dmu_tonne.csv
```

After that, the website can read one tidy route for all LCA views instead of
mixing old scripts, clusters, and raw pivot tables.

Migration note:

```text
old local repo root: /Users/marcia/Desktop/ml_sets_report/docs
new local repo root: /Users/marcia/Desktop/lca_python_organised
new GitHub Pages folder: docs
```

On GitHub Pages, the repository should publish from the `main` branch and
`/docs` folder.
