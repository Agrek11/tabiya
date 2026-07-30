# Phase 3 Smoke Checklist

Use this before milestone freeze or deploy prep.

## Automated smoke

- Run `npm run test:phase3-smoke`
- Expected: all Lichess/Chess.com sync + OOB detector tests pass.

## Manual smoke

- In Settings, connect Lichess (PKCE flow) and confirm callback returns to app.
- Trigger **Sync now** and verify:
  - game count increases in `/games`
  - provider tags are correct (lichess vs chesscom)
- Open Dashboard OOB widget and confirm at least one OOB event route opens.
- In `/lichess/oob/:gameId/:plyIndex` verify:
  - board loads with red (played) + green (book) arrows
  - "Ask Coach" opens modal and returns engine analysis
  - "Why not this move?" comparison card computes delta
  - drill deep-link opens target line when line exists

## Degraded mode checks

- Without Lichess token: sync buttons must remain explicit and non-crashing.
- Without AI key: OOB coach modal still shows engine block (narration optional).
- With missing line after catalog refresh: route shows `(line removed)` gracefully.
