---
"local-ci": patch
"dtu-github-actions": patch
---

Step expressions that only read `env`, `matrix`, `strategy`, `needs`, `steps` or `job` (or no context, such as `hashFiles`) are left for the runner, and workflow/job `env:` is sent once for the job, so values written to `GITHUB_ENV` override workflow/job `env:` while the step's own `env:` still wins.
