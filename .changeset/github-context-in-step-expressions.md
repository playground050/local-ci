---
"run-local-ci": patch
---

Expand `${{ github.sha }}`, `${{ github.repository }}` and the other run-specific `github.*` values with the run's real context in step `env:`, `run:`, `name:` and `with:` values. They previously fell back to placeholders such as the all-zero SHA, contrary to the compatibility table.
