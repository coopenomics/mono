// Токены пайщиков подписью — для засева стенда (state/tokens.json).
//
// Вход со стола переводит пайщика на пароль, после чего подпись его больше не
// впускает (AUTH_PASSWORD_SET_KEY_LOGIN_DISABLED). Фазы засева входят подписью,
// поэтому токены снимаются ДО сценариев: раннер зовёт этот помощник после
// создания фикстур, засев читает файл через API_TOKENS_FILE и продлевает
// токены мутацией refresh (components/api-tests/src/core/auth.ts).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env } from './harness.mjs';
import { fixturePath, harnessPorts } from './fixtures.mjs';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');
export const TOKENS_FILE = path.join(HARNESS_ROOT, 'state/tokens.json');

/** Снять токены председателя и перечисленных фикстур; пишет state/tokens.json. */
export function ensureTokens(fixtureNames, { log = () => {} } = {}) {
  const who = [{ account: 'ant', email: env.CHAIRMAN_EMAIL, wif: env.CHAIRMAN_WIF }];
  for (const name of fixtureNames) {
    const file = fixturePath(name);
    if (!fs.existsSync(file)) continue;
    const f = JSON.parse(fs.readFileSync(file, 'utf8'));
    who.push({ account: f.username, email: f.email, wif: f.wif });
  }
  const ports = harnessPorts();
  const whoFile = path.join(HARNESS_ROOT, 'state/tokens-who.json');
  fs.mkdirSync(path.dirname(whoFile), { recursive: true });
  fs.writeFileSync(whoFile, JSON.stringify(who));
  log(`токены подписью: ${who.map((w) => w.account).join(', ')}`);
  const r = spawnSync('pnpm', [
    '--filter', '@coopenomics/boot', 'exec', 'esno',
    path.join(REPO_ROOT, 'components/api-tests/src/seed/tokens.ts'), whoFile, TOKENS_FILE,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      API_URL: `http://127.0.0.1:${ports.controller}/v1/graphql`,
      CHAIN_URL: `http://127.0.0.1:${ports.chain}`,
    },
  });
  fs.rmSync(whoFile, { force: true });
  for (const line of (r.stderr || '').split('\n').filter((l) => l.includes('[tokens]'))) log(line.replace('[tokens] ', ''));
  if (r.status !== 0) throw new Error(`снятие токенов упало:\n${(r.stderr || r.stdout || '').slice(-1500)}`);
  process.env.API_TOKENS_FILE = TOKENS_FILE;
  return TOKENS_FILE;
}

/** Состояние входа стенда, которое не переживает новую цепь. */
export function forgetLoginState() {
  for (const f of ['state/tokens.json', 'state/passwords.json']) {
    fs.rmSync(path.join(HARNESS_ROOT, f), { force: true });
  }
}
