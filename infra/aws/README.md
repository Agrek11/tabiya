# AWS Alternate Target (S3 + CloudFront)

Cloud-agnostic alternate to Cloudflare. Uses the same `dist/` artifact.

## Reference architecture

- S3 bucket for static assets
- CloudFront distribution in front of S3
- SPA fallback behavior:
  - rewrite unknown routes to `/index.html` (viewer-request function or custom
    error responses)

## Critical headers

For HTML responses, ensure:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Without these, threaded Stockfish mode will fail.

## Deploy flow

1. `npm run build`
2. Sync `dist/` to S3
3. Invalidate CloudFront cache for updated routes

## Scripted deploy

- Helper script: `infra/aws/deploy.sh`
- Required env:
  - `AWS_S3_BUCKET`
  - `AWS_CLOUDFRONT_DISTRIBUTION_ID`
