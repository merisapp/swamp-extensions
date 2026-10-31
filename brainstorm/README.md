# @meris/brainstorm

Long-term brainstorming memory for swamp. Ideas, typed links between ideas,
research notes and prior art are stored as versioned swamp data, so an agent
session can recall what was already explored and capture new thinking as it
goes. Nothing is stored outside swamp's datastore.

## Installation

```sh
swamp extension source add /path/to/swamp-extensions/brainstorm
```

## Usage

```sh
swamp behavior create @meris/brainstorm brainstorm
swamp behavior run brainstorm captureIdea --input title="Offline sync" --input summary="Queue writes locally"
swamp behavior run brainstorm linkIdeas --input from=offline-sync --input to=cache-layer --input kind=builds-on
swamp data query 'behavior("brainstorm") && tags.specName == "idea"'
```

Structured arguments (lists, objects) go in a file:

```sh
swamp behavior run brainstorm updateIdea --input-file update.json
```

## Methods

- `captureIdea` creates an idea (id is the slugified title), or updates it if
  the title already exists. Only the fields you pass change.
- `updateIdea` changes fields of an existing idea by id: status, summary, tags,
  `statement`, `goal`, `elements`, `alignment`, `openQuestions`, `options`.
  Lists are replaced, `elements` merge by key (an empty value removes a key),
  and `rawNotes` are appended.
- `linkIdeas` links two existing ideas: spawned-from, part-of, similar-to,
  contradicts, builds-on.
- `recordResearch` stores a research summary and sources for an idea.
- `recordPriorArt` stores a prior-art entry shared across ideas.
- `recordCritique` stores an adversarial review of an idea (at most seven
  findings, stored most severe first).
- `respondToFinding` records your response to one finding of a critique.

An idea's `status` can be `draft`, `seed`, `exploring`, `parked`, `dead` or
`shipped`. Methods that name an idea fail if it does not exist.

- `renderIndex` writes nothing. It exists so the index report has a method to
  run after.

Recall is done with `swamp data query`, not a method. See [SPEC.md](SPEC.md) for
how an agent is meant to use these during a session.

## Index report

`@meris/brainstorm-index` renders everything stored as one page: what needs
attention, drafts, ideas by status, a link graph and per-idea details.

```sh
swamp behavior run brainstorm renderIndex --report @meris/brainstorm-index
swamp report get @meris/brainstorm-index --model brainstorm --markdown
```

Do not add `--skip-reports` to `renderIndex`; it skips the index.

## The idea factory

A brainstorming session is a work item on the idea factory: the
`@swamp/stagecraft` engine running `factory/idea-factory.yaml` as the
`idea-factory` factory. The definition holds the stages (intake, aligning, refining, gate,
review, split, commit, parked), the gates between them, and the agent's prompt
for each phase, plus saved scenarios that `validate` replays.
The factory refuses to advance a stage that has not run, a missing record, a
missing duplicate check, or a missing approval from you. Ideas are written to
the brainstorm store at commit.

The factory is a separate extension (AGPL-3.0-or-later) that `create-dataset.sh`
pulls into the data set; this extension does not depend on it in code. Skip it
with `--no-factory` to use the brainstorm behavior alone. The definition and the
`brainstorm-split` workflow are templates in `factory/`, installed by the script
and not part of the published package.

## Agent skill and data sets

The `brainstorm-session` skill (`.claude/skills/brainstorm-session/`) tells an
agent how to run a session: orient, listen, check it understands the idea,
refine it, and commit it through a gate with a duplicate check and an optional
adversarial review. See [SPEC.md](SPEC.md) for the design.

A data set is a swamp repo with a git-tracked store. Create one with
`create-dataset.sh` from a checkout of this repo (it commits and pushes nothing):

```sh
brainstorm/create-dataset.sh ~/brainstorm-work
export SWAMP_REPO_DIR=~/brainstorm-work   # from any project
```

Keep work and personal ideas in separate data sets.

## License

Apache-2.0. See [LICENSE](LICENSE).
