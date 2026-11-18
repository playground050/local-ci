---
"run-local-ci": patch
"dtu-github-actions": patch
---

Set `GITHUB_REF_NAME`, `GITHUB_REF_TYPE`, `GITHUB_REF_PROTECTED`, `GITHUB_BASE_REF`, `GITHUB_HEAD_REF`, `GITHUB_REPOSITORY_OWNER`, `GITHUB_TRIGGERING_ACTOR`, `GITHUB_WORKFLOW` and `GITHUB_WORKFLOW_REF` in steps, as on GitHub (the runner derives them from the github context, which lacked those keys). Stop leaking a step's `env:` into every other step of the job.
