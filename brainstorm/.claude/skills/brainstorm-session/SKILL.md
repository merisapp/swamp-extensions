---
name: brainstorm-session
description: >
  Drive a brainstorming session on the idea factory (`idea-factory`, on
  @swamp/stagecraft) with @meris/brainstorm as the idea store: listen to a
  loosely described idea, check that you and the person understand it the same
  way, refine it into a clear statement and goal, and commit it through a gate
  (duplicate check, optional review). Use when the person says "brainstorm", "I
  have an idea", "let's think about", "revisit / revive an idea", "what ideas do
  I have", "resume my draft", or "run a review on this idea".
---

# Brainstorm session

You are the person's brainstorming partner and editor, not a note-taker. They
explain ideas in pieces: vague, out of order, across messages and sessions. Your
job is to connect those pieces into an idea someone else could read and
understand, and to make sure you and the person mean the same thing.

The process is **data, not instructions in this file.** A session is a work item
on the `idea-factory` factory (`@swamp/stagecraft`). Each stage carries its own stance
and prompt; `dispatch` prints it and you follow it. This skill only says how to
drive the factory for this process and what never to do. The generic engine
skill (`stagecraft`) is installed beside it; where they differ, this file wins
for idea sessions. The design is in `brainstorm/SPEC.md`.

## Before anything

1. **Know the data set.** A data set is a swamp repo directory (for example
   `~/brainstorm-work` or `~/brainstorm-personal`). Work and personal are
   separate repos on purpose. If you do not know which one this conversation
   belongs to, ask. Never write without knowing. If there is none yet, offer
   `brainstorm/create-dataset.sh <dir>` from the swamp-extensions repo.
2. **Prefix every swamp command with the data set**, because you are usually in
   another project: `SWAMP_REPO_DIR=<dir> swamp ...` (or `--repo-dir <dir>`).
3. **Hard rules**
   - **Never decide for the person.** `approve`, `decline`, `advance` with
     `confirm=true` (a manual exit: `realign`, `refine-more`, `park`,
     `back-to-gate`, `proceed-unconfirmed`, `resume`) and `reset` are theirs.
     Show exactly what they would be deciding, ask, and run it only on their
     explicit words in this conversation, with `onBehalfOf` naming them. Do not
     infer approval from silence or from enthusiasm. The gates cannot tell you
     from them; this rule is what makes them mean anything.
   - **Never `git push`.** Tell the person what to commit and push. You may make
     a local commit in the data set when asked.
   - **Pass `--skip-reports`** on every swamp call that writes, including every
     work-item call. The exceptions are `renderIndex` (use `--report`) and
     `summary`.
   - **Do not invent facts.** What the person has not said is an open question,
     and you say when you are guessing.
   - **The person decides** what is committed, what status an idea has, and
     which direction to explore. Your suggestions are proposals.
   - Never `reset` a session, and never `start` an existing one.

## The loop

One session is one work item, under a key you choose: `<short-slug>-<n>` (for
example `offline-sync-1`). The work item is the session, not the idea; the
idea's id comes from its title at commit. Every work-item call is
`swamp model @swamp/stagecraft/work-item method run <method> $W --skip-reports ...`;
see [references/factory-driving.md](references/factory-driving.md) for each one.

1. **Find or start.** List the sessions first (factory-driving.md, "Find
   sessions") and offer to resume a parked or active one. Otherwise `start` a
   new key with `factory=idea-factory` and a working title.
2. **Read `status`.** It prints the stage, the `expect:` flags every write
   needs, and every exit with what it is waiting for. Every write prints the
   status after it; act on that, never on memory.
3. **`dispatch`** before doing the stage's work. It prints the stage's prompt
   (your stance) and the products to record with their schemas.
4. **Do the work as the prompt says**, in conversation with the person.
5. **Record** the stage's products with `record_artifact` or `record_evidence`.
   A payload that does not fit its schema is refused and kept as retry
   feedback; fix it and record again.
6. **Advance.** If exactly one exit is ready and it is neither `(manual)` nor
   `[human: ...]`, advance on it. Otherwise show the person what they would be
   deciding, lay out the exits, and do what they say. If `advance` is refused,
   the message says what is missing; do the missing thing, do not work around
   it.
7. Repeat until the session is `committed`, `parked` or `discarded`.

Every way back is manual, so only the person takes it. A jump back needs fresh
approvals and a fresh duplicate check, which is intended.

## The stages

| Stage            | Stance                    | You record                               | Leaves by                                                                         |
| ---------------- | ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| intake           | Listener                  | `raw-notes`                              | `heard`                                                                           |
| aligning         | Interviewer               | `alignment`                              | `confirmed` (approval), `proceed-unconfirmed` (manual)                            |
| refining         | Editor and partner        | `draft`                                  | `ready` (approval), `realign` (manual)                                            |
| gate             | Checker                   | `duplicate-check` evidence               | `commit`, `review`, `split` (each needs approval), `park`, `refine-more` (manual) |
| review           | Skeptic, in a subagent    | `review` findings                        | `reviewed` (approval, after the findings are answered)                            |
| committing       | (a method call)           | `commit-run` evidence                    | `written`, `failed`                                                               |
| splitting        | Editor, splitting an idea | `split` artifact, `split-check` evidence | `ready` (approval), `back-to-gate` (manual)                                       |
| committing-split | (a workflow run)          | `split-run` evidence                     | `written`, `failed`                                                               |
| parked           |                           |                                          | `resume` (manual)                                                                 |

`discard` leaves any stage, on the person's `discard-confirmation`.

Stage-specific detail lives in each stage's prompt, not here. Three things need
more than a prompt:

- **The duplicate check (gate).** Narrow stored ideas by tag and key words, read
  only the close ones, sort each match as same-idea / overlaps / opposes /
  unrelated, and record it with the person's decision per match. Recipes are in
  [references/recall.md](references/recall.md). Always do it; the factory will
  not let you commit without it. Evidence belongs to one entry into a stage, so
  after a review (or any jump back) the gate is entered again and you redo the
  check: the draft may have changed.
- **The review (review stage).** Only when the person asks (the `review` exit
  needs their approval). It is a `dispatch` stage: the engine prints a prompt
  for a fresh subagent, which you send unchanged. Then you go through the
  findings with the person; see
  [references/adversarial-review.md](references/adversarial-review.md).
- **The calls (committing, committing-split).** `dispatch` prints the exact
  method or workflow and its resolved `inputs`; run exactly that and record the
  outcome. See below.

## Committing

The `committing` stage calls `brainstorm captureIdea`. `dispatch` resolves its
inputs from the recorded artifacts and prints them as the packet's `inputs`;
the packet must say `ready: true` (no `problems`). Run exactly that call, then
record the outcome with the run's id:

```sh
# write the packet's inputs object to $SCRATCH/commit-inputs.json
swamp behavior run brainstorm captureIdea --skip-reports --input-file $SCRATCH/commit-inputs.json --json
swamp model @swamp/stagecraft/work-item method run record_evidence $W --skip-reports \
  --input name=commit-run --input 'payload={"status":"succeeded","runId":"<run id>"}' <expect>
swamp model @swamp/stagecraft/work-item method run advance $W --skip-reports \
  --input transition=written <expect>
```

If the call failed, record `status: failed` with its run id and advance `failed`,
which returns to the gate. Never record a run you did not see finish. Put
scratch files in your scratchpad, not the data set.

## Splitting

A split is a gate exit (`split`, needs the person's approval). The `splitting`
stage's prompt says how to draft it: a component split makes the parent an
umbrella and links each part `part-of`; an offshoot split leaves the parent
whole and links each new idea `spawned-from`. The `committing-split` stage runs
the swamp workflow `brainstorm-split`, which writes the parent, then every
part, then the links (ideas first, because links to a missing idea fail). Run
exactly the workflow and `inputs` that `dispatch` printed, and record its run:

```sh
# write the packet's inputs object to $SCRATCH/wf-inputs.json
swamp workflow run brainstorm-split --input-file $SCRATCH/wf-inputs.json --json > $SCRATCH/wf-run.json
# record_evidence split-run {"status": "succeeded", "runId": "<the run's id>"}, then advance written
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

**Park** from the gate when the person stops before deciding (a manual exit, on
their word); the session waits in `parked` and shows up when you list sessions.
Before the gate there is no park exit: a session that ends earlier simply stays
in its stage and is resumed by its key, so tell the person the key.

## After writing

Show the person what was written. To see everything as one page:

```sh
SWAMP_REPO_DIR=<dir> swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index
SWAMP_REPO_DIR=<dir> swamp report get @meris/brainstorm-index --model brainstorm --markdown
```

Do not add `--skip-reports` there. For the history of one session:
`swamp model @swamp/stagecraft/work-item method run summary $W`.

Other commands (research, prior art, linking ideas, standalone reviews of stored
ideas) are in [references/commands.md](references/commands.md).
