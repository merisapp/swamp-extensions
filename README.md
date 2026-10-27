# swamp-extensions

Shared [swamp](https://github.com/swamp-club/swamp) extensions, published under
the `@meris` collective (confirm with `swamp auth whoami --json`).

## Layout

One folder per extension. Each folder is self-contained and published on its own.

Manifests set `paths.base: manifest`, so everything resolves alongside the
manifest.

```
<extension-name>/
├── manifest.yaml        # paths.base: manifest
├── deno.json            # pins dependencies
├── deno.lock
├── README.md
├── LICENSE
├── <behavior>.ts        # export const behavior
├── <behavior>_test.ts
└── <report>.ts          # export const report
```

The repo root is also a swamp repo (`.swamp.yaml`, `vaults/`, `models/`). Use it
as a test bench: add the extension folders as local sources and exercise them.

## Develop

```bash
swamp extension source add "$PWD/<extension-name>"
swamp doctor extensions --json
```

## Publish

```bash
cd <extension-name>
swamp extension fmt manifest.yaml
swamp extension version --manifest manifest.yaml --json
swamp extension quality manifest.yaml --json
swamp extension push manifest.yaml --dry-run
swamp extension push manifest.yaml
```

## Consume from another repo

```bash
swamp extension pull @<collective>/<extension-name>
```
