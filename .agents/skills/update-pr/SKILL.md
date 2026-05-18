---
name: update-pr
description: Update an existing GitHub pull request for the current branch—commit and push latest changes, then refresh the PR title and body from the full diff against main.
disable-model-invocation: true
---

# Update pull request

Update the open PR for the current branch using the steps below.

1. If there are uncommitted changes, commit them.
2. Push the branch to the remote.
3. Find the open PR for the current branch (base branch `main`).
4. Regenerate the PR title and body from the latest changes on this branch.

If the current branch is `main`, stop and ask the user to switch to a feature branch first.

If no open PR exists for the branch, stop and suggest running the new-pr workflow instead.

If GitHub MCP is configured, update the PR. If it is not configured, stop the task.

Include the following sections in the PR body:

- Summary: Brief overview of the PR changes
- Testing: How reviewers can verify the changes
