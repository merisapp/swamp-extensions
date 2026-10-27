# Recall recipes

Recall is `swamp data query`, not a method. Every recipe below was run against a
real data set. Prefix with `SWAMP_REPO_DIR=<dir>` (or add `--repo-dir <dir>`).
Queries return the latest version of each record by default.

Use `--select` with `--json` to get just what you need, then read it with `jq`:

```sh
SWAMP_REPO_DIR=<dir> swamp data query '<predicate>' --select '<expression>' --json | jq .results
```

Base predicate for ideas: `behavior("brainstorm") && specName == "idea"`.

## Drafts (Orient)

```sh
swamp data query 'behavior("brainstorm") && specName == "idea" && attributes.status == "draft"' \
  --select '{"id": attributes.id, "title": attributes.title, "updated": attributes.updatedAt}' --json
```

## Everything that is not a draft, with status

```sh
swamp data query 'behavior("brainstorm") && specName == "idea" && attributes.status != "draft"' \
  --select '{"id": attributes.id, "title": attributes.title, "status": attributes.status, "tags": attributes.tags}' --json
```

## One idea in full

```sh
swamp data query 'behavior("brainstorm") && name == "<idea-id>"' --select content --json
```

## Duplicate check and related ideas

Narrow first, then read the close ones in full. Two cheap narrowing queries:

```sh
# by tag (use `in`; the macro form attributes.tags.exists(...) is not supported)
swamp data query 'behavior("brainstorm") && specName == "idea" && "sync" in attributes.tags' \
  --select 'attributes.title' --json

# by words in the title and summary (lowercase both sides)
swamp data query 'behavior("brainstorm") && specName == "idea" && (attributes.title + " " + attributes.summary).lowerAscii().contains("offline")' \
  --select '{"id": attributes.id, "title": attributes.title}' --json
```

The statement is optional on older records, so test it with `has()` first:

```sh
swamp data query 'behavior("brainstorm") && specName == "idea" && has(attributes.statement) && attributes.statement.lowerAscii().contains("network")' \
  --select attributes.title --json
```

Run a few queries with different key words from the draft (nouns from the title,
the problem, the goal) and its tags. Also check stored prior art:

```sh
swamp data query 'behavior("brainstorm") && specName == "priorArt"' \
  --select '{"name": attributes.name, "ideaIds": attributes.ideaIds}' --json
```

When there are many ideas, do not read them all: narrow by tag and key words,
read only the close matches, and say that the check was a narrowed one.

## Links, research and critiques for an idea

```sh
# links touching an idea
swamp data query 'behavior("brainstorm") && specName == "link" && (attributes.from == "<id>" || attributes.to == "<id>")' \
  --select '{"from": attributes.from, "kind": attributes.kind, "to": attributes.to}' --json

# parts of an umbrella idea
swamp data query 'behavior("brainstorm") && specName == "link" && attributes.kind == "part-of" && attributes.to == "<id>"' \
  --select attributes.from --json

# research
swamp data query 'behavior("brainstorm") && specName == "research" && attributes.ideaId == "<id>"' \
  --select attributes.summary --json

# critiques (names are critique--<id>--<timestamp>; respondToFinding needs the name)
swamp data query 'behavior("brainstorm") && specName == "critique" && attributes.ideaId == "<id>"' \
  --select name --json
```

## Version history of an idea

```sh
swamp data versions brainstorm <idea-id>
```
