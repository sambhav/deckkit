#!/usr/bin/env bash
# Copy the built site onto the gh-pages branch and push it. Run after `npm run build`.
set -euo pipefail
git fetch --depth=1 origin gh-pages
git worktree add -f site FETCH_HEAD
# Everything a reader loads; sources, tests and tooling stay on main. Compare by content:
# a new manifest is the same size as the old one.
rsync -a --checksum --delete --exclude .git --exclude dist \
  --include '/*.html' --include '/deck.js' --include '/deck.css' --include '/latest.js' --include '/latest.json' \
  --include '/llms.txt' --include '/.nojekyll' --include '/README.md' --include '/LICENSE' \
  --include '/assets/***' --include '/docs/***' --include '/examples/***' --include '/skills/***' \
  --exclude '*' ./ site/
mkdir -p site/dist
cp dist/deck.* site/dist/   # add this build's hashed pair (a name is its content hash); older pairs are never removed
cd site
git add -A
if git diff --cached --quiet; then echo "Nothing new to publish"; exit 0; fi
git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
  commit -q -m "Publish ${GITHUB_SHA:-local}"
git push origin HEAD:gh-pages
