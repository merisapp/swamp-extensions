# Driving the idea factory

Every call: `swamp model method run idea-factory <method> --skip-reports ...`
against the data set (`SWAMP_REPO_DIR=<dir>` or `--repo-dir <dir>`). `$W` is the
work item. The generic engine skill (`software-factory`) may also be installed
in the data set repo; this file is the version for this factory.

Structured inputs (artifact and evidence payloads) go in a JSON file passed with
`--input-file`, shaped `{"workItem": "...", "name": "...", "payload": {...}}`.
Put those files in your scratchpad.

## Reading the status

`status` writes a record; query only the fields you need:

```sh
Q='modelName == "idea-factory" && name == "status-'$W'"'
swamp data query "$Q" --select '{"stage": attributes.stage.id, "cycle": attributes.stage.cycle}' --json
# your stance for this stage
swamp data query "$Q" --select 'attributes.work.systemPrompt' --json
# which transitions can I take now?
swamp data query "$Q" --select 'attributes.transitions.filter(t, t.satisfied).map(t, t.name)' --json
# why is a transition blocked? (the reasons say exactly what to do)
swamp data query "$Q" --select 'attributes.transitions.filter(t, !t.satisfied).map(t, {"transition": t.name, "blockedBy": t.gates.filter(g, !g.pass).map(g, g.reasons)})' --json
# approvals waiting on the person
swamp data query "$Q" --select 'attributes.pendingApprovals' --json
```

Without a work item, `status` gives the overview of every run:
`swamp data query 'modelName == "idea-factory" && name == "status-_factory"' --select 'attributes.runs' --json`.

## Payload shapes (strict: an undeclared key is rejected)

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

**`review`** (findings artifact, review stage). `id`, `severity` and
`description` are required; severity is `critical`, `high`, `medium` or `low`.
Put the basis and confidence in the description, for example
`"<claim> (basis: research; high confidence)"`, and the lens in `category`.

```json
{
  "findings": [
    {
      "id": "ADV-1",
      "severity": "high",
      "category": "premortem",
      "description": "Cache invalidation is not addressed (basis: reasoning only; medium confidence)."
    }
  ]
}
```

Resolve a finding with the person's answer: `resolve_findings` with
`{"workItem": "...", "artifact": "review", "resolutions": [{"findingId": "ADV-1", "note": "Accepted: add an invalidation section."}]}`.

**`commit-run`** (evidence, committing):
`{"status": "succeeded", "runId": "..."}` or
`{"status": "failed", "runId": "..."}`.

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
covering every part. **`split-run`** (evidence, committing-split):
`{"status": "succeeded", "runId": "<the workflow run id>"}`; the run id is
checked against swamp's own record.

## Approvals

Gate ids and where they sit: `alignment-confirmed` (aligning, `confirmed`),
`draft-ready` (refining, `ready`), `commit-decision` (gate, `commit`),
`review-requested` (gate, `review`), `split-decision` (gate, `split`),
`split-ready` (splitting, `ready`), `discard-confirmation` (`discard`).

```sh
swamp model method run idea-factory approve --skip-reports \
  --input workItem=$W --input gateId=draft-ready --input actor=<the person's name> \
  --input note="<what they said>"
```

Call it only after the person has said yes to what you showed them. `actor` is
the person, not you. Approvals belong to one stage visit: after a jump back you
need a new one.

## When `advance` is refused

Read the message. Typical causes, and the fix:

| Message                                                                            | Fix                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage-executed` ... call record_dispatch                                          | `record_dispatch`, then `advance`                                                                                                                 |
| `artifact '...' has not been recorded`                                             | record it (shape above)                                                                                                                           |
| `evidence '...' has not been recorded`                                             | record it                                                                                                                                         |
| `evidence '...' was recorded in stage '...' cycle N, not during the current entry` | the stage was re-entered (for example the gate after a review): record fresh evidence. Redo the duplicate check, since the draft may have changed |
| `awaiting human approval '<id>'`                                                   | get the person's decision; `approve` only on their words                                                                                          |
| `The alignment artifact must record state "confirmed"`                             | the person has not confirmed: keep aligning, or take `proceed-unconfirmed`                                                                        |
| `runaway-loop-suspected`                                                           | you dispatched the same stage entry three times; stop and ask the person                                                                          |

A stage dies at its `maxCycles` (5 re-entries). If you reach it, ask the person;
a cycle override is their approval, not yours.
