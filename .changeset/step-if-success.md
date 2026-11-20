---
"local-ci": patch
"dtu-github-actions": patch
---

Send a step `if:` without a status function to the runner as `success() && (<if>)`, as GitHub's server does. Steps such as `if: matrix.target != ''` ran after an earlier step had failed.
