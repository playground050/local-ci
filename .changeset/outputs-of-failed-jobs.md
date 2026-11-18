---
"run-local-ci": patch
---

Keep the outputs a job set before it failed, so downstream `if: always()` / `if: failure()` jobs can read `needs.<job>.outputs.*` as on GitHub. Linux container jobs previously dropped them; macOS VM jobs already kept them.
