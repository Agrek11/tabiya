# Real-User UX Intake Protocol

**Created:** 2026-05-04
**Trigger:** Wife's first cold session of v0.4-phase-0d.1 surfaced 7 friction points that self-testing missed entirely. UX blind spots are real and need a recurring intake mechanism, not "I'll fix it when noticed."

## Why this exists

Self-testing has these blind spots:
- Builder fluency — you know where to click, what state means, which keys do what.
- Familiarity bias — small confusions feel like "I'll get used to it" instead of "this is broken."
- Investment bias — every UX decision feels final once shipped.
- Survivorship — you only test happy paths you already invented.

Real users without those biases find issues in 5-10 min that take you weeks to notice — or never.

## When to run an intake

- After every 2-3 phases ship (no exceptions)
- After any major UX change (board redesign, navigation overhaul, AI surface added)
- Before any blog post or demo recording — bugs found here would embarrass otherwise
- Before alpha launch (mandatory, with 2+ users)

## Who counts as a "real user"

- **Tier 1 (best):** chess-playing non-engineer (wife, chess club friend, club teammate). Zero context on the codebase. Tests both UX AND chess pedagogy.
- **Tier 2 (good):** engineer who doesn't play chess. Tests UX + finds non-chess bugs.
- **Tier 3 (acceptable):** chess-playing engineer who hasn't seen the code. Tests UX, may anchor on chess UX they're used to.

DO NOT count:
- Yourself (defeats purpose)
- Anyone you've already shown the wireframe to (anchored)
- Anyone you've coached through it before (no longer cold)

## How to run a 10-min cold session

### Setup (1 min)

- Sit them in front of the dev server or deployed URL
- Tell them: "This is a chess opening trainer. Try to drill an opening. Tell me what you're thinking out loud. I won't help."
- Hit record (screen capture if available — OBS, Loom, or just QuickTime). Audio recording on phone is fine if no screen capture.

### Observation (8 min)

- Stay silent. Resist the urge to "explain." Every "let me show you" is signal lost.
- Note where they hesitate, where they look confused, where they go off-flow.
- Note literal language they use ("I want to do X" — that's your feature naming).
- Note what they DON'T notice (features hidden in plain sight).

### Debrief (1 min)

- "What was confusing?"
- "What did you expect to happen but didn't?"
- "What would you change first?"

## What to capture

Open a Markdown file: `specs/ux-intake-NNNN-MM-DD-name.md`

Template:

```markdown
# UX intake — YYYY-MM-DD — [tester first name]

**Tester profile:** [tier 1/2/3, chess strength if known, technical background]
**Build:** [git tag or commit short SHA]
**Duration:** [actual minutes]

## Friction points (numbered, ranked by severity)

1. [Symptom] — [impact] — [your hypothesis on root cause]
2. ...

## Confusions

- [Where they hesitated / what they expected]

## Wins (don't only log negatives)

- [What worked, what they liked, what they finished without help]

## Verbatim quotes

- "..."

## Triage

| # | Type | Slot | Owner |
|---|---|---|---|
| 1 | bug / UX / feature gap | phase 0d.2 / 0d.3 / etc | self |
```

## Action protocol

- Triage every friction point within 24 hr
- Slot into right phase (don't pile into "later")
- Bugs → fix in next polish slot of current phase
- UX gaps → next polish phase or wireframe v2
- Feature gaps → backlog, prioritized against existing phase plan
- Don't bury feedback in phase-by-phase silence — leak items into Open Decisions section of plan doc if no clear slot

## Anti-patterns (catch yourself)

- ❌ "They didn't get it because they're not technical" — that's the entire point
- ❌ "I'll explain it next time" — UX failure, not user failure
- ❌ Cherry-picking feedback that matches your priors
- ❌ Adding "tooltips" or "onboarding" to mask UX broken at the core
- ❌ Saying "good feedback!" then not slotting it into plan doc within 24 hr

## Cadence target

- Phase 0d.2 → wife re-test after 0d.2 ships (verify the 6 friction points are resolved)
- Phase 0d.3 → catalog v2 + repertoire restructure → wife OR new tier-1 user
- Phase 1 → SRS feels invisible until queue runs out; non-self test optional
- Phase 1.5 → analytics — show wife the dashboard, ask what numbers mean to her
- Phase 2 → pattern viz — chess club friend who's a stronger player (tier 1 chess pedagogy)
- Phase 3 → Lichess sync — anyone with a Lichess account other than you
- Phase 4 → AI Coach — chess club friend, ask if explanations are useful or vague
- Phase 5 → 5+ alpha users mandatory before blog post

## When to skip a session

Only skip if:
- The phase landing has zero UX surface (pure data layer with no visible UI delta)
- You ran one within the prior 4 weeks AND no UX surface changed since
- The next phase is shipping within 7 days (combine intakes)

Default: don't skip. Cost is 15 min of someone's time + 30 min triage. Cheap insurance.
