import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Cross-origin isolation headers. stockfish.wasm (Phase 4a) is a threaded
// Emscripten build that needs SharedArrayBuffer, which the browser only
// exposes when the document is crossOriginIsolated. Setting COOP/COEP on the
// dev server + preview enables it locally. Production hosting must send the
// same two headers (documented in specs/tech.md). Article 11: if the headers
// are absent the engine load rejects and the Coach degrades — it never crashes
// the trainer.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ESM worker output so `new Worker(new URL('./stockfish-worker.ts',
  // import.meta.url), { type: 'module' })` emits a separate chunk (Article 11
  // lazy-load + Design §1 worker entry pattern).
  worker: {
    format: 'es',
  },
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
})
