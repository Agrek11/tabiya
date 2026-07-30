# Capability matrix

This is derived from executable local code and tests, not planning documents.

| Capability | Status | Evidence |
|---|---|---|
| Bundled repertoire catalog and presets | Implemented | `src/storage/JsonOpeningRepository.ts`, `src/pages/RepertoirePage.tsx` |
| Drill state machine and SRS | Implemented | `src/drill/useDrill.ts`, `src/hooks/useSRS.ts`, tests under `tests/drill*` |
| Explain mode, patterns, transpositions | Implemented | `src/hooks/useExplainMode.ts`, `src/hooks/useTransposition.ts` |
| Stockfish analysis and engine play | Implemented | `src/engine/*`, `src/pages/PlayPage.tsx` |
| Lichess and Chess.com import | Implemented | `src/lib/lichess/*`, `src/lib/chesscom/*` |
| Preparation-deviation detection and games list | Implemented | `src/lib/lichess/detect-oob.ts`, `src/pages/GamesPage.tsx` |
| Interactive review | Implemented | `src/pages/ReviewPage.tsx`, `src/analysis/GameAnalysisQueue.ts` |
| Corrective-drill synthesis and persistence | Implemented | `src/analysis/ghostLineSynth.ts`, `src/storage/ghost/*`, `tests/storage/*` |
| Insights | Implemented, scope-limited | `src/pages/InsightsPage.tsx`, `src/hooks/useAccuracy.ts` |
| Scout, structure training, feature search | Experimental | `src/pages/OpponentScoutPage.tsx`, `StructureTrainingPage.tsx`, `FeatureSearchPage.tsx` |
| Contextual Coach and universal FEN Coach | Experimental | `src/coach/CoachPipeline.ts`, `src/pages/CoachPage.tsx` |
| Structured output and citation validation | Experimental | `src/coach/parseStructuredResponse.ts`, `CitationValidator.ts` |
| AI retry/fallback | Experimental | `src/coach/CoachPipeline.ts`, provider clients |
| Automated AI evaluation | Experimental | `tests/coach/*`, `evals/coach/*`; manual walkthrough is incomplete |
| Cloudflare Workers Static Assets | Implemented, local dry-run verified | `wrangler.jsonc`, `scripts/check-runtime-assets.mjs` |
| Docker/nginx deployment | Implemented, not locally Docker-verified | `docker/frontend.Dockerfile`, `docker/nginx.conf` |
| Versioned onboarding | Not present | No onboarding repository or route found |
| Mobile five-destination navigation | Implemented | `TopBar.tsx`, `MobileNavigation.tsx`, `AppShell.tsx` |

Launch copy may describe corrective drills because synthesis, persistence, a route, and local tests are present. Coach narration remains experimental and is never required for training.
