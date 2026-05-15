# Authoring Explain Sidecars — Phase 1b

This doc defines the on-disk shape, validation rules, and editorial style for
per-ply explain blocks. It is the spec consumed by both the LLM prompt
(`prompts/build_explain.j2`) and human reviewers running
`scripts/review_explain.py`.

## File location

```
data/explain/<line_id>.json           # approved (committed, copied to public/)
data/explain/pending/<line_id>.json   # LLM drafts, awaiting review
data/explain/rejected/<line_id>.json  # optional archive
```

`public/explain/<line_id>.json` is **build output** (gitignored). Run
`scripts/build_catalog.py` to validate `data/explain/*.json` and copy approved
sidecars into `public/`.

## JSON shape

```json
{
  "line_id": "italian-giuoco-pianissimo-main",
  "schema_version": 2,
  "blocks": [
    {
      "rationale": "Open lines for the king's bishop and queen, contest the center.",
      "arrows": [{ "from": "e2", "to": "e4", "color": "green" }],
      "highlights": [{ "square": "d5", "intent": "focus" }],
      "threats": null,
      "pauseMs": 2500
    }
    // …exactly one block per ply, in order…
  ]
}
```

### Hard rules (build-time)

1. `len(blocks) === len(line.moves)` — exact equality. Off-by-one fails the
   build.
2. Every arrow `from`/`to` and every highlight `square` matches the regex
   `^[a-h][1-8]$`.
3. `rationale` is non-empty.
4. `pauseMs`, when set, falls in `[500, 20_000]`. Default (when absent) is
   `2500ms`.
5. `schema_version` matches the current `Catalog.schema_version` (currently 2).

Failures raise `ExplainValidationError` during `build_catalog.py`.

### Soft rules (style — enforced by reviewer, not the build)

- `rationale`: 1–3 sentences, beginner-friendly. Name pieces by descriptive
  role ("the king's bishop", "the queen's knight"), not just SAN. Avoid engine
  eval scores ("0.4 better"). No move-list dumps — focus on the *why* of THIS
  move only.
- `arrows`: at most 2 per ply. Color semantics:
  - `green` — the move that is about to play, OR an intended follow-up.
  - `red` — a threat being prevented or a piece under attack.
  - `blue` — piece coordination (e.g. battery, defense).
- `highlights`: at most 3 squares. Intent semantics:
  - `focus` — the square the move fights for (blue glow).
  - `threat` — a square the opponent could exploit (red glow).
  - `support` — a square our pieces shore up (green glow).
  - Omit `intent` for a neutral amber glow.
- `threats`: optional one-sentence "if X then Y" note. Use sparingly — only
  where the line has a real tactical alarm (e.g. Fried Liver alarm in the
  Italian Two Knights).
- `pauseMs`: leave unset for normal moves (default 2500 is fine). Bump to
  3500–4000 for moves the learner needs extra time to absorb (e.g. critical
  tactical alarms, surprising tempo plays).

## Style examples

### Good

> "King's pawn opens lines for the bishop and queen and contests the center
> square d5."

> "Develops the king's bishop to its most active diagonal, where it eyes f7."

### Bad

> "1. e4 is the most popular first move per Lichess Masters database."  
> *(meta-commentary, not the why)*

> "+0.27 according to Stockfish 16."  
> *(engine eval, no pedagogy)*

> "This move develops a piece toward the center and prepares castling and
> opens diagonals and supports later d4 and contests d5 and eyes f7."  
> *(stuffed; pick one or two ideas)*

## Reviewer flow

```
$ uv run python scripts/review_explain.py --line ruy-lopez-closed-main
```

For each ply: read the rationale + arrows + highlights, glance at the board
(`python-chess`'s `Board.unicode()`), and:

- `a` accept
- `e` edit (opens `$EDITOR` on a temp JSON snippet; re-validates on close)
- `r` reject (marks block as null — final save is blocked until fixed)
- `s` skip to next (defers this block; pending file kept)
- `q` quit and save

On all-accepted, the reviewer is prompted to write to `data/explain/<id>.json`
and run the validator synchronously. The `pending/` file is deleted only on
success.

## Building the public bundle

```
$ uv run python scripts/build_catalog.py            # default: validate + copy
$ uv run python scripts/build_catalog.py --skip-explain   # catalog-only rebuild
```

Validation runs over `data/explain/*.json` only (excludes `pending/` and
`rejected/`). On clean pass, files are copied to `public/explain/<id>.json`
for the frontend's `useExplainContent` hook to fetch.
