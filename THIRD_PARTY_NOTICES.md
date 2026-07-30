# Third-party notices

This is an engineering inventory, not legal advice. The owner should complete a final license/compliance review before public distribution.

| Component | Distributed use | License / source |
|---|---|---|
| Stockfish via `stockfish.wasm` 0.10.0 | `public/stockfish/stockfish.js`, `.wasm`, pthread worker, and `Copying.txt` | GPL-3.0; [niklasf/stockfish.wasm](https://github.com/niklasf/stockfish.wasm) and [official Stockfish](https://github.com/official-stockfish/Stockfish). The bundled GPL text is preserved at `public/stockfish/Copying.txt`; corresponding source availability must be maintained for the exact shipped binary. |
| Lichess move sound | `public/sounds/Move.mp3` | AGPL-3.0; Lichess project. Source attribution is retained in `src/sound/sounds.ts`. |
| chess.js | Browser chess rules | BSD-2-Clause; [jhlywa/chess.js](https://github.com/jhlywa/chess.js). |
| react-chessboard | Browser board UI | MIT; [Clariity/react-chessboard](https://github.com/Clariity/react-chessboard). |
| Plus Jakarta Sans | Bundled font files | SIL Open Font License; Fontsource package. |
| JetBrains Mono | Bundled font files | SIL Open Font License; Fontsource package. |
| OpenAI, Anthropic, WebLLM SDKs | Optional, lazy browser clients | See installed package metadata; no provider secret is bundled. |

Tabiya's repository license remains the authoritative application license. This notice does not make a conclusion about copyleft scope.
