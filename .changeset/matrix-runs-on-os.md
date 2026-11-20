---
"local-ci": patch
"dtu-github-actions": patch
---

Resolve matrix expressions in `runs-on` (e.g. `runs-on: ${{ matrix.os }}`) before deciding a job's OS, so macOS matrix legs are skipped with the usual notice on hosts without a macOS VM instead of running in a Linux container.
