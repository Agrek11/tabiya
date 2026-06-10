/**
 * Ambient type declaration for the `stockfish.wasm` package (no shipped types).
 *
 * The package is an Emscripten UMD module whose default export is an async
 * factory. Calling it returns an engine handle that speaks UCI over
 * postMessage / addMessageListener. We override `locateFile` so the glue
 * resolves its sibling `.wasm` + pthread `.worker.js` from `/stockfish/`
 * (copied into `public/` — see specs/tech.md, Article 1 source availability).
 */
declare module 'stockfish.wasm' {
  export interface StockfishInstance {
    /** Send a raw UCI command (e.g. "uci", "go depth 20"). */
    postMessage(command: string): void;
    /** Register a listener for each UCI output line. */
    addMessageListener(listener: (line: string) => void): void;
    /** Remove a previously registered listener. */
    removeMessageListener?(listener: (line: string) => void): void;
  }

  export interface StockfishModuleOverrides {
    /** Resolve sibling assets (stockfish.wasm, stockfish.worker.js). */
    locateFile?: (path: string, scriptDirectory: string) => string;
  }

  const Stockfish: (overrides?: StockfishModuleOverrides) => Promise<StockfishInstance>;
  export default Stockfish;
}
