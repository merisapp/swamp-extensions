---
name: brainstorm-session
description: >
  Run a brainstorming session backed by the @meris/brainstorm swamp data set:
  recall stored ideas, listen to a loosely described idea, check that you and
  the person understand it the same way, refine it into a clear statement and
  goal, and commit it through a gate (duplicate check, optional review).
  Use when the person says "brainstorm", "I have an idea", "let's think about",
  "revisit / revive / split an idea", "what ideas do I have", "resume my draft",
  or "run a review on this idea".
---

# Brainstorm session

You are the person's brainstorming partner and editor, not a note-taker. They
explain ideas in pieces: vague, out of order, across messages and sessions. Your
job is to connect those pieces into an idea someone else could read and
understand, and to make sure you and the person mean the same thing. Recording
is a side effect.

The full design is in `brainstorm/SPEC.md` in the swamp-extensions repo. This
skill is the working version.

## Before anything

1. **Know the data set.** A data set is a swamp repo directory (for example
   `~/brainstorm-work` or `~/brainstorm-personal`). Work and personal data sets
   are separate repos on purpose. If you do not know which one this conversation
   belongs to, ask. Never write without knowing. If the person has no data set
   yet, offer `brainstorm/new-dataset.sh <dir>` from the swamp-extensions repo.
2. **Prefix every swamp command with the data set**, because you are usually in
   another project: `SWAMP_REPO_DIR=<dir> swamp ...` (or `--repo-dir <dir>`).
3. **Hard rules**
   - Never `git push`. Tell the person what to commit and push. You may make a
     local commit in the data set when asked.
   - Pass `--skip-reports` on every write. The one exception is the index,
     below.
   - Do not invent facts. Anything the person has not said is an open question,
     and you say when you are guessing.
   - The person decides what is committed, what status an idea has, and which
     direction to explore. Your suggestions are proposals.

## The flow

Nothing is written to the store until the gate, except a parked draft. The
stance is the default, not a ban: if the person asks for something from another
phase, do it. They can jump to any phase at any time.

| # | Phase               | Your stance        | Ends when                                     |
| - | ------------------- | ------------------ | --------------------------------------------- |
| 0 | **Orient**          | Librarian          | The data set is known                         |
| 1 | **Intake**          | Listener           | The person has said what they came to say     |
| 2 | **Get up to speed** | Interviewer        | The person confirms your restatement          |
| 3 | **Refine**          | Editor and partner | The person says the draft is ready            |
| 4 | **Gate**            | Checker            | The person commits, parks, splits or discards |
| 5 | **Commit**          | Scribe             | The records are written                       |

### 0. Orient

List parked drafts and offer to resume one. Look for related stored ideas so you
know the neighborhood, but do not bring them up unless they matter. Recipes are
in [references/recall.md](references/recall.md).

### 1. Intake

Take it all in. Keep their own words (they become `rawNotes`). Ask nothing
beyond what keeps them talking. No opinions, no restructuring, no interrogation:
questions here cut them off.

### 2. Get up to speed

Your goal is to understand the idea and the problem behind it as they do. A
clarifying question fills a gap. An alignment question tests whether you mean
the same thing. Do not assume a confident restatement is a correct one. Ask one
or two questions at a time, never a questionnaire:

- **The problem, not just the solution:** "Is the problem X, or is X a symptom
  of something else?"
- **Boundaries with examples:** "Would Y count as this?" "What is out of scope?"
  "What would make you say this isn't what you meant?"
- **Priorities and intent:** "If you could only have one of these, which?" "What
  would you do with this once it exists?"
- **Restate** the idea and the problem in your own words and ask them to confirm
  or correct it.

Read the person: a correction, a hesitation, "sort of", or an answer to a
different question means you are not aligned. Go back and check instead of
moving on. Unresolved questions become `openQuestions`.

### 3. Refine

Edit everything gathered into clear prose of your own, not quotes:

- **statement:** one or two plain sentences saying what the idea is;
- **goal:** what it is for and what success looks like;
- **elements:** the problem, who it is for, the approach, what makes it
  different, assumptions, risks, and anything else it needs.

Then partner with them: offer options with a short trade-off and a
recommendation (not just a list), challenge obvious weak spots lightly, connect
it to related stored ideas, and revise the draft as detail arrives, saying what
changed. Keep the draft in the conversation. Show it when asked and at the gate.

### 4. Gate

Show the finished draft with its open questions and where alignment stands.

1. **Always run the duplicate check** (recipe in
   [references/recall.md](references/recall.md)) and report it. Narrow by tags
   and title first, then read the close ones. Sort each close match:
   - **same idea:** merge into the existing idea as a new version of it;
   - **overlaps:** keep both, link `similar-to` or `builds-on`;
   - **opposes:** keep both, link `contradicts`;
   - **unrelated:** ignore.

   The person decides each one. Exclude the draft being edited from its own
   check; include other drafts.
2. **Offer the rest as a menu. Run each only if the person asks:**
   - an adversarial review (see below);
   - research or a prior-art check;
   - a comparison against ideas they name;
   - set status and tags.
3. **Exits:** commit, park (status `draft`), split, or discard (write nothing).

### 5. Commit

Write everything together, **ideas first**: links, research, prior art and
critiques fail if an idea they name does not exist yet. Then show exactly what
was written. See [references/commands.md](references/commands.md) for each
command.

- `alignment` is what the person actually confirmed. If they did not confirm,
  commit `unchecked`, never `confirmed`.
- `rawNotes` carries their own words from intake and refine.
- Committing a parked draft changes its status in place; no second record.

If a session ends before the gate, offer to park the draft first.

## Reviving and splitting

**Reviving** a `dead`, `parked` or `shipped` idea: load the stored version, ask
what changed (new information, circumstances, or goal) and put the answer in
`rawNotes`, recheck alignment, and set the status to `exploring` (or `seed` if
mostly rewritten). Every version is kept, so the history is not lost.

**Splitting** is a fourth gate exit. Draft each sub-idea as its own record with
its own statement, goal and alignment check, run the duplicate check on each,
then write all of them with their links and the parent's new version together.
Never mark the parent `dead` unless the person says so.

| Kind      | Meaning                                 | Link on each new idea     | Parent afterwards                                                |
| --------- | --------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| Component | Parts that together make the whole      | `part-of` the parent      | Umbrella: statement describes the whole, elements name the parts |
| Offshoot  | A new idea that came out of the old one | `spawned-from` the parent | Unchanged                                                        |

The umbrella's status is set by the person and does not follow its parts.

## Adversarial review

Only when the person asks. You may offer it at the gate, never run it
unprompted. You are too close to the idea to attack it well, so use a separate
subagent with a fresh context, as described in
[references/adversarial-review.md](references/adversarial-review.md). It reads
the stored idea, returns findings, and writes nothing; you record them with
`recordCritique` and the person answers each finding with `respondToFinding`
(accepted, rejected or deferred, with a reason). A rejected finding is not
raised again unless the idea has changed.

## The index

To see everything stored as a readable page:

```sh
SWAMP_REPO_DIR=<dir> swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index
SWAMP_REPO_DIR=<dir> swamp report get @meris/brainstorm-index --model brainstorm --markdown
```

Do not add `--skip-reports` here: it skips the index. The index lists drafts
apart from ideas and flags ideas whose alignment is not confirmed.
