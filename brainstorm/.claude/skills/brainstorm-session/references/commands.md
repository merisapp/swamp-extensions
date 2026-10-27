# Commands

Every command runs against a data set: prefix with `SWAMP_REPO_DIR=<dir>` or add
`--repo-dir <dir>`. Always pass `--skip-reports` on writes. Check the exact
flags with `swamp help behavior run` if a call fails.

Simple values go on the command line (`--input key=value`, and JSON for lists:
`--input 'tags=["sync","mobile"]'`). Lists of objects and anything long go in a
JSON file passed with `--input-file`. Put those files in your scratchpad, not
the data set.

Methods that name an idea (`linkIdeas`, `recordResearch`, `recordPriorArt`,
`recordCritique`, `updateIdea`) fail with `Idea not found: <id>` if it is not in
the store yet. Write ideas first. An idea's id is its title in lowercase with
hyphens (`"Offline Sync"` is `offline-sync`).

## Create or merge an idea: `captureIdea`

Creates a `seed` with alignment `unchecked`. If the title already exists it
updates that idea and changes only the fields you pass.

```sh
swamp behavior run brainstorm captureIdea --skip-reports \
  --input title="Offline sync" --input summary="Queue writes locally" \
  --input 'tags=["sync"]' --input project=myapp
# park a draft
swamp behavior run brainstorm captureIdea --skip-reports \
  --input title="Offline sync" --input status=draft
```

## Change an existing idea: `updateIdea`

By id. Lists are replaced; `elements` merge by key (an empty value removes a
key); `rawNotes` are appended and never rewritten; `alignment` is stamped with
today's date.

```json
{
  "id": "offline-sync",
  "status": "exploring",
  "statement": "Apps keep working without a network.",
  "goal": "Zero data loss while offline.",
  "elements": { "problem": "Writes are lost when the connection drops." },
  "rawNotes": ["The person's own words, exactly as said."],
  "alignment": { "state": "confirmed", "note": "Boundary: no merge UI." },
  "openQuestions": ["Which conflict policy?"],
  "options": [{ "name": "CRDT", "tradeoff": "Complex", "outcome": "open" }]
}
```

```sh
swamp behavior run brainstorm updateIdea --skip-reports --input-file update.json
```

`status`: `draft`, `seed`, `exploring`, `parked`, `dead`, `shipped`.
`alignment.state`: `unchecked`, `confirmed`, `disputed`. `options[].outcome`:
`chosen`, `rejected`, `open`.

## Link ideas: `linkIdeas`

Kinds: `spawned-from`, `part-of`, `similar-to`, `contradicts`, `builds-on`.
Direction: `from` is the child or the newer idea (`part-of`: from is a component
of to; `spawned-from`: from came out of to).

```sh
swamp behavior run brainstorm linkIdeas --skip-reports \
  --input from=conflict-policy --input to=offline-sync --input kind=part-of \
  --input note="the merge rules"
```

## Research and prior art

```sh
swamp behavior run brainstorm recordResearch --skip-reports \
  --input ideaId=offline-sync --input query="existing offline-first libraries" \
  --input 'sources=["https://example.com/a"]' --input summary="What was found."

swamp behavior run brainstorm recordPriorArt --skip-reports \
  --input name="Some Library" --input url=https://example.com \
  --input overlap="Same queueing idea." --input difference="No conflict policy." \
  --input 'ideaIds=["offline-sync"]'
```

A second `recordResearch` for the same idea is a new version of the same record.

## Review: `recordCritique` and `respondToFinding`

Record what the reviewer returned (see adversarial-review.md for the shape). At
most seven findings; they are stored most severe first.

```sh
swamp behavior run brainstorm recordCritique --skip-reports --input-file critique.json
```

The person's answer to each finding, by the critique's name
(`critique--<idea-id>--<timestamp>`, found with the critique recipe in
recall.md) and the finding's zero-based position in the stored order:

```sh
swamp behavior run brainstorm respondToFinding --skip-reports \
  --input critique=critique--offline-sync--20261027215952960 --input index=0 \
  --input state=rejected --input reason="Out of scope for v1."
```

`state`: `accepted`, `rejected`, `deferred`.

## Index

```sh
swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index   # no --skip-reports
swamp report get @meris/brainstorm-index --model brainstorm --markdown
```

## After writing

Show the person what was written. If they want it saved in git, commit in the
data set yourself when asked (`git -C <dir> add -A && git -C <dir> commit`), and
tell them to push. Never push.
