---
"run-local-ci": minor
---

Support `jobs.<id>.continue-on-error`. A failing job that sets it (or a matrix expression that evaluates to true) is still listed as failed, but the run passes, the exit code is 0, and dependent jobs see `needs.<id>.result == success`, as on GitHub.
