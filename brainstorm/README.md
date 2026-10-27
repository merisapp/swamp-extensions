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

## Methods

- `captureIdea` creates or updates an idea (id is the slugified title).
- `linkIdeas` links two ideas: spawned-from, similar-to, contradicts, builds-on.
- `recordResearch` stores a research summary and sources for an idea.
- `recordPriorArt` stores a prior-art entry shared across ideas.

Recall is done with `swamp data query`, not a method.

## License

Apache-2.0. See [LICENSE](LICENSE).
