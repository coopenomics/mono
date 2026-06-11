import { ESLint } from 'eslint';

/**
 * Story 8.7: проверяем, что ESLint-правило `no-sensitive-in-log` (override в
 * `.eslintrc.json`) бракует прямое логирование переменной/поля с секрет-именем
 * (`console.log(privateKey)`, `logger.info(token)`, `logger.error(user.secret)`),
 * но НЕ трогает несекретные аргументы (`publicKey`, строки, объекты-обёртки).
 * Прогон реального конфига через ESLint Node API — ловит регресс правила.
 */
async function lint(code: string, filePath = 'src/some/demo.service.ts'): Promise<ESLint.LintResult> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath });
  return result;
}

const banned = (r: ESLint.LintResult) => r.messages.filter((m) => m.message.includes('no-sensitive-in-log'));

describe('ESLint no-sensitive-in-log (Story 8.7)', () => {
  it('бракует console.log(privateKey)', async () => {
    const r = await lint(`const privateKey = 'x';\nconsole.log(privateKey);\n`);
    expect(banned(r).length).toBeGreaterThanOrEqual(1);
  });

  it('бракует logger.info(token)', async () => {
    const r = await lint(`declare const logger: any;\nconst token = 't';\nlogger.info(token);\n`);
    expect(banned(r).length).toBeGreaterThanOrEqual(1);
  });

  it('бракует logger.error(user.privateKey) — член-выражение', async () => {
    const r = await lint(`declare const logger: any;\nconst user: any = {};\nlogger.error(user.privateKey);\n`);
    expect(banned(r).length).toBeGreaterThanOrEqual(1);
  });

  it('бракует console.log(this.secret)', async () => {
    const r = await lint(`class C { secret = 's'; m() { console.log(this.secret); } }\n`);
    expect(banned(r).length).toBeGreaterThanOrEqual(1);
  });

  it('разрешает logger.info(publicKey) — публичный ключ не секрет', async () => {
    const r = await lint(`declare const logger: any;\nconst publicKey = 'p';\nlogger.info(publicKey);\n`);
    expect(banned(r)).toHaveLength(0);
  });

  it('разрешает logger.info(строку) и logger.info(объект-обёртку)', async () => {
    const r = await lint(`declare const logger: any;\nlogger.info('всё ок');\nlogger.info({ tokenCount: 3 });\n`);
    expect(banned(r)).toHaveLength(0);
  });

  it('правило применяется и в auth-v2 (override несёт оба набора селекторов)', async () => {
    const r = await lint(
      `declare const logger: any;\nconst token = 't';\nlogger.info(token);\n`,
      'src/application/auth-v2/demo.service.ts',
    );
    expect(banned(r).length).toBeGreaterThanOrEqual(1);
  });
});
