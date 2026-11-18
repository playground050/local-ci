---
"run-local-ci": minor
---

Support matrices built from expressions, including the common `matrix: { dir: ${{ fromJSON(needs.changes.outputs.dirs) }} }` pattern. Matrices that read `needs.*` are expanded once their dependencies have finished; others (e.g. `fromJSON(vars.MATRIX)`) are expanded up front. Previously such keys were dropped, so a single job ran with empty matrix values.
