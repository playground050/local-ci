---
"local-ci": patch
"dtu-github-actions": patch
---

Evaluate every expression Local CI resolves itself (job `if:`, `runs-on`, matrices, job `env:`, `continue-on-error`, step names, …) with one evaluator that follows GitHub's typing rules, replacing the older string-based one. This adds the `*` object filter, indexing, hex and negative numbers, and `join`'s default `,` separator everywhere, and makes `github.event.pull_request` null (falsy) on the simulated push event.
