import { ESLint } from 'eslint';

/**
 * Story 6.5: проверяем, что ESLint-запрет `no-authroles-in-authv2` (override в
 * `.eslintrc.json`) бракует роле-ориентированный `@AuthRoles` внутри `auth-v2/`, но
 * НЕ трогает legacy `auth/` (там `@AuthRoles` допустим до Phase-3 cleanup). Тест
 * прогоняет реальный конфиг через ESLint Node API — ловит регресс правила.
 */
const CODE_WITH_AUTHROLES = `import { AuthRoles } from '@coopenomics/extension-kit';
export class Demo {
  @AuthRoles(['chairman'])
  handle() {
    return 1;
  }
}
`;

async function lintAt(filePath: string): Promise<ESLint.LintResult> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(CODE_WITH_AUTHROLES, { filePath });
  return result;
}

const banned = (r: ESLint.LintResult) =>
  r.messages.filter((m) => m.message.includes('no-authroles-in-authv2'));

describe('ESLint no-authroles-in-authv2 (Story 6.5)', () => {
  it('бракует @AuthRoles (импорт и декоратор) в auth-v2/', async () => {
    const result = await lintAt('src/application/auth-v2/demo.resolver.ts');
    expect(banned(result).length).toBeGreaterThanOrEqual(1);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('разрешает @AuthRoles в legacy auth/ (до Phase-3 cleanup)', async () => {
    const result = await lintAt('src/application/auth/demo.resolver.ts');
    expect(banned(result)).toHaveLength(0);
  });
});
