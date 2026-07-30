# Phase 4b — Grounded-Features Walkthrough (Task 5.2)

**Prompt version:** `v2` (`prompts/coach/v2.txt`)  
**Engine preset:** Balanced (depth 20, multipv 3) unless noted  
**Provider/model:** _(fill at run time)_  
**Run date:** _(fill at run time)_  

This is the **moat proof checkpoint** for 4b.

- Use the **same 10 positions** from `evals/coach/4a-walkthrough.md`.
- Record v2 narration verbatim and rate 1-5 (same rubric as 4a).
- Compare against 4a scores and compute delta.
- Manually audit every explanation for uncited chess claims.

Success criteria (from `requirements-4b.md` / `tasks-4b.md`):

1. Mean rating improvement is **>= +1.0** vs 4a.
2. **Zero uncited chess claims** across all 10 narrations.

---

## Run Instructions

1. Start app: `npm run dev`
2. In Settings -> AI Coach, configure provider/model.
3. For each position below, open drill at that line/ply and press `?`.
4. Paste narration verbatim, assign rating, and mark uncited claims:
   - `no`: every claim is grounded in engine lines or verified facts block.
   - `yes`: at least one claim is asserted without support in provided context.

---

## Positions (same set as 4a)

### 1) Italian Game — after 3.Bc4

- **FEN:** `r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3`
- **Expected engine top move:** Bc5 / Nf6 region (near-equal)
- **4a rating (baseline):** _(copy from 4a run)_
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

### 2) Italian Game — main line, after 4.d3

- **FEN:** `r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4`
- **Expected engine top move:** Nf6
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

### 3) Sicilian Najdorf — after 5...a6

- **FEN:** `rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6`
- **Expected engine top move:** Be2 / Be3 / Bg5 (near-equal cluster)
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:** Honest hedge behavior should appear when top lines are close.

### 4) Sicilian Najdorf — English Attack, after 6.Be3

- **FEN:** `rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq - 1 6`
- **Expected engine top move:** e5 / e6
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

### 5) French Advance — after 5.Nf3 (Black to move)

- **FEN:** `r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R b KQkq - 1 5`
- **Expected engine top move:** Qb6
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

### 6) French Tarrasch — after 3.Nd2

- **FEN:** `rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR b KQkq - 1 3`
- **Expected engine top move:** c5 / Nf6
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

### 7) Caro-Kann Advance — after 3.e5 (Black to move)

- **FEN:** `rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3`
- **Expected engine top move:** Bf5
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

### 8) Italian — Evans-adjacent, after 4.b4!?

- **FEN:** `r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq b3 0 4`
- **Expected engine top move:** Bxb4 / Bb6
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

### 9) Sicilian — Open, after 4...Nf6 5.Nc3

- **FEN:** `rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 3 5`
- **Expected engine top move:** a6 / e5 / g6 (broad near-equal fan)
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:** Strong hedge-rule probe.

### 10) French Advance — pawn-chain tension, after 6.a3

- **FEN:** `r1bqkbnr/pp3ppp/1qn1p3/2ppP3/3P4/P1P2N2/1P3PPP/RNBQKB1R b KQkq - 0 6`
- **Expected engine top move:** c4 / Bd7
- **4a rating (baseline):**
- **4b observed narration:**
  > _(paste verbatim)_
- **4b rating (1-5):**
- **Uncited claim present? (yes/no):**
- **Notes:**

---

## Score Table

| # | 4a rating | 4b rating | Delta (4b-4a) | Uncited claim? |
|---|-----------|-----------|----------------|----------------|
| 1 |           |           |                |                |
| 2 |           |           |                |                |
| 3 |           |           |                |                |
| 4 |           |           |                |                |
| 5 |           |           |                |                |
| 6 |           |           |                |                |
| 7 |           |           |                |                |
| 8 |           |           |                |                |
| 9 |           |           |                |                |
|10 |           |           |                |                |

---

## Completion Summary

- **4a mean:**
- **4b mean:**
- **Mean delta (4b-4a):**
- **Total uncited claims:** _(must be 0)_
- **Hedge behavior quality on near-equal positions (3, 9):**
- **Final verdict:** pass / fail against Phase 4b criteria.
