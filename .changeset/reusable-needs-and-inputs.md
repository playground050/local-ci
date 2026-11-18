---
"local-ci": patch
"dtu-github-actions": patch
---

Reusable workflows: `needs` of a job after a reusable-workflow caller has only the caller's id, and `number`/`boolean` `workflow_call` inputs keep their types in the `inputs` context.
