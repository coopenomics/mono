// Сценарий: перехват invite-token председателя из БД partner1, генерация
// нового WIF и финальный signin под председателем.
//
// Поток после 08-chairman-install-on-partner-dev:
//   1. install.interactor.ts на partner1 успешно отработал installSoviet():
//      создан совет on-chain, в `tokens` (Postgres partner1) появилась
//      запись type='invite' для chairman'а.
//   2. Параллельно Novu пытается отправить email с инвайт-ссылкой —
//      на chairman.partner1@example.com он не дойдёт, но token уже в БД.
//   3. Этот сценарий через SSH к partner1 (sudo docker exec partner1-postgres
//      psql) забирает свежий invite-токен и подменяет email-перехват.
//   4. Открывает `${BASE_URL}/${COOPNAME}/auth/invite?token=<token>` —
//      виджет Invite генерирует новый WIF клиентски (`generateAccount()`).
//   5. WIF извлекается из q-input в page.evaluate, сохраняется в
//      state/cooperatives/partner1-chairman.json для следующих сценариев.
//   6. Чекбокс «Я сохранил ключ» + клик «Установить ключ» → resetKey
//      шлёт on-chain ChangeKey, редирект на signin.
//   7. Финальный signin под новым WIF chairman'а — Эпик 0 закрыт.

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
  title: 'Председатель Партнёра-1 получает ключ доступа через invite-токен',
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

export default async ({ page, shot }) => {
  // ---- 1. Достаём токен ---------------------------------------------------
  console.log(`[09] fetching invite token from ${PARTNER_PG_CONTAINER}…`);
  const token = fetchLatestInviteToken();
  console.log(`[09] token (head): ${token.slice(0, 40)}…`);

  // ---- 2. Открываем /auth/invite?token=… ---------------------------------
  const inviteUrl = `${env.BASE_URL}/${env.COOPNAME}/auth/invite?token=${token}`;
  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForSelector('.invite-title:has-text("СОХРАНИТЕ КЛЮЧ")', { timeout: 30_000 });
  await page.waitForTimeout(800);

  await shot(
    page,
    '01-invite-key-generated',
    'Страница /auth/invite — клиент сгенерировал новый WIF чрез generateAccount(). Поле «Приватный ключ» содержит WIF, который мы извлечём для signin.',
  );

  // ---- 3. Извлекаем приватный ключ ---------------------------------------
  const newWif = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const wifInput = labels
      .find((l) => /Приватный ключ/i.test(l.textContent || ''))
      ?.closest('.q-field')
      ?.querySelector('input, textarea');
    return wifInput?.value || null;
  });
  if (!newWif) throw new Error('Не удалось извлечь приватный ключ из формы invite');
  console.log(`[09] new chairman WIF (head): ${newWif.slice(0, 8)}…${newWif.slice(-6)}`);

  // Сохраняем в фикстуру, чтобы следующие сценарии могли логиниться
  // под chairman'ом без переуказания.
  const chairmanFixture = {
    username: '__will-be-derived-from-chain__',
    coopname: PARTNER_FIXTURE.username,
    email: CHAIRMAN_EMAIL,
    wif: newWif,
    role: 'chairman',
  };
  writeFileSync(CHAIRMAN_FIXTURE_PATH, JSON.stringify(chairmanFixture, null, 2), 'utf-8');
  console.log(`[09] saved fixture → ${CHAIRMAN_FIXTURE_PATH}`);

  // ---- 4. Чекбокс «Я сохранил ключ» + submit -----------------------------
  await page.locator('label:has-text("Я сохранил ключ")').click();
  await page.waitForTimeout(300);

  await shot(
    page,
    '02-key-saved-checkbox',
    'Председатель отметил «Я сохранил ключ» — кнопка «Установить ключ» активна.',
  );

  await page.locator('button:has-text("Установить ключ")').click();

  // resetKey → on-chain ChangeKey + редирект на signin
  try {
    await page.waitForURL(/\/auth\/signin/, { timeout: 60_000 });
  } catch (e) {
    // Алерт мог не пустить редирект — снимаем что есть и валимся
    await shot(page, '03-resetkey-stuck', 'resetKey не вызвал редирект на signin за 60с');
    throw e;
  }
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(
    page,
    '03-redirect-signin',
    'После «Установить ключ» on-chain ChangeKey прошёл — фронт редиректит на /auth/signin под новым ключом председателя.',
  );

  // ---- 5. Signin под новым WIF -------------------------------------------
  await page.waitForSelector('button:has-text("Войти")', { timeout: 30_000 });
  await page.locator('label:has-text("электронную почту")').first().locator('input').fill(CHAIRMAN_EMAIL);
  await page.locator('label:has-text("ключ доступа")').first().locator('input').fill(newWif);
  await page.locator('button:has-text("Войти")').click();

  // На корректном signin переходим на /chairman/ или /participant/ или
  // /soviet/ — точное место зависит от того, видит ли front роль chairman'а
  // (она пришла из soviet::boards[partner1] = создан в сценарии 08).
  try {
    await page.waitForURL(/\/(chairman|participant|soviet|user)/, { timeout: 45_000 });
  } catch (e) {
    await shot(page, '04-signin-stuck', 'Signin не дошёл до chairman/participant за 45с');
    throw e;
  }
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await shot(
    page,
    '04-chairman-dashboard',
    'Эпик 0 закрыт: председатель Партнёра-1 авторизован в собственной системе на partner-dev. Совет on-chain создан, ключ председателя установлен через invite-flow, signin прошёл.',
  );
};
