---
name: commit
description: Suggest a Conventional Commit message for the current changes
---

- Status: !`git status --short`
- Diff: !`git diff HEAD`
- Recent commits (for style): !`git log --oneline -10`

Suggest a Conventional Commit message for the changes above in a code block, matching the style of recent commits (`type: summary`, imperative, lowercase). Then ask me whether I want you to commit, and separately whether I want you to push — don't do either without my explicit confirmation.
