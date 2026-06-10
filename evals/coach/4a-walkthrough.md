# Phase 4a — Honest-Acceptance Walkthrough (Task 11.10)

**Prompt version:** `v1` (`prompts/coach/v1.txt`)
**Engine preset:** Balanced (depth 20, multipv 3) unless noted
**Provider/model:** _(fill at run time, e.g. Anthropic / claude-haiku-4-5-20251001)_
**Run date:** _(fill at run time)_

> **Expected outcome (by design):** roughly half of these explanations will
> feel shallow or generic. The LLM sees only engine PVs + recent plies — no
> positional features, no motifs, no plans (those are 4b–4d). This document is
> the 4a baseline that later sub-phases must beat; do NOT polish prose to hide
> the shallowness. Article 4 — eval traceability.

How to run: `npm run dev`, configure a provider in Settings → AI Coach, start a
drill on each line below, advance to the listed ply, press `?`. Paste the
narration verbatim. Rate 1–5 — 5 = grounded, specific, correct; 1 = generic
filler or wrong.

| # | Done |
|---|------|
| Positions completed | 0 / 10 |

---

## 1. Italian Game — after 3.Bc4 (White's 3rd)

- **FEN:** `r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3`
- **Expected engine top move:** Bc5 / Nf6 region (near-equal)
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:**

## 2. Italian Game — main line, after 4.d3

- **FEN:** `r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4`
- **Expected engine top move:** Nf6
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:**

## 3. Sicilian Najdorf — after 5...a6

- **FEN:** `rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6`
- **Expected engine top move:** Be2 / Be3 / Bg5 (near-equal cluster)
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:** Near-equal top moves — the honest hedge rule should trigger here.

## 4. Sicilian Najdorf — English Attack, after 6.Be3

- **FEN:** `rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq - 1 6`
- **Expected engine top move:** e5 / e6
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:**

## 5. French Advance — after 5.Nf3 (Black to move)

- **FEN:** `r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R b KQkq - 1 5`
- **Expected engine top move:** Qb6
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:** Matches few-shot EXAMPLE 3 territory — check the model doesn't just parrot the example.

## 6. French Tarrasch — after 3.Nd2

- **FEN:** `rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR b KQkq - 1 3`
- **Expected engine top move:** c5 / Nf6
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:**

## 7. Caro-Kann Advance — after 3.e5 (Black to move)

- **FEN:** `rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3`
- **Expected engine top move:** Bf5
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:**

## 8. Italian — Evans-adjacent, after 4.b4!?

- **FEN:** `r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq b3 0 4`
- **Expected engine top move:** Bxb4 / Bb6
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:** Gambit position — watch for invented "compensation" talk not present in PVs.

## 9. Sicilian — Open, after 4...Nf6 5.Nc3 (deep in book)

- **FEN:** `rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 3 5`
- **Expected engine top move:** a6 / e5 / g6 (broad near-equal book fan)
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:** Widest equal fan in the set — strongest hedge-rule probe.

## 10. French Advance — pawn-chain tension, after 6.a3

- **FEN:** `r1bqkbnr/pp3ppp/1qn1p3/2ppP3/3P4/P1P2N2/1P3PPP/RNBQKB1R b KQkq - 0 6`
- **Expected engine top move:** c4 / Bd7 (note: Qb6 already played — FEN has the queen on b6)
- **Observed LLM explanation:**
  > _(paste verbatim)_
- **Rating (1–5):**
- **Notes:**

---

## Summary (fill after all 10)

- **Average rating:**
- **Hedge rule fired appropriately (positions 3, 9):** yes / no
- **Hallucinated tactics/plans observed:** _(list position #s)_
- **Cost observed (Anthropic usage, cache hits on 2nd+ calls):** _(Open Q4)_
- **Verdict:** baseline recorded — 4b (deterministic features) is the next layer
  and must measurably beat these ratings on the same 10 positions.
