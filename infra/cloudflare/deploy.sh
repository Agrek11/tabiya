#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages deploy helper (manual trigger script).
# Requires: npm, wrangler (`npm i -g wrangler`), authenticated CLI.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler not found. Install with: npm i -g wrangler" >&2
  exit 1
fi

: "${CLOUDFLARE_PAGES_PROJECT:?Set CLOUDFLARE_PAGES_PROJECT env var}"

echo "[1/3] Building dist/"
npm run build

if [[ ! -f "dist/_headers" || ! -f "dist/_redirects" ]]; then
  echo "Missing dist/_headers or dist/_redirects. Check public/ assets." >&2
  exit 1
fi

echo "[2/3] Uploading to Cloudflare Pages project: $CLOUDFLARE_PAGES_PROJECT"
wrangler pages deploy dist --project-name "$CLOUDFLARE_PAGES_PROJECT"

echo "[3/3] Done."
