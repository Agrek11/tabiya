# Cloudflare Pages Target

Primary hosted target for the static SPA.

## Build settings

- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`

## Required files

- `dist/_headers` (from `public/_headers`)
- `dist/_redirects` (from `public/_redirects`)

## Header requirements

Must include:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These are required for `SharedArrayBuffer` in the Stockfish worker path.

## Scripted deploy

- Helper script: `infra/cloudflare/deploy.sh`
- Required env:
  - `CLOUDFLARE_PAGES_PROJECT`
