# Cloudflare Workers Static Assets

Prerequisites: Node 22.12.0 or newer and npm.

```sh
npm ci
npm run verify
npm run cf:dev
npm run cf:dry-run
```

`dist/` is the only deployment directory. The static Worker is configured in `wrangler.jsonc`; it has no Worker entrypoint or server-side persistence. Direct SPA routes are served through `assets.not_found_handling = "single-page-application"`.

For interactive authentication use `npx wrangler login`. In CI or a devcontainer, set `CLOUDFLARE_ACCOUNT_ID=<placeholder>` and `CLOUDFLARE_API_TOKEN=<placeholder>` outside this repository. The token needs Workers Scripts edit, Workers Routes edit when using a custom domain, and account access appropriate to the chosen deployment.

The real deployment command is `npm run cf:deploy`. It was deliberately not run during launch hardening. After deploy, test the workers.dev URL, then add an optional custom domain in Cloudflare. Test Lichess OAuth callback URLs separately with real credentials; callback URLs must use the final workers.dev or custom-domain origin.

Check headers with `curl -I <url>` and browser isolation with `crossOriginIsolated` and `typeof SharedArrayBuffer`. Open the Coach or Play page to confirm Stockfish loads. Inspect the browser console for CSP violations. Roll back through Cloudflare deployment history.

Browser training data remains local to the user's browser. This release process does not upload it.
