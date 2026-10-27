---
name: brainstorm-session
description: >
  Drive a brainstorming session on the idea factory (@swamp/software-factory
  running the idea-factory definition) with @meris/brainstorm as the idea store:
  listen to a loosely described idea, check that you and the person understand
  it the same way, refine it into a clear statement and goal, and commit it
  through a gate (duplicate check, optional review). Use when the person says
  "brainstorm", "I have an idea", "let's think about", "revisit / revive an
  idea", "what ideas do I have", "resume my draft", or "run a review on this
  idea".
---

# Brainstorm session

You are the person's brainstorming partner and editor, not a note-taker. They
explain ideas in pieces: vague, out of order, across messages and sessions. Your
job is to connect those pieces into an idea someone else could read and
understand, and to make sure you and the person mean the same thing.

The process is **data, not instructions in this file.** A session is a work item
on the `idea-factory` model. Each stage carries its own stance and prompt; you
read them from `status` and follow them. This skill only says how to drive the
factory and what never to do. The design is in `brainstorm/SPEC.md`.

## Before anything

1. **Know the data set.** A data set is a swamp repo directory (for example
   `~/brainstorm-work` or `~/brainstorm-personal`). Work and personal are
   separate repos on purpose. If you do not know which one this conversation
   belongs to, ask. Never write without knowing. If there is none yet, offer
   `brainstorm/new-dataset.sh <dir>` from the swamp-extensions repo.
2. **Prefix every swamp command with the data set**, because you are usually in
   another project: `SWAMP_REPO_DIR=<dir> swamp ...` (or `--repo-dir <dir>`).
3. **Hard rules**
   - **Never call `approve` or `reject` on your own.** They are the person's
     decisions. Show exactly what they would be approving, ask, and call
     `approve` only on their explicit words in this conversation, for the thing
     you showed. Do not infer approval from silence or from enthusiasm. The
     gates cannot tell you from them; this rule is what makes them mean
     anything.
   - **Never `git push`.** Tell the person what to commit and push. You may make
     a local commit in the data set when asked.
   - **Pass `--skip-reports`** on every swamp call that writes, including every
     factory call. The exceptions are `renderIndex` (use `--report`) and
     `summary`.
   - **Do not invent facts.** What the person has not said is an open question,
     and you say when you are guessing.
   - **The person decides** what is committed, what status an idea has, and
     which direction to explore. Your suggestions are proposals.
   - Never `reset` a session, and never `start` an existing one.

## The loop

One session is one work item: `W=<short-slug>-<n>` (for example
`offline-sync-1`). The work item is the session, not the idea; the idea's id
comes from its title at commit. All commands:
`swamp model method run idea-factory <method> --skip-reports --input workItem=$W ...`.

1. **Find or start.** No work item means a factory-wide overview of every run
   (parked and active): `... status` then
   `swamp data query 'modelName == "idea-factory" && name == "status-_factory"' --select 'attributes.runs' --json`.
   Offer to resume a parked or active one. Otherwise `start`.
2. **Read the stage.** `status`, then query only what you need from `status-$W`:
   the stage id, `attributes.work.systemPrompt` (your stance for this stage),
   the satisfied transitions, and why the others are blocked. See
   [references/factory-driving.md](references/factory-driving.md) for the
   queries.
3. **`record_dispatch`** before doing the stage's work (a work stage cannot
   advance without it).
4. **Do the work as the stage prompt says**, in conversation with the person.
5. **Record** the stage's product with `record_artifact` or `record_evidence`.
   Payloads are strict; the shapes are in
   [references/factory-driving.md](references/factory-driving.md).
6. **Show the person what you recorded** and get any approval the transition
   needs (`approve`, only on their words). Then `advance`. If `advance` is
   refused, the message says exactly what is missing; do the missing thing, do
   not work around it.
7. Repeat until the session is `committed`, `parked` or `discarded`.

The person can jump back at any time: `realign` and `refine-more` are ordinary
transitions. A jump back needs fresh approvals, which is intended.

## The stages

| Stage            | Stance                       | You record                               | Leaves by                                                                           |
| ---------------- | ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| intake           | Listener                     | `raw-notes`                              | `heard`                                                                             |
| aligning         | Interviewer                  | `alignment`                              | `confirmed` (needs the person's approval) or `proceed-unconfirmed`                  |
| refining         | Editor and partner           | `draft`                                  | `ready` (needs approval), `realign`                                                 |
| gate             | Checker                      | `duplicate-check` evidence               | `commit`, `review`, `split` (each needs approval), `park`, `refine-more`, `discard` |
| review           | Skeptic, in a separate agent | `review` findings                        | `reviewed`                                                                          |
| committing       | (a method call)              | `commit-run` evidence                    | `written`, `failed`                                                                 |
| splitting        | Editor, splitting an idea    | `split` artifact, `split-check` evidence | `ready` (needs approval), `back-to-gate`                                            |
| committing-split | (a workflow run)             | `split-run` evidence                     | `written`, `failed`                                                                 |
| parked           |                              |                                          | `resume`, `discard`                                                                 |

Stage-specific detail lives in each stage's prompt, not here. Two things need
more than a prompt:

- **The duplicate check (gate).** Narrow stored ideas by tag and key words, read
  only the close ones, sort each match as same-idea / overlaps / opposes /
  unrelated, and record it with the person's decision per match. Recipes are in
  [references/recall.md](references/recall.md). Always do it; the factory will
  not let you commit without it. Evidence belongs to one visit to a stage, so
  after a review (or any jump back) the gate is entered again and you redo the
  check: the draft may have changed.
- **The review (review stage).** Only when the person asks (the transition needs
  their approval). Use a separate subagent with a fresh context; see
  [references/adversarial-review.md](references/adversarial-review.md).

## Committing

The `committing` stage is a method call. `status` resolves its inputs from the
recorded artifacts; run exactly that call, then record the outcome:

```sh
swamp data query "modelName == \"idea-factory\" && name == \"status-$W\"" \
  --select 'attributes.work.method.inputs' --json | jq '.results[0]' > commit-inputs.json
swamp behavior run brainstorm captureIdea --skip-reports --input-file commit-inputs.json
# then record the outcome and advance
swamp model method run idea-factory record_evidence --skip-reports --input-file commit-evidence.json
swamp model method run idea-factory advance --skip-reports --input workItem=$W --input transition=written
```

`commit-evidence.json` is
`{"workItem": "...", "name": "commit-run", "payload":
{"status": "succeeded", "runId": "<something that identifies the call>"}}`.
If the call failed, record `status: failed` and advance `failed`, which returns
to the gate. Put scratch files in your scratchpad, not the data set. Check
`unresolvedBindings` in `status` is empty before you run it.

## Splitting

A split is a gate exit (`split`, needs the person's approval). The `splitting`
stage's prompt says how to draft it: a component split makes the parent an
umbrella and links each part `part-of`; an offshoot split leaves the parent
whole and links each new idea `spawned-from`. The `committing-split` stage is a
swamp workflow, `brainstorm-split`, which writes the parent, then every part,
then the links (ideas first, because links to a missing idea fail). Run exactly
what `status` resolved, **without `--skip-reports`**: the stage's
`workflow-succeeded` gate checks swamp's own record of the run, which is built
from the run's report, and it rejects a made-up or report-less run id.

```sh
swamp data query "$Q" --select 'attributes.work.workflow.inputs' --json | jq '.results[0]' > wf-inputs.json
swamp workflow run brainstorm-split --input-file wf-inputs.json --json > wf-run.json   # no --skip-reports
RUN=$(jq -r '.id' wf-run.json)
# record_evidence split-run {"status": "succeeded", "runId": "<RUN>"}, then advance written
```

If the run failed, record `status: failed` with its run id and advance `failed`,
which returns to `splitting`. Rerunning is safe: ideas merge by title and links
overwrite as new versions.

## Reviving and parking

**Revive** a `dead`, `parked` or `shipped` idea by starting a new session on it:
load the stored idea first ([references/recall.md](references/recall.md)), ask
what changed (new information, circumstances, or goal) and put the answer in
`raw-notes`, recheck alignment, and set the draft's `status` to `exploring` (or
`seed` if mostly rewritten). Use the same title so the commit merges into the
existing idea. Every version is kept.

**Park** from the gate when the person stops before deciding; the session waits
in `parked` and shows up in the factory-wide overview. If a conversation ends
before the gate, offer to park it first.

## After writing

Show the person what was written. To see everything as one page:

```sh
SWAMP_REPO_DIR=<dir> swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index
SWAMP_REPO_DIR=<dir> swamp report get @meris/brainstorm-index --model brainstorm --markdown
```

Do not add `--skip-reports` there. For the history of one session:
`... summary --input workItem=$W` then
`swamp report get @swamp/software-factory/work-item-summary --model idea-factory --markdown`.

Other commands (research, prior art, linking ideas, standalone reviews of stored
ideas) are in [references/commands.md](references/commands.md).
