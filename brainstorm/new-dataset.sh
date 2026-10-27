#!/usr/bin/env bash
# Create a new brainstorm data set: a swamp repo with a git-tracked store.
#
#   new-dataset.sh <dir> [--source <path-to-brainstorm-extension>]
#
# One directory is one data set (for example ~/brainstorm-work). Everything the
# spec asks for is done here: a relative datastore path, the gitignored
# .catalog-writers marker, and the index report wired to renderIndex only. The
# script commits and pushes nothing.
set -euo pipefail

usage() {
  echo "usage: $(basename "$0") <dir> [--source <path-to-brainstorm-extension>]" >&2
  exit 2
}

source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target=""
while [ $# -gt 0 ]; do
  case "$1" in
    --source) [ $# -ge 2 ] || usage; source_dir="$2"; shift 2 ;;
    -h | --help) usage ;;
    -*) usage ;;
    *) [ -z "$target" ] || usage; target="$1"; shift ;;
  esac
done
[ -n "$target" ] || usage
[ -f "$source_dir/manifest.yaml" ] || {
  echo "error: no manifest.yaml in $source_dir (use --source)" >&2
  exit 1
}
command -v swamp > /dev/null || { echo "error: swamp is not on PATH" >&2; exit 1; }

if [ -e "$target" ] && [ -n "$(ls -A "$target")" ]; then
  echo "error: $target already exists and is not empty" >&2
  exit 1
fi
mkdir -p "$target"
cd "$target"
target="$(pwd)"

git init -q -b main
swamp repo init > /dev/null
swamp extension source add "$source_dir" > /dev/null
swamp behavior create @meris/brainstorm brainstorm > /dev/null
swamp datastore setup filesystem --path ./store --directories data > /dev/null

# Setup writes an absolute path, which makes every clone use this clone's store.
perl -0pi -e 's/path: >-\n\s+\S+\n/path: .\/store\n/' .swamp.yaml
grep -q '^  path: \./store$' .swamp.yaml || {
  echo "error: could not make the datastore path relative in $target/.swamp.yaml" >&2
  exit 1
}

printf '\n# Per-machine marker written by the datastore\nstore/.catalog-writers/\n' >> .gitignore

# The index report runs only after renderIndex, so ordinary writes stay quiet.
definition="models/@meris/brainstorm/brainstorm.yaml"
[ -f "$definition" ] || { echo "error: $definition not found" >&2; exit 1; }
cat >> "$definition" << 'EOF'
reports:
  require:
    - name: "@meris/brainstorm-index"
      methods: ["renderIndex"]
EOF

swamp doctor extensions --json | grep -q '"overallStatus": "pass"' || {
  echo "error: swamp doctor extensions did not pass in $target" >&2
  exit 1
}

cat << EOF
Created brainstorm data set: $target

Use it from any project:
  export SWAMP_REPO_DIR="$target"
  swamp behavior run brainstorm captureIdea --skip-reports --input title="..."
  swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index
  swamp report get @meris/brainstorm-index --model brainstorm --markdown

Before you commit, check that nothing under vaults/ holds key material
(swamp keeps the key under .swamp/, which is gitignored). Then, yourself:
  cd "$target" && git add -A && git commit -m "Initial brainstorm data set"
  git remote add origin <url> && git push -u origin main
EOF
