/**
 * No-LangChain lint gate — Task 11.6 (Article 3, R9.6).
 *
 * Runs ESLint programmatically with the project config and asserts the
 * `no-restricted-imports` ban actually fires on `langchain` / `@langchain/*` /
 * `llamaindex` / `crewai` imports — and stays quiet on a clean fixture. A
 * future contributor cannot disable the rule without breaking this test.
 */

import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

async function lint(code: string): Promise<ESLint.LintResult> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(code, {
    filePath: path.join(ROOT, 'src/coach/__lint_fixture__.ts'),
  });
  return result;
}

function restrictedImportErrors(result: ESLint.LintResult): typeof result.messages {
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports');
}

describe('Article 3 lint gate — no AI orchestration frameworks', () => {
  it.each(['langchain', '@langchain/core', 'llamaindex', 'crewai'])(
    'flags `import "%s"` as an error',
    async (pkg) => {
      const result = await lint(`import "${pkg}";\n`);
      const errors = restrictedImportErrors(result);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe(2);
      expect(errors[0].message).toMatch(/Article 3/);
    },
  );

  it('flags langchain subpath imports', async () => {
    const result = await lint(`import { x } from "langchain/agents";\n`);
    expect(restrictedImportErrors(result).length).toBeGreaterThan(0);
  });

  it('passes a clean fixture using the direct SDK', async () => {
    const result = await lint(
      `import Anthropic from "@anthropic-ai/sdk";\nexport const ok = (): string => typeof Anthropic;\n`,
    );
    expect(restrictedImportErrors(result)).toEqual([]);
  });
});
