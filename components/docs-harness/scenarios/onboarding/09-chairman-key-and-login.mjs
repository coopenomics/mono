// Сценарий: перехват invite-токена председателя из БД partner1, установка
// пароля на странице приглашения и вход в кабинет.
//
// Поток после 08-chairman-install-on-partner-dev:
//   1. install.interactor.ts на partner1 отработал installSoviet(): совет
//      создан on-chain, в `tokens` (Postgres partner1) появилась запись
//      type='invite' для председателя.
//   2. Письмо с приглашением на chairman.partner1@example.com не дойдёт, но
//      токен уже в базе — забираем его по SSH (psql в контейнере partner1).
//   3. Открываем `${BASE_URL}/${COOPNAME}/auth/invite?token=<token>`.
//      Страница показывает почту приглашённого и просит задать пароль; ключ
//      подписи создаётся в браузере, шифруется паролем и уходит в хранилище
//      кооператива — на экране его нет (19.10.2026).
//   4. Пароль дважды → «Задать пароль и войти» → кабинет председателя.
//      Пароль сохраняется в state/cooperatives/partner1-chairman.json.

import { env } from '../../lib/harness.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOP_FIXTURE_PATH = resolve(__dirname, '../../state/cooperatives/partner1.json');
const CHAIRMAN_FIXTURE_PATH = resolve(__dirname, '../../state/cooperatives/partner1-chairman.json');
const PARTNER_FIXTURE = JSON.parse(readFileSync(COOP_FIXTURE_PATH, 'utf-8'));

// SSH-фикстура — где живёт partner1 в dev-loop'е.
const PARTNER_SSH = process.env.PARTNER_SSH || 'user1@91.218.246.46';
const PARTNER_PG_CONTAINER = process.env.PARTNER_PG_CONTAINER || 'partner1-postgres';
const PARTNER_PG_DB = process.env.PARTNER_PG_DB || 'partner1';
const PARTNER_PG_USER = process.env.PARTNER_PG_USER || 'root';

const CHAIRMAN_EMAIL = process.env.CHAIRMAN_EMAIL_NEW || 'chairman.partner1@example.com';

export const meta = {
  title: 'Председатель Партнёра-1 задаёт пароль по приглашению',
  docPath: 'new/onboarding/09-chairman-key-and-login.md',
  assetsDir: 'assets/new/onboarding/09-chairman-key-and-login',
  role: 'partner-chairman',
};

function fetchLatestInviteToken() {
  // Достаём свежий неблэклистнутый invite-токен из tokens-таблицы
  // partner1-postgres. expires нужно > now чтобы токен не истёк.
  const sql = `SELECT token FROM tokens WHERE type='invite' AND blacklisted=false AND expires > NOW() ORDER BY created_at DESC LIMIT 1;`;
  const cmd = `ssh -o StrictHostKeyChecking=no ${PARTNER_SSH} "sudo docker exec ${PARTNER_PG_CONTAINER} psql -U ${PARTNER_PG_USER} -d ${PARTNER_PG_DB} -t -A -c \\"${sql}\\""`;
  const out = execSync(cmd, { encoding: 'utf-8', timeout: 20_000 }).trim();
  if (!out) throw new Error('Свежий invite-токен в БД partner1 не найден. Прогнан ли сценарий 08 до конца?');
  return out;
}

const CHAIRMAN_PASSWORD = process.env.CHAIRMAN_PASSWORD_NEW || 'Partner1-Chairman-2026!';

export default async ({ page, shot }) => {
  // ---- 1. Достаём токен ---------------------------------------------------
  console.log(`[09] fetching invite token from ${PARTNER_PG_CONTAINER}…`);
  const token = fetchLatestInviteToken();
  console.log(`[09] token (head): ${token.slice(0, 40)}…`);

  // ---- 2. Открываем /auth/invite?token=… ---------------------------------
  const inviteUrl = `${env.APP_PREFIX}/${env.COOPNAME}/auth/invite?token=${token}`;
  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForSelector(`text=${CHAIRMAN_EMAIL}`, { timeout: 30_000 });

  await shot(
    page,
    '01-invite-password',
    'Страница приглашения: почта приглашённого и два поля пароля. Ключ подписи создан в браузере и на экран не выводится.',
  );

  // ---- 3. Пароль и вход ----------------------------------------------------
  const fields = page.locator('input[type="password"]');
  await fields.nth(0).fill(CHAIRMAN_PASSWORD);
  await fields.nth(1).fill(CHAIRMAN_PASSWORD);
  await page.locator('button:has-text("Задать пароль и войти")').click();

  try {
    await page.waitForURL(/\/(chairman|participant|soviet|user)/, { timeout: 90_000 });
  } catch (e) {
    await shot(page, '02-invite-stuck', 'Пароль не довёл до кабинета за 90с');
    throw e;
  }
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  writeFileSync(
    CHAIRMAN_FIXTURE_PATH,
    JSON.stringify({ coopname: PARTNER_FIXTURE.username, email: CHAIRMAN_EMAIL, password: CHAIRMAN_PASSWORD, role: 'chairman' }, null, 2),
    'utf-8',
  );
  console.log(`[09] saved fixture → ${CHAIRMAN_FIXTURE_PATH}`);

  await shot(
    page,
    '02-chairman-dashboard',
    'Председатель Партнёра-1 задал пароль по приглашению и сразу вошёл в кабинет своего кооператива.',
  );
};
