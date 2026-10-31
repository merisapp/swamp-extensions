# @meris/brainstorm — spec

Status: draft. Built and tested: the data model and methods (`brainstorm.ts`),
the index report (`brainstorm_index_report.ts`), the idea factory
(`factory/idea-factory.yaml`, the session process on `@swamp/stagecraft`),
the split workflow (`factory/brainstorm-split.yaml`), the agent skill
(`.claude/skills/brainstorm-session/`) and the data set script
(`create-dataset.sh`). The factory enforces the session flow's gates; the stage
prompts carry the agent's stance in each phase; the skill is the thin driver.
The research workflow is **(planned)**.

## Purpose

Long-term brainstorming memory for an agent. A person bounces between ideas in
conversation; the agent recalls what was already explored, researches, surfaces
prior art, and records everything so it survives across sessions and projects.
Swamp data is the only store. There is no note app, no sync and no write-back.

## Decisions

- **Swamp data is the only store.** Human-readable views come from a generated
  report, not from a note app.
- **Single writer per data set.** Exactly one clone of a central repo is ever
  written to. Nobody pulls into it. Git is backup and history only.
- **One central repo per data set** (for example work and personal). Separate
  repos, separate remotes, no cross-set links. Chosen so confidential or
  employer-owned ideas never share a repo with personal ones.
- **The session is a state machine in data, not a workflow and not prose.** The
  `@swamp/stagecraft` engine has no lifecycle of its own; the idea factory
  definition supplies the stages, gates and agent prompts. This is how swamp's
  own interactive flows are built: the phase lives in data, gates are checked
  before a transition, and a skill drives the conversation. Swamp workflows are
  used where the work is deterministic and repeatable: the split
  (`brainstorm-split`) and, later, research.
- **The factory holds the process, brainstorm holds the ideas.** A factory work
  item is one session. The idea's content is written to the brainstorm store
  only at commit, through `captureIdea` (or the split workflow).
- **Gates make the process consistent; they do not make it trustworthy.** An
  approval is a record anyone can write, including the agent. The skill forbids
  the agent from approving on its own, and a permission rule that asks before
  any `approve` call is the one real lever. Method and workflow outcomes are
  self-reported: the driver records the run id and status as result evidence,
  and stagecraft does not check them against swamp's own run records.
- **Research is a normal step, recommended often, never forced.**
- **Recall is `swamp data query`, not a method.**

## Session flow

The agent is a brainstorming partner and an editor, not a note-taker. People
explain ideas in pieces: vague, out of order, across several messages and
sometimes across several sessions. The agent's job is to take all of that and
connect it into an idea that someone else could read and understand. Recording
is a side effect of the conversation, not its purpose.

A session moves through six phases, and the agent takes a different stance in
each. This section is the one place that says what the agent does and when.

| # | Phase               | Stance                   | The agent                                                                                 | Ends when                                     |
| - | ------------------- | ------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0 | **Orient**          | Librarian                | Confirms the data set, offers parked drafts, quietly finds related stored ideas.          | The data set is known                         |
| 1 | **Intake**          | Listener                 | Takes in everything. Does not edit, push back or interrogate.                             | The person has said what they came to say     |
| 2 | **Get up to speed** | Interviewer              | Asks alignment and clarifying questions, then restates the idea and the problem.          | The person confirms the restatement           |
| 3 | **Refine**          | Editor and partner       | Writes the statement, goal and elements; offers options; challenges lightly; links ideas. | The person says the draft is ready            |
| 4 | **Gate**            | Checker                  | Shows the draft, runs the duplicate check, offers the menu.                               | The person commits, parks, splits or discards |
| 5 | **Commit**          | Scribe                   | Writes the records and shows exactly what it wrote.                                       | Records are written                           |
| — | **Review**          | Skeptic (separate agent) | Attacks the idea, only when the person asks (see Adversarial review).                     | The critique is recorded                      |

Nothing is written to the store until the gate, except a parked draft.

### Rules for every phase

- **The stance is the default posture, not a ban.** The person can jump to any
  phase at any point, and if they ask for something from another phase (a
  challenge during intake, say), the agent does it. New information at the gate
  sends the session back to refine.
- **The person is in charge.** Suggestions are proposals. The person decides
  what is committed, what status an idea has, and which direction to explore.
- **No invented facts.** Where the person has not said something, the agent
  leaves it empty, records it as an open question, and says when it is guessing.
- **Read the person.** A correction, a hesitation, "sort of", or an answer to a
  different question is a sign of misalignment. The agent goes back to check
  instead of moving on.

### Orient (librarian)

Confirm the data set (work or personal) before anything else. List parked drafts
(`status == draft`) and offer to resume one. Look for related stored ideas by
tag and title, so the agent knows the neighborhood before the person starts
talking. The agent does not bring these up unless they matter to what the person
says.

### Intake (listener)

The person describes the idea loosely and gives context: where it came from,
what prompted it, what they have already thought about. The agent takes it in
and keeps the person's own words, which become `rawNotes`. It asks nothing
beyond what is needed to keep the person talking, offers no opinion, and does
not restructure what it hears. Premature questions at this stage cut the person
off.

### Get up to speed (interviewer)

The agent's goal is to understand the idea and the problem behind it as the
person does. A clarifying question fills a gap in the idea. An alignment
question tests whether the agent and the person mean the same thing. The agent
does not assume a confident-sounding restatement is a correct one. It asks one
or two questions at a time, not a questionnaire, and:

- **checks the problem as well as the solution:** "is the problem you are
  solving X, or is X a symptom of something else?";
- **probes the boundaries with examples:** "would Y count as this idea?", "what
  would be out of scope?", "what would make you say this isn't what you meant?";
- **asks about priorities and intent:** "which of these matters most if you can
  only have one?", "what would you do with this once it exists?";
- **restates the idea and the problem** in its own words and asks the person to
  confirm or correct it.

Unresolved questions are kept as open questions. The phase ends when the person
confirms the restatement. Alignment is recorded as what the person actually
confirmed (see the `alignment` field), and is rechecked whenever the idea
changes substantially.

### Refine (editor and partner)

The agent takes everything gathered so far and edits it into an idea that
someone else could read and understand. It writes in its own clear prose, not as
a quote of what was said:

- a **statement**: one or two plain sentences saying what the idea is;
- a **goal**: what the idea is for and what success looks like;
- the **other elements** that make it understandable: the problem, who it is
  for, the approach, what makes it different, assumptions, risks, and anything
  else it needs.

It then partners with the person:

- **offers options and suggestions:** variations, alternative approaches, scope
  cuts and extensions, each with a short trade-off and a recommendation when it
  has one, not just a list of possibilities;
- **challenges lightly:** names obvious risks and says when it thinks the idea
  is weak or already done elsewhere. The thorough version is the separate
  review;
- **connects it to memory:** surfaces related, contradicting or overlapping
  ideas from the store, proposes links, and points out prior art it knows or
  found;
- **keeps the draft current:** as the conversation adds detail it revises the
  statement, goal and elements, and says what changed.

The draft lives in the conversation. The phase ends when the person says it is
ready.

### Gate (checker)

At the gate the agent shows the finished draft with its open questions and
confirms alignment is as the person left it, then:

1. **Always runs the duplicate check** and reports the result. It is read-only
   and cheap, and it prevents a second copy of an idea that already exists. The
   agent compares the draft against stored ideas (narrowing by tags and title
   first, then reading the close ones) and against stored prior art, and sorts
   each close match into one of:
   - **same idea:** merge into the existing idea as a new version of it;
   - **overlaps:** keep both and link them (`similar-to` or `builds-on`);
   - **opposes:** keep both and link them (`contradicts`);
   - **unrelated:** ignore.

   The person decides what to do with each match. A draft being edited is
   excluded from its own check; other drafts are included.
2. **Offers the rest as a menu, each on request only:**
   - run an adversarial review (see Adversarial review);
   - run research or a prior-art check;
   - test the draft against particular stored ideas the person names;
   - set the status and tags.
3. **Ends in one of four exits:**
   - **commit:** write the idea as a normal record with status `seed` (or the
     status the person picks);
   - **park:** write it with status `draft`, with whatever the draft has so far
     and `alignment` as it stands;
   - **split:** break the idea into sub-ideas (see Splitting);
   - **discard:** write nothing.

### Commit (scribe)

Commit writes the idea (with `rawNotes` from the intake and refine phases and
`alignment` set to what the person actually confirmed), then any links, prior
art and critique records. It prints what it wrote. If the idea was merged into
an existing one, it is a new version of that record. The order matters: links,
research, prior art and critiques fail if an idea they name does not exist yet,
so every idea, including a split's sub-ideas, is written first. The agent may
make a local git commit in the central repo when asked, and never pushes.

### Drafts

In the factory flow a parked session waits in the `parked` stage, and the
factory-wide `status` overview lists it; nothing is written to the idea store
until a commit. The `draft` status on an idea remains in the schema for records
written without the factory, which is the older way described below.

A parked draft is an `idea` with `status: draft`. It exists so unfinished
thinking survives the end of a session.

- Orient lists drafts (`status == draft`) and offers to resume one. Resuming
  loads the stored draft, and the session continues from the phase the person
  chooses, usually refine or get up to speed.
- Parking an already-parked draft writes a new version of it.
- Committing a draft changes its status from `draft` to the chosen status. No
  second record is created.
- Drafts are not shown as ideas in reports; they are listed separately.
- If a session ends before the gate, the agent offers to park the draft before
  closing.

### Existing ideas

Revisiting a stored idea uses the same flow. Orient loads the stored version,
the session refines it, the gate runs (the duplicate check excludes the idea
itself), and commit writes a new version of the same record.

### Reviving

Picking up a `dead`, `parked` or `shipped` idea is a revival. Every version is
kept, so the idea's history, including the time it was set aside, stays
recoverable. In addition to the normal flow:

- The agent asks what changed: new information, new circumstances or a different
  goal. The answer goes into `rawNotes`, and it is what tells a later
  adversarial review which earlier findings no longer apply.
- The status returns to `exploring`, or to `seed` if the idea is mostly
  rewritten. The person picks.
- Alignment is rechecked, because the person's thinking may have moved since the
  idea was stored.

### Splitting

A split is a gate exit (`split`, needing the person's approval), next to commit,
park and discard. It runs through the `splitting` stage and the
`brainstorm-split` workflow, which writes the parent, then every part, then the
links, and is verified against swamp's run record. There are two kinds, and they
use different links:

| Kind          | Meaning                                                     | Link on each new idea     | Parent afterwards                                                                        |
| ------------- | ----------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| **Component** | The idea is broken into parts that together make the whole. | `part-of` the parent      | Becomes the umbrella: its statement describes the whole and its elements name the parts. |
| **Offshoot**  | A new idea came out of the old one, which remains whole.    | `spawned-from` the parent | Unchanged, keeps its own status.                                                         |

How a split works:

1. The agent drafts each sub-idea as its own record with its own statement and
   goal, and checks alignment for each one.
2. Each sub-idea goes through the duplicate check, since a part may already
   exist as an idea of its own.
3. Everything is written together, as at any commit: the sub-ideas, their links
   to the parent, and the parent's new version if it changed.
4. The parent is never marked `dead` by a split unless the person says so.
5. A sub-idea is a normal idea, so it can be split again.

The umbrella parent's status is set by the person. It does not follow the status
of its parts. Automatic rollup is a possible later addition.

## Adversarial review

A separate step, run only when the person asks. The agent may offer it (for
example at the gate) but never runs it unprompted. The conversation partner is
too close to the idea and to the person to attack it well: it has built the idea
with them and has a pull to agree. So the review is done by a separate agent.

### Setup

- **Fresh context.** The reviewer is a separate subagent. It receives only the
  stored idea (statement, goal, elements, options, research, prior art, open
  questions) and not the conversation, so it cannot inherit the partner's
  rapport or framing.
- **Distinct role.** It is prompted as a skeptic whose job is to find what is
  wrong, not as a second brainstormer. Research on LLM review panels reports
  that giving agents different roles helps and identical roles do not, and that
  agents tend to agree with each other too early. The reviewer uses the same
  model as the partner, to keep things simple. A different model is a possible
  later experiment; I found no evidence either way.
- **Read-only.** It changes nothing. It returns its findings and the session
  agent records them with `recordCritique`.

### Method

The reviewer works through these lenses and skips any that do not apply:

1. **Steelman first.** State the strongest honest version of the idea, so that
   the critique attacks the idea and not a weak reading of it. (This step is my
   own addition; I found no source for it.)
2. **Premortem** (Gary Klein). Assume it is a year later and the idea has
   failed. List the plausible reasons. List only; no fixes during this step,
   because solutions get in the way of an exhaustive list.
3. **Assumption map.** List what must be true for the idea to work. Rate each by
   how much it matters and how much evidence supports it. Name the riskiest
   assumption (important, no evidence) and the cheapest way to test it.
4. **Devil's advocate** (CIA tradecraft). Build the best case for the
   alternative: do nothing, use what already exists, or take the opposite
   approach. Best done last, once the other lenses have run.
5. **Red team** (CIA tradecraft). Take the view of a competitor, a skeptical
   user or someone who would be hurt by the idea, and say how they would react.
6. **Prior art.** Check the stored research and prior art for work that already
   does this, and say how much of the idea is left once it is removed.

### Output rules

- Rank findings by severity: fatal, serious or minor. Report no more than seven;
  more than that buries the ones that matter.
- Every finding states its basis: the stored record, research, a known example,
  or "reasoning only", and a confidence level. An objection with no basis is
  marked as speculation. A wrong disproof is worse than a missing one.
- Findings state problems, not fixes. Fixes belong to the next conversation.
- The review also says what is strong and what would change its mind. It is not
  balanced for its own sake, but a review with no way to be wrong cannot be
  used.
- It does not give a go or no-go verdict. The person decides.

### Recording

A `critique` record per review (see Data model), and the person's response to
each finding: accepted, rejected or deferred, with a reason. A rejected finding
is not raised again by the next review unless the idea has changed.

### Research notes and limits

Sources: Klein's premortem and the CIA's 2009 _A Tradecraft Primer_ (devil's
advocacy, red team, Team A/Team B), assumption mapping and riskiest-assumption
tests from product practice, and several recent papers on LLM debate and critic
agents. The premortem steps and the primer's definitions are from secondary
summaries that I did not check against the originals (Klein's 2007 Harvard
Business Review article and the primer PDF). The claims about LLM review come
from paper abstracts and show a pattern, not a measured effect size for this
use. "Steelman first" and "no more than seven findings" are my own judgment.

## Data model (built)

Five resources, all `lifetime: infinite`. Each write creates a new version of
the named instance.

| Resource   | Instance name                      | Fields                                                                                  | GC versions |
| ---------- | ---------------------------------- | --------------------------------------------------------------------------------------- | ----------- |
| `idea`     | slug of title                      | id, title, summary, status, tags, project?, plus the fields below, createdAt, updatedAt | 1000        |
| `link`     | `<from>--<kind>--<to>`             | from, to, kind, note?, createdAt                                                        | 1000        |
| `research` | `research--<idea id>`              | ideaId, query, sources[], summary, date                                                 | 20          |
| `priorArt` | `prior-art--<slug of name>`        | name, url?, overlap, difference, ideaIds[], date                                        | 1000        |
| `critique` | `critique--<idea id>--<timestamp>` | see below                                                                               | 1000        |

Instance names are what `readResource` looks up, and swamp keys data by name
alone. Ideas keep their bare slug; every other kind has a prefix or a `--`
separator, which a slug never contains, so two kinds cannot share a name and
overwrite each other.

- `status`: `draft` (work in progress, see Drafts), `seed`, `exploring`,
  `parked`, `dead`, `shipped`. Not to be confused with `parked`, which means a
  committed idea the person has set aside.
- `link.kind`: `spawned-from`, `part-of`, `similar-to`, `contradicts`,
  `builds-on`. `spawned-from` means an offshoot that stands on its own;
  `part-of` means the child is a component of the parent (see Splitting).
- `project` on an idea records which project the idea came up in. It is a label,
  not a separate store.

### `idea` fields for the edited idea

The agent's edited version and its open items are stored with the idea, next to
the person's own words, so the edit never replaces the source. All fields are
optional so existing records stay valid. A new idea starts as a `seed` with
`alignment` set to `unchecked`.

- `statement` — the edited one- or two-sentence description of the idea.
- `goal` — what the idea is for and what success looks like.
- `elements` — the other parts of the idea, as named entries such as problem,
  audience, approach, differentiator, assumptions and risks. Entries are free
  text, and the set is not fixed.
- `rawNotes` — the person's own words, appended as they are said, never
  rewritten.
- `alignment` — whether the person has confirmed the agent's understanding:
  `unchecked`, `confirmed` or `disputed`, with the date and a short note of what
  was checked, including the boundary examples and corrections. A statement that
  is `unchecked` or `disputed` is the agent's guess, not the person's idea, and
  reports show it that way.
- `openQuestions` — questions still unanswered, including every element the
  person has not yet described.
- `options` — alternatives or variations discussed, each with a short trade-off
  and a note on whether it was chosen, rejected or left open.

The existing `summary` stays as the short form shown in lists.

### `critique` fields

ideaId, date, lenses used, the steelman, findings (at most seven: claim,
severity, basis, confidence, and the person's response), strengths, the riskiest
assumption with its cheapest test, and what would change the reviewer's mind.
Findings are stored most severe first.

## Methods

Built (see the README for usage):

- `captureIdea` — create an idea, or update it if the title exists. Only the
  fields passed change, and `createdAt` is kept.
- `updateIdea` — change fields of an existing idea by id. Arrays are replaced,
  `elements` merge by key (an empty value removes a key), and `rawNotes` are
  appended. Fails if the idea does not exist.
- `linkIdeas` — link two existing ideas. Fails if either is missing or both are
  the same.
- `recordResearch`, `recordPriorArt` — fail if an idea they name does not exist.
- `recordCritique` — store a review of an existing idea.
- `respondToFinding` — record the person's response to one finding.
- `renderIndex` — writes nothing; exists so the index report has a method to run
  after (see Report).

Planned:

- `gather` research step — evaluate `@webframp/research-collector` (HN,
  Lobste.rs, arXiv, SRE Weekly, RedMonk; methods `gather`, `digest`) with
  `swamp extension info` before pulling it. Fan-out over sources in one method
  call (CLAUDE.md rule 6).

## Data set layout and bootstrap

One directory per data set, for example `~/brainstorm-work`. `create-dataset.sh`
does the whole setup and commits and pushes nothing:

```sh
brainstorm/create-dataset.sh ~/brainstorm-work
```

It runs `git init`, `swamp repo init`, `swamp extension source add`, creates the
`brainstorm` behavior and sets up the datastore, and then fixes what setup gets
wrong or leaves out:

1. Setup writes an absolute `datastore.path` into `.swamp.yaml`; without a fix a
   clone reads and writes the original clone's store. The script makes it
   `./store`.
2. It adds `store/.catalog-writers/` to `.gitignore`. It is a per-machine
   marker.
3. It wires the index report to the `renderIndex` method only, in the behavior
   definition (`reports.require` with `methods: ["renderIndex"]`), so ordinary
   writes stay quiet.
4. It checks `swamp doctor extensions` passes.

Check that nothing under `vaults/` holds key material before committing (swamp
keeps the key under `.swamp/`, which is gitignored). Commit, add the remote and
push yourself.

Other projects reach a data set with `SWAMP_REPO_DIR=~/brainstorm-work` or
`--repo-dir`. Only the central repo needs the extension source. Pass
`--skip-reports` on every write to keep report and log items out of the store.

If the central repo is restored from a clone, delete `.swamp/data/_catalog.db*`
once. The catalog is per-clone and is rebuilt from disk on the next query.

## Session protocol

The working version is the `brainstorm-session` skill
(`.claude/skills/brainstorm-session/`), which a project loads when the person
starts brainstorming. It carries out the session flow above and adds the
commands and recall queries that were tested against a real data set. The spec
describes the design; the skill is the instruction the agent follows, so the two
should not be allowed to drift. Its hard rules:

- Know the data set (work or personal) before writing anything.
- Hold the draft in the conversation until the gate, except to park a draft.
- Always run the duplicate check at the gate. Run reviews, research and
  comparisons only when the person asks.
- Write ideas before anything that names them.
- Pass `--skip-reports` on every write.
- Never `git push`; tell the person what to commit and push.

## Report

`@meris/brainstorm-index` (`brainstorm_index_report.ts`) renders the store as
one page: a needs-attention list (parked drafts, ideas whose alignment is not
confirmed, seeds with no research, unreadable records), drafts listed apart from
ideas, ideas by status, a Mermaid link graph, and per-idea details including
parts, research, prior art and reviews with the person's responses. Unconfirmed
ideas are marked as the agent's guess.

Swamp can only run a report after a method, so the extension has a method that
writes nothing, `renderIndex`, and the data set wires the report to that method
alone:

```sh
swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index
swamp report get @meris/brainstorm-index --model brainstorm --markdown
```

Do not pass `--skip-reports` to `renderIndex`: it skips the index. The report is
stored as swamp data (30 days, five versions), so it shows up in git history
when the store is committed. Markdown only for now; HTML later.

## Workflow (planned)

A swamp workflow for the repeatable research path, run on request: recall
similar, research (fan-out over sources), extract prior art, link and classify,
render the report. Guarded so it is idempotent.

## Fixed bugs and known gaps

Fixed in `2026.10.27.1`:

- `captureIdea` reset `createdAt` on every call.
- `captureIdea` replaced the whole record, so a call with just a title reset the
  summary, status and tags.
- `recordResearch` stored research under the idea's own instance name, so it
  overwrote the idea itself (found by testing in swamp). `recordPriorArt` could
  do the same when a name matched an idea title. Every kind now has its own
  instance names.
- `linkIdeas`, `recordResearch` and `recordPriorArt` did not check that the
  ideas they reference exist.

Known gaps:

- Two writers editing the same idea conflict in git, and conflict markers make
  swamp fail to parse the data. This is why the store has a single writer.
- `create-dataset.sh` is not part of the published package: the registry allows
  only `.ts`, `.json`, `.md`, `.yaml`, `.yml` and `.txt` as additional files, so
  it is used from a checkout of this repo.
- The skill is listed in the manifest and packaged on push. Whether a local
  `extension source add` also installs it into a project is not verified; a
  project can copy `.claude/skills/brainstorm-session/` until it is.
- A record with an older shape is read as stored. Nothing migrates the first
  versions of the schema, so only the optional-fields rule keeps them valid.

## Open questions

- Is a private source host for the collective needed, or does the public repo
  stay as the extension's home? Data sets are always private; only the extension
  is public.
- How should the duplicate check scale once the store holds hundreds of ideas?
  It now narrows by tags and key words with `swamp data query` and reads only
  the close matches, which needs no method. Revisit if that stops finding
  duplicates.
- Can a method hold a draft in the session, or does the agent keep it only in
  the conversation? Current plan: the conversation, plus a parked `draft`.
