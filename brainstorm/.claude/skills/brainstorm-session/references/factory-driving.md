# Driving the idea factory

Every work-item call:
`swamp model @swamp/stagecraft/work-item method run <method> $W --skip-reports ...`
against the data set (`SWAMP_REPO_DIR=<dir>` or `--repo-dir <dir>`). `$W` is the
work item (the session's key). The generic engine skill (`stagecraft`) is
installed in the data set too; its `references/driving.md` covers everything
here in full, and this file is the short version for this factory.

Run methods without `--log`, and read their output whole: never filter it
through `grep`, `head` or `tail`, or a prompt, an exit or a refusal is missed.
Run one write per command and read its output before the next.

## Find sessions

Every session has a `run` record naming its factory (work items are created on
`start`, so `swamp model search` does not list them):

```sh
swamp data query 'name == "run" && attributes.factory == "idea-factory"' \
  --select '{"key": attributes.key, "title": attributes.title, "stage": attributes.stage, "status": attributes.status}' --json
```

Offer the parked and active ones (`status` is `active` for both; `stage` says
`parked`), then read `status` on the one the person picks.

## Start, status and the expectation

```sh
swamp model @swamp/stagecraft/work-item method run start $W --skip-reports \
  --input factory=idea-factory --input 'title=<working title>'
swamp model @swamp/stagecraft/work-item method run status $W
```

`status` prints the stage, an `expect:` line, and every exit with what it waits
for. Copy the three `--input expected...=` flags from `expect:` into every
write (written `<expect>` below). A write whose expectation no longer matches is
refused and writes nothing: read `status` again. Every write ends its output
with the status after it.

How to read an exit line:

- `ready` / `not ready: ...`: whether `advance` would take it now, and if not,
  which gate is missing what.
- `(manual)`: only the person sends the session this way; `advance` needs
  `--input confirm=true` and `--input onBehalfOf=<their name>`.
- `[human: <gate-id>]`: the person must approve that gate first.

## Do a stage's work

```sh
swamp model @swamp/stagecraft/work-item method run dispatch $W --skip-reports <expect>
```

`dispatch` prints the stage's prompt (your stance), then a JSON packet:
`products` (each artifact and evidence to record, with its schema), `inject`
(products to read first), and for `committing` and `committing-split` the
`method` or `workflow` to call and its resolved `inputs`. Dispatch once per
attempt at the stage's work, not per tool call. For the `review` stage, add
`--input resultDir=<a scratch directory>`; see adversarial-review.md.

To read a recorded product (to show the person, or to check a value):

```sh
swamp data query 'modelName == "'$W'" && name == "artifact-draft"' --select content --single --json
swamp data query 'modelName == "'$W'" && name == "evidence-duplicate-check"' --select content --single --json
```

## Record products

```sh
swamp model @swamp/stagecraft/work-item method run record_artifact $W --skip-reports \
  --input name=draft --input payload=@$SCRATCH/draft.json <expect>
swamp model @swamp/stagecraft/work-item method run record_evidence $W --skip-reports \
  --input name=duplicate-check --input payload=@$SCRATCH/dup.json <expect>
```

`payload` is inline JSON or `@<path>` to a JSON file; put files in your
scratchpad. A payload that does not fit is refused, kept as retry feedback, and
shown in `status`; fix it and record again.

## Payload shapes

**`raw-notes`** (artifact, intake). The person's own words, as said.

```json
{
  "notes": [
    "I keep losing writes when my phone drops signal.",
    "Not sure about conflicts yet."
  ]
}
```

**`alignment`** (artifact, aligning). `state` is `confirmed` only if the person
actually confirmed your restatement; otherwise `unchecked` or `disputed`.

```json
{
  "restatement": "Your restatement of the idea, in your words.",
  "problem": "The problem behind it, as the person sees it.",
  "boundaries": ["What is out of scope, from their examples."],
  "state": "confirmed",
  "note": "What was checked and any corrections."
}
```

**`draft`** (artifact, refining). Your edited idea. `title`, `summary`,
`statement` and `goal` are required. `elements` is free-form named entries
(problem, audience, approach, what makes it different, assumptions, risks).
`status` is optional (`seed` by default); set `exploring` when reviving.

```json
{
  "title": "Offline sync",
  "summary": "Queue writes locally and sync when signal returns.",
  "statement": "One or two plain sentences saying what the idea is.",
  "goal": "What it is for and what success looks like.",
  "elements": { "problem": "...", "audience": "...", "approach": "..." },
  "openQuestions": ["Which conflict policy?"],
  "tags": ["sync"],
  "project": "myapp"
}
```

**`duplicate-check`** (evidence, gate). `narrowedBy` says how you narrowed the
search. `verdict` is `same-idea`, `overlaps`, `opposes` or `unrelated`;
`decision` is what the person decided (merge, link, keep separate, ignore). An
empty `matches` list is valid when nothing came close.

```json
{
  "narrowedBy": "tag sync; words: offline, queue",
  "matches": [
    { "id": "cache-layer", "verdict": "overlaps", "decision": "link builds-on" }
  ]
}
```

**`review`** (findings artifact, review stage). The subagent writes it; its
prompt carries the schema. Each finding has `id`, `severity` (`critical`,
`high`, `medium`, `low`) and `description`, with the lens in `category`. The
top level also carries `steelman`, `strengths`, `riskiestAssumption` and
`wouldChangeMind`. To record the person's answer to a finding, record the whole
artifact again with that finding's `resolved: true` and `resolutionNote`.

**`commit-run`** (evidence, committing) and **`split-run`** (evidence,
committing-split): `{"status": "succeeded", "runId": "<run id>"}` or
`{"status": "failed", "runId": "<run id>"}`. `runId` is required.

**`split`** (artifact, splitting). `kind` is `component` or `offshoot`. `parent`
is the idea being split (for a component split, rewrite its `statement` as the
umbrella that describes the whole). Its `status` is required and is the person's
call: keep the parent's current status unless they say otherwise. Each part
needs an `id` that is its title in lowercase with every run of non-letters and
non-digits turned into one hyphen, at most 60 characters (`"Conflict Policy"` is
`conflict-policy`); a wrong id makes the links fail. `alignmentState` is
`confirmed` only if the person confirmed that part.

```json
{
  "kind": "component",
  "parent": {
    "id": "offline-sync",
    "title": "Offline sync",
    "summary": "Umbrella for offline support.",
    "status": "exploring",
    "statement": "The umbrella for two parts: a conflict policy and a local queue.",
    "goal": "No lost writes while offline.",
    "elements": { "parts": "Conflict policy; Local queue" }
  },
  "parts": [
    {
      "id": "conflict-policy",
      "title": "Conflict policy",
      "summary": "Merge rules.",
      "statement": "Rules for resolving edits made on both sides.",
      "goal": "Deterministic merges.",
      "alignmentState": "confirmed",
      "alignmentNote": "person confirmed"
    }
  ]
}
```

**`split-check`** (evidence, splitting): the same shape as `duplicate-check`,
covering every part.

## Approvals and the person's decisions

Gate ids and where they sit: `alignment-confirmed` (aligning, `confirmed`),
`draft-ready` (refining, `ready`), `commit-decision` (gate, `commit`),
`review-requested` (gate, `review`), `split-decision` (gate, `split`),
`review-discussed` (review, `reviewed`), `split-ready` (splitting, `ready`),
`discard-confirmation` (`discard`, from any stage).

```sh
swamp model @swamp/stagecraft/work-item method run approve $W --skip-reports \
  --input gateId=draft-ready --input 'note=<what they said>' \
  --input 'onBehalfOf=<the person>' <expect>
swamp model @swamp/stagecraft/work-item method run advance $W --skip-reports \
  --input transition=ready <expect>
```

Call `approve` only after the person has said yes to what you showed them; if
they say no, `decline` with their words. A manual exit is the same: on their
word, `advance` with `--input confirm=true --input 'onBehalfOf=<the person>'`.
Approvals belong to one entry into a stage: after a jump back you need a new
one.

## When something is refused

| Message                                                           | Fix                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `stale: ...`                                                      | read `status`; act on what it says now                                                                                    |
| `... rejected and kept as retry feedback`                         | fix the payload from the errors (also in `status`); record again                                                          |
| `artifact '...' has not been recorded`                            | record it (shape above)                                                                                                   |
| `evidence '...' has not been recorded`                            | record it                                                                                                                 |
| `... not in this entry into '<stage>' (cycle N); record it again` | the stage was re-entered (the gate after a review, say): record fresh evidence, and redo the duplicate check              |
| `awaiting approval '<id>'`                                        | get the person's decision; `approve` only on their words                                                                  |
| `The alignment artifact must record state "confirmed"`            | the person has not confirmed: keep aligning, or ask whether to take `proceed-unconfirmed`                                 |
| `transition ... is manual`                                        | ask the person; `confirm=true` only on their word                                                                         |
| cycle limit, `runaway loop suspected`                             | stop and lay out every exit to the person; a `grant_override` is theirs to give                                           |
