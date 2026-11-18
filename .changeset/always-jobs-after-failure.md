---
"run-local-ci": patch
---

Run `if: always()` and `if: failure()` jobs after an upstream job fails instead of aborting every later dependency wave. Jobs without an `if:` are now skipped when any (transitive) upstream job failed or was skipped, matching GitHub's implicit `success()`. `needs.<job>.result` now reports the dependency's actual result (`failure`, `skipped`, …) instead of always `success`.
