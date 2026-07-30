#!/usr/bin/env bash
set -euo pipefail

# AWS S3 + CloudFront deploy helper (manual trigger script).
# Requires: npm, aws cli v2 configured with credentials.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found." >&2
  exit 1
fi

: "${AWS_S3_BUCKET:?Set AWS_S3_BUCKET env var (bucket name only)}"
: "${AWS_CLOUDFRONT_DISTRIBUTION_ID:?Set AWS_CLOUDFRONT_DISTRIBUTION_ID env var}"

echo "[1/4] Building dist/"
npm run build

echo "[2/4] Syncing dist/ to s3://$AWS_S3_BUCKET/"
aws s3 sync dist "s3://$AWS_S3_BUCKET/" --delete

echo "[3/4] Invalidating CloudFront cache"
aws cloudfront create-invalidation \
  --distribution-id "$AWS_CLOUDFRONT_DISTRIBUTION_ID" \
  --paths "/*"

echo "[4/4] Done."
