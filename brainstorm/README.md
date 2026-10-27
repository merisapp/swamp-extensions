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

Recall is done with `swamp data query`, not a method. See [SPEC.md](SPEC.md) for
how an agent is meant to use these during a session.

## License

Apache-2.0. See [LICENSE](LICENSE).
