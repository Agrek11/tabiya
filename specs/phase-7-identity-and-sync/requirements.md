# Requirements: Phase 7 — Identity & Sync (DRAFT — design-ahead, build at public launch)

## Status

**DRAFT requirements only. No implementation scheduled.** Written 2026-06-11 when
the identity question first came up, so launch-time design starts from recorded
decisions instead of re-litigating. Build trigger: the Phase 5 deploy decision
flips to "public launch with accounts" — not before. Phases 4b–4e outrank this
on the ladder.

## Why identity at all

Today tabiya is single-user local-first: the device is the identity, all state
(SRS, repertoire picks, synced games, OOB events) lives in IndexedDB/localStorage
(Articles 11, 12). Identity earns its existence ONLY when a public launch makes
one or both of these real:

1. **Multi-device continuity** — same SRS schedule and repertoire on phone +
   laptop. Requires server-held state + a way to say "this is the same human."
2. **Public-deployment accounts** — many users on one hosted origin, each with
   private server-side data.

Login/logout WITHOUT server-held data is security theater and is explicitly
rejected.

## Decisions locked at draft time (2026-06-11)

### D1 — Federated-first; NO custom passwords

Username/password is rejected: it maximizes liability (hash storage, resets,
breach disclosure, credential stuffing) and minimizes UX. Sign-in options, in
priority order:

| Provider | Mechanism | Notes |
|---|---|---|
| **Lichess** | OAuth2 PKCE (already implemented in Phase 3 — `src/lib/lichess/oauth.ts` generalizes) | Perfect audience fit: chess players. Public OAuth, no fees. |
| **Google** | OIDC (`accounts.google.com`), PKCE, registered client | Broadest coverage. |
| **Passkeys (WebAuthn)** | Platform authenticator, usernameless | The no-provider fallback — modern replacement for passwords. |
| **Email magic link** | Short-lived signed token via email | Lowest-friction fallback if passkeys are too new for the audience. OPTIONAL — decide at build. |
| ~~chess.com~~ | — | **IMPOSSIBLE**: chess.com OAuth is partner-only (verified 2026-06-11). The chess.com game-sync username link (Phase 3 addendum) is NOT identity and stays as-is. |

### D2 — Local-first is PRESERVED, account is additive

Constitution amendment required, but as an evolution, not a reversal:

- The app keeps working 100% with no account — local IndexedDB remains the
  primary store (Article 11 intact for anonymous use).
- An account ADDS sync: local state replicates to the server when signed in.
- Logout returns to pure-local; local data is NOT deleted on logout.
- Conflict policy and offline-edit merge are the hard design problems — see
  Open Questions. SRS state is a CRDT-friendly shape (per-line monotone-ish
  box transitions + timestamps); repertoire pick is last-writer-wins material.

### D3 — Backend appears here, not earlier

This phase introduces tabiya's first backend (Article 12 amendment): auth
broker + sync API + user DB. Stack decided at build time; constraints now:
- OSS-only (Article 1). No Auth0/Clerk/Firebase-Auth proprietary lock-in.
  Candidates: self-hosted Keycloak / Ory / hand-rolled OIDC client layer
  (PKCE knowledge already in-repo) — evaluate at build.
- Token model: short-lived access + rotating refresh, httpOnly cookies on the
  hosted origin (NOT localStorage for session tokens on a multi-user origin).
- The existing `SensitiveStore` localStorage convention is for the LOCAL
  single-user trust model only; it does NOT extend to hosted sessions.

### D4 — What syncs (initial scope)

| Data | Syncs? | Merge policy (draft) |
|---|---|---|
| SRS state (`srs_state`) | yes | per-line, newest `last_reviewed` wins; box regression allowed |
| Repertoire pick | yes | last-writer-wins, tombstone deletes |
| Session events / telemetry | yes (append-only) | union by id |
| Lichess/chess.com game records + OOB events | NO initially | re-syncable from source APIs on any device; server copy is waste |
| Settings (theme, sounds, engine preset) | no | device-appropriate, cheap to re-pick |
| AI provider API keys | **NEVER** | secrets stay on-device, full stop |

## Requirements (skeleton — expand at build)

### R1 — Sign in / sign out
1. Settings SHALL offer "Sign in" with Lichess, Google, and Passkey options.
2. Sign-out SHALL end the server session and return the app to pure-local
   operation without deleting local data.
3. An anonymous user's existing local data SHALL be adoptable into a new
   account on first sign-in (one-way local → account import, with prompt).

### R2 — Session
1. Hosted sessions SHALL use httpOnly secure cookies; no session token is
   readable from JS.
2. Access tokens SHALL be short-lived; refresh SHALL rotate.

### R3 — Sync
1. Sync SHALL be incremental and resumable; full-state upload only on adopt.
2. Offline edits SHALL merge per the D4 policies; no sync error may corrupt
   local state (local always recoverable).

### R4 — Account lifecycle
1. Account deletion SHALL delete all server-held data (GDPR-shaped) and leave
   local data intact.
2. Provider unlink SHALL be possible while ≥1 sign-in method remains.

### R5 — Quality gates
1. Auth flows contract-tested with mocked providers; PKCE/state assertions
   reuse the Phase 3 oauth test patterns.
2. Sync merge property-tested (idempotent, commutative for concurrent edits
   within policy).
3. Security review sign-off required (session fixation, CSRF on the cookie
   origin, OAuth redirect hardening) before launch.

## Open questions (decide at build)

1. Passkeys vs magic-link as the no-provider fallback (or both)?
2. Sync transport: plain REST + per-store cursors vs CRDT library? (Bias:
   boring REST + cursors; CRDT only if merge policies outgrow it.)
3. Account-merge when the same human signs in with Lichess on one device and
   Google on another (email-claim linking? explicit link UI?).
4. ~~Hosting/cost model~~ — RESOLVED, see "Infra & cost direction" below.
5. Does the Coach FREE tier (WebGPU) change on hosted origin? (COOP/COEP
   headers required for stockfish.wasm regardless — already documented.)

## Infra & cost direction (recorded 2026-06-11)

The local-first architecture is the cost strategy: ALL heavy compute (Stockfish
WASM, WebGPU LLM, BYOK cloud calls) runs client-side. The server holds only
sync state — SRS is ~5 KB/user (51 lines × ~100 B), so 100k users ≈ 500 MB.

**Stack DECISION (2026-06-11): CLOUD-AGNOSTIC core, launch on the cheapest
runner.** Portability comes from the architecture (the server-side twin of
Article 5), NOT from abstraction frameworks or Kubernetes — those buy
portability with permanent complexity and are rejected.

Portable-by-construction layers:

| Layer | Portability mechanism | Cloudflare / AWS / Azure runner |
|---|---|---|
| HTTP/API | **Hono** — web-standard fetch handlers, one codebase, native adapters per platform | Workers / Lambda / Azure Functions |
| Domain logic (sync, merge, OIDC flows) | pure TypeScript, zero platform imports | identical everywhere |
| Storage | `SyncStore` interface (server twin of the repository pattern); per-user KV-shaped rows | D1 / DynamoDB / Cosmos DB |
| Auth | standard OIDC PKCE (provider- and cloud-agnostic) | identical everywhere |
| Frontend | static files + COOP/COEP headers | Pages / S3+CloudFront / Static Web Apps |

Per-cloud residue that is NOT abstracted (accepted): one small deploy config
each, headers config, billing alarms. Switching or adding a cloud = adapter +
deploy config, weekend-sized by design — verified by a CI job that builds the
API for ≥2 runtimes from day one.

**Launch default: Cloudflare** (free egress, $5 flat Workers, edge-global by
default — wins cost/ease/ops/global on merit). AWS = first alternate (owner's
PERSONAL account ONLY — never the employer scratch account) and the natural
home if heavy backend features (queues, batch eval, hosted-LLM proxy at
scale) appear later. Azure = supported by the same seams, no earlier
commitment. AWS multi-region note: Lambda is regional; true global on AWS
means Global Tables + N-region deploys + latency routing — a real project
Cloudflare makes unnecessary at this size.

Cost curve (launch runner): ~$0 to ~2k DAU → $5-30/mo to ~50k DAU →
usage-linear; serverless autoscale is default behavior, no step functions.

**Revenue alignment:** free = local-only app (static files, $0 marginal) and
free accounts (sync ≈ $0 marginal). Paid tier ($2-4/mo) = hosted Coach
narration (tabiya-keyed LLM proxy) — the ONE feature with real marginal cost
sits exactly behind the paywall, per-token cost offset by subscription. BYOK
and WebGPU tiers stay free permanently.

## Constitution impact

- Article 11 (local-first): AMEND to "local-first, account-optional" — anonymous
  full function is non-negotiable and permanently tested.
- Article 12 (backend optional): AMEND — backend exists for auth+sync, but the
  self-hosted/offline path remains first-class (docker-compose gains optional
  auth+sync services; frontend-only compose keeps working).
- Article 1 (OSS-only): binds the auth stack choice (no proprietary IdP SDKs).

## Explicitly rejected

- **Username/password** — liability without benefit (D1).
- **chess.com as IdP** — no public OAuth (D1 table).
- **Login without server-held data** — theater; rejected 2026-06-11.
- **Syncing AI API keys** — never.
