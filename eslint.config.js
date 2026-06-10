import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Underscore prefix = intentionally unused (interface-conformance params
      // like LlamaCppWebGPULLMClient.complete(_p), map callbacks).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Article 3 — no heavy AI orchestration frameworks. The Coach (Phase 4)
      // talks to provider SDKs directly. Banning these at lint time is the
      // load-bearing guardrail; the moat narrative depends on a deterministic
      // symbolic layer, not a framework's hidden agent loop.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['langchain', 'langchain/*', '@langchain/*', 'llamaindex', 'crewai'],
              message:
                'Article 3: no LangChain/LlamaIndex/CrewAI. Use provider SDKs directly via the LLMClient interface (src/coach/LLMClient.ts).',
            },
          ],
        },
      ],
    },
  },
])
