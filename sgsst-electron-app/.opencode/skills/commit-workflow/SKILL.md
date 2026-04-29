---
name: commit-workflow
description: Guided git commit and PR workflow. Creates meaningful commit messages based on actual changes, pushes branches, and opens pull requests. Use when ready to commit or create a PR.
---

Guided workflow for creating git commits and pull requests with meaningful messages.

## When to Apply

- When user wants to commit changes
- When user wants to push and create a PR
- When user asks to clean up gone branches

## Commit Workflow

1. Run `git status` to see all changes
2. Run `git diff HEAD` to see staged and unstaged changes
3. Run `git log --oneline -10` to understand commit style
4. Analyze changes and draft a meaningful commit message that:
   - Summarizes the nature of the changes (feature, fix, refactor, etc.)
   - Focuses on the "why" rather than the "what"
   - Follows the repository's commit message style
5. Stage relevant files with `git add`
6. Create the commit

## Commit + Push + PR Workflow

1. Follow commit workflow above
2. If on main/master, create a new branch first
3. Push the branch to origin with `git push -u origin <branch>`
4. Create a pull request using `gh pr create` with:
   - Clear title summarizing the change
   - Body with summary, key changes, and any important notes

## Clean Gone Branches

Remove local branches that track deleted remote branches:
```bash
git fetch --prune && git branch --gone | grep '\[gone\]' | awk '{print $1}' | xargs git branch -D
```

## Guidelines

- NEVER update git config
- NEVER run destructive git commands (push --force, hard reset) unless explicitly requested
- NEVER skip hooks (--no-verify, --no-gpg-sign)
- NEVER force push to main/master
- Only commit when explicitly asked
- Do not add secrets, .env, or credentials to commits
