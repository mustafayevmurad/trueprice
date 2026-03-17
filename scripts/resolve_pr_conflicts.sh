#!/usr/bin/env bash
set -euo pipefail

# Auto-resolve known PR conflicts by keeping this branch's implementation
# for the files shown in GitHub conflict banner.
FILES=(
  "index.html"
  "results.html"
  "script.js"
  "styles.css"
)

if ! git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  echo "No merge in progress (MERGE_HEAD not found)."
  echo "Run this script only after: git merge <target-branch>"
  exit 1
fi

for f in "${FILES[@]}"; do
  if git ls-files -u -- "$f" | grep -q .; then
    echo "Resolving $f with --ours"
    git checkout --ours -- "$f"
    git add "$f"
  else
    echo "No conflict in $f"
  fi
done

echo "Done. If all conflicts are resolved, run:"
echo "  git commit -m 'chore: resolve merge conflicts (keep MVP implementation)'"
