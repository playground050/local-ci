---
"run-local-ci": minor
---

Support `strategy.matrix.include` and `strategy.matrix.exclude` with GitHub's expansion rules. They were treated as extra matrix axes, so excluded combinations still ran, included combinations were missing, and every leg got `include` / `exclude` values of `[object Object]`. Also expose `strategy.fail-fast` and `strategy.max-parallel`.
