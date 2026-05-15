# Wife re-test — Phase 1b Explain Mode (manual gate, R5 #3)

Per Article 13 (weekend pace), pedagogy correctness is judged by the real
beginner user — not by automated tests. This doc captures the gate.

## Test cadence

Saturday after Phase 1b lands. Repeat any time the gold authoring or the
explain rail wording changes substantively.

## Test line

- Opening: Italian Game (Giuoco Piano)
- Line: `italian-giuoco-pianissimo-main` (Pianissimo Mainline, 19 ply)
- Sidecar: `data/explain/italian-giuoco-pianissimo-main.json`

## Procedure

1. Open the app on `npm run dev`.
2. Navigate to Repertoire → Italian Game → Pianissimo Mainline.
3. On the drill page, flip the `[Drill | Explain]` toggle to Explain.
4. Let autoplay run end-to-end without explanation from the observer.
5. After completion, ask: *"Pick any move you remember. Why did White (or
   Black) play that?"*

## Pass criterion

She can describe — unprompted — the *why* of at least one move in the line
(any move). Phrasing is hers; the test passes if the reasoning maps to
something in the corresponding `rationale` block.

Examples of a pass:
- "Black played Ba7 to get out of the way for a future ...c6 break."
- "h3 was so the bishop couldn't pin the knight on f3."

Examples of a fail:
- "I don't remember any of them."
- Recites moves in order but can't connect any move to a plan.

## Outcome log

| Date | Pass / Fail | Move she described | Block reasoning matched? | Notes |
| --- | --- | --- | --- | --- |
| _pending — first run after Phase 1b merge_ | | | | |

## Follow-ups

If pass: document any rationale phrasings she stumbled on so future authoring
can adopt clearer language.

If fail: do NOT re-author against this single user — instead, observe which
plies she lingered on, which she breezed past, and whether the TTS narration
was on or off. Fold the qualitative notes into a v2 authoring pass.
