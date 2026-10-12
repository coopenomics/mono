// Вход председателя для засева: пароль без смены ключа, токены из стола.
//
// Форма входа стола с 24.09.2026 ставит пароль по ключу доступа и ротирует
// ключ пайщика в цепи. Засев подписывает действия председателя ключом из boot,
// поэтому председателю пароль ставится до сценариев через REST без ротации
// (api-tests/src/seed/passwords.ts). После пароля вход подписью закрыт, и
// токены для засева берутся из сессии стола: харнесс входит председателем в
// headless-браузере и выписывает токены в state/tokens.json (lib/harness.mjs,
// exportSessionTokens); фазы засева читают файл через API_TOKENS_FILE.
//
// Фикстуры пайщиков пароля заранее не получают: их ключом подписывают фазы
// засева, а со стола они входят уже после фаз — ротация им не мешает.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env, HARNESS_PASSWORD, knownPassword, loginAsChairman, openBrowser, rememberPassword } from './harness.mjs';
import { fixturePath, harnessPorts } from './fixtures.mjs';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');
export const TOKENS_FILE = path.join(HARNESS_ROOT, 'state/tokens.json');
/** Токен доступа живёт 30 минут; старше этого — входим снова. */
const TOKEN_FRESH_MS = 20 * 60 * 1000;

function seedEnv() {
  const ports = harnessPorts();
  return {
    ...process.env,
    API_URL: `http://127.0.0.1:${ports.controller}/v1/graphql`,
    CHAIN_URL: `http://127.0.0.1:${ports.chain}`,
    API_TOKENS_FILE: TOKENS_FILE,
  };
}

function runSeedScript(script, args, log) {
  const r = spawnSync('pnpm', ['--filter', '@coopenomics/boot', 'exec', 'esno', path.join(REPO_ROOT, 'components/api-tests/src/seed', script), ...args], {
    cwd: REPO_ROOT, encoding: 'utf8', env: seedEnv(),
  });
  for (const line of (r.stderr || '').split('\n').filter((l) => /^\[(tokens|passwords)\]/.test(l))) log(line.replace(/^\[\w+\] /, ''));
  return r;
}

/** Председателю — пароль харнесса через REST, без смены ключа. Идемпотентно. */
export function ensureChairmanPassword({ log = () => {} } = {}) {
  if (knownPassword(env.CHAIRMAN_EMAIL)) return 'exists';
  const whoFile = path.join(HARNESS_ROOT, 'state/passwords-who.json');
  fs.mkdirSync(path.dirname(whoFile), { recursive: true });
  fs.writeFileSync(whoFile, JSON.stringify([{ account: 'ant', email: env.CHAIRMAN_EMAIL, wif: env.CHAIRMAN_WIF }]));
  const r = runSeedScript('passwords.ts', [whoFile, HARNESS_PASSWORD], log);
  fs.rmSync(whoFile, { force: true });
  if (r.status !== 0) throw new Error(`пароль председателю не поставлен:\n${(r.stderr || r.stdout || '').slice(-1500)}`);
  rememberPassword(env.CHAIRMAN_EMAIL, HARNESS_PASSWORD);
  return 'created';
}

/** Токены фикстур подписью — пока они не вошли со стола. Пишет state/tokens.json. */
export function ensureTokens(fixtureNames, { log = () => {} } = {}) {
  const who = [];
  for (const name of fixtureNames) {
    const file = fixturePath(name);
    if (!fs.existsSync(file)) continue;
    const f = JSON.parse(fs.readFileSync(file, 'utf8'));
    who.push({ account: f.username, email: f.email, wif: f.wif });
  }
  process.env.API_TOKENS_FILE = TOKENS_FILE;
  if (!who.length) return TOKENS_FILE;
  const whoFile = path.join(HARNESS_ROOT, 'state/tokens-who.json');
  fs.mkdirSync(path.dirname(whoFile), { recursive: true });
  fs.writeFileSync(whoFile, JSON.stringify(who));
  log(`токены подписью: ${who.map((w) => w.account).join(', ')}`);
  const r = runSeedScript('tokens.ts', [whoFile, TOKENS_FILE], log);
  fs.rmSync(whoFile, { force: true });
  if (r.status !== 0) throw new Error(`снятие токенов упало:\n${(r.stderr || r.stdout || '').slice(-1500)}`);
  return TOKENS_FILE;
}

/**
 * Живой токен председателя для засева: вход со стола в headless-браузере, если
 * в файле его нет или он старше TOKEN_FRESH_MS. Сценарии, входящие
 * председателем сами, обновляют файл тем же путём.
 */
export async function ensureChairmanTokens({ log = () => {} } = {}) {
  process.env.API_TOKENS_FILE = TOKENS_FILE;
  if (fs.existsSync(TOKENS_FILE)) {
    const ant = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')).ant;
    if (ant?.access && ant.at && Date.now() - ant.at < TOKEN_FRESH_MS) return 'fresh';
  }
  log('вход председателя со стола — токены для засева');
  const { browser, page, context } = await openBrowser();
  try {
    await loginAsChairman(page, context, { signAgreements: false });
  } finally {
    await browser.close();
  }
  return 'renewed';
}

/** Состояние входа стенда, которое не переживает новую цепь. */
export function forgetLoginState() {
  for (const f of ['state/tokens.json', 'state/passwords.json']) {
    fs.rmSync(path.join(HARNESS_ROOT, f), { force: true });
  }
}
