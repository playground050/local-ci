---
"run-local-ci": minor
"dtu-github-actions": minor
---

Support `steps[*].continue-on-error`. The flag (or an expression such as `${{ matrix.experimental }}`) is passed to the runner, which records the failing step with outcome `failure` / conclusion `success` and keeps running the job, as on GitHub. Under `--pause-on-failure` such steps still pause by default; `--continue-on-error continue` or `LOCAL_CI_CONTINUE_ON_ERROR=continue` lets them continue instead.
