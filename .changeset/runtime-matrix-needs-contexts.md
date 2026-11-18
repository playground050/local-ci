---
"run-local-ci": patch
"dtu-github-actions": patch
---

Give the runner the `matrix`, `strategy` and `needs` contexts. Step `if:` conditions such as `if: matrix.os == 'linux'` or `if: needs.setup.outputs.skip != 'true'` are evaluated by the runner while the job runs, and those contexts were sent empty, so the conditions silently evaluated against empty values. Matrix values keep their YAML types there (`if: matrix.experimental` is false for `experimental: false`).
