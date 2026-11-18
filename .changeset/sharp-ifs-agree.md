---
"local-ci": patch
"dtu-github-actions": patch
---

Evaluate job-level `if:` with a full expression evaluator that follows GitHub's typing rules (`true == 1`, case-insensitive string comparison, hex numbers, indexing, `.*` filters, `format` with escaped braces) and can read `github`, `vars` and `inputs`, not only `needs`. A condition without a status function now implies `success() &&`, as on GitHub.
