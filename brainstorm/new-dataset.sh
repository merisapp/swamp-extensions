#!/usr/bin/env bash
# Create a new brainstorm data set: a swamp repo with a git-tracked store.
#
#   new-dataset.sh <dir> [--source <path-to-brainstorm-extension>] [--no-factory]
#
# One directory is one data set (for example ~/brainstorm-work). Everything the
# spec asks for is done here: a relative datastore path, the gitignored
# .catalog-writers marker, the index report wired to renderIndex only, and the
# idea factory (the session process, from factory/idea-factory.yaml) installed on
# @swamp/software-factory. --no-factory skips the last one. The script commits
# and pushes nothing.
set -euo pipefail

usage() {
  echo "usage: $(basename "$0") <dir> [--source <path-to-brainstorm-extension>] [--no-factory]" >&2
  exit 2
}

source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target=""
with_factory=1
while [ $# -gt 0 ]; do
  case "$1" in
    --source) [ $# -ge 2 ] || usage; source_dir="$2"; shift 2 ;;
    --no-factory) with_factory=0; shift ;;
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
# Older swamp wrapped the path (`path: >-` and the value on the next line); newer
# swamp writes it on one line (possibly with $HOME).
perl -0pi -e 's/(datastore:\n(?:  .*\n)*?  path:) (?:>-\n\s+\S+|\S+)\n/$1 .\/store\n/' .swamp.yaml
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

if [ "$with_factory" = 1 ]; then
  template="$source_dir/factory/idea-factory.yaml"
  [ -f "$template" ] || {
    echo "error: no factory/idea-factory.yaml in $source_dir (use --no-factory)" >&2
    exit 1
  }
  swamp extension pull @swamp/software-factory --yes > /dev/null
  swamp model create @swamp/software-factory idea-factory > /dev/null
  model_file="models/@swamp/software-factory/idea-factory.yaml"
  [ -f "$model_file" ] || { echo "error: $model_file not found" >&2; exit 1; }
  # Keep the model's identity header (type, id, name, ...); the template supplies
  # the rest.
  header="$(grep -vE '^(globalArguments|methods):' "$model_file")"
  { printf '%s\n\n' "$header"; cat "$template"; } > "$model_file"
  swamp model method run idea-factory validate > /dev/null || {
    echo "error: the idea factory definition did not validate in $target" >&2
    exit 1
  }

  # The split stage runs a workflow. Start from the scaffold so the workflow
  # keeps the id swamp gave it.
  wf_template="$source_dir/factory/brainstorm-split.yaml"
  [ -f "$wf_template" ] || {
    echo "error: no factory/brainstorm-split.yaml in $source_dir" >&2
    exit 1
  }
  swamp workflow create brainstorm-split --json > /dev/null
  wf_file="workflows/workflow-brainstorm-split.yaml"
  [ -f "$wf_file" ] || { echo "error: $wf_file not found" >&2; exit 1; }
  wf_id="$(grep -m1 '^id:' "$wf_file")"
  { printf '%s\n' "$wf_id"; cat "$wf_template"; } > "$wf_file"
  swamp workflow validate brainstorm-split > /dev/null || {
    echo "error: the brainstorm-split workflow did not validate in $target" >&2
    exit 1
  }
fi

swamp doctor extensions --json | grep -q '"overallStatus": "pass"' || {
  echo "error: swamp doctor extensions did not pass in $target" >&2
  exit 1
}

cat << EOF
Created brainstorm data set: $target

Use it from any project:
  export SWAMP_REPO_DIR="$target"
  swamp model method run idea-factory start --skip-reports --input workItem=<session>
  swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index
  swamp report get @meris/brainstorm-index --model brainstorm --markdown
The brainstorm-session skill drives a session; see it for the full loop.
Consider a Claude Code permission rule that asks before any 'approve' call, so
that only you can approve a gate.

Before you commit, check that nothing under vaults/ holds key material
(swamp keeps the key under .swamp/, which is gitignored). Then, yourself:
  cd "$target" && git add -A && git commit -m "Initial brainstorm data set"
  git remote add origin <url> && git push -u origin main
EOF
