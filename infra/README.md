# Deployment Infra (Cloud-Agnostic)

This folder keeps platform-specific deployment entry points while preserving one
shared build artifact (`dist/`) and one shared local container path
(`docker compose up`).

## Common contract

- Build command: `npm run build`
- Output directory: `dist/`
- Static headers/redirects source: `public/_headers`, `public/_redirects`
- COOP/COEP requirement must stay enabled for Stockfish threading.

## Targets

- Cloudflare Pages (primary): `infra/cloudflare/`
- AWS S3 + CloudFront (alternate): `infra/aws/`

## Release checklist (both targets)

1. `npm run build`
2. Verify `dist/_headers` and `dist/_redirects` exist.
3. Smoke test `/`, `/drill`, `/play`, `/games`, `/lichess/oob/*`.
4. Verify SharedArrayBuffer path works (engine loads and analyzes).
