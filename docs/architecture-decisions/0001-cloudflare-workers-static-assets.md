# ADR 0001: Cloudflare Workers Static Assets

Status: accepted — 2026-07-28.

Tabiya is a local-first Vite SPA with no server-side persistence. Cloudflare Workers Static Assets is the primary live target because it serves `dist/` directly, supports SPA not-found handling, and requires no application Worker entrypoint or Node backend. Docker/nginx remains the secondary self-hosting option.

Consequences: browser data stays local; OAuth/provider behavior remains client-side; COOP/COEP/CSP headers must be verified in the deployed environment.
