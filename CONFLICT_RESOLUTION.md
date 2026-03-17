# Resolving PR conflicts for TruePrice

If GitHub shows conflicts in these files:

- `index.html`
- `results.html`
- `script.js`
- `styles.css`

use the script below to keep the current MVP implementation from this branch.

## Steps

```bash
git fetch origin
git checkout work
git merge origin/<target-branch>
./scripts/resolve_pr_conflicts.sh
git commit -m "chore: resolve merge conflicts (keep MVP implementation)"
git push origin work
```

## Why this works

The conflicts are in UI files that were heavily edited on both branches. For this PR,
we intentionally keep the current branch version to preserve the working end-to-end MVP
(search + results + admin flow).
