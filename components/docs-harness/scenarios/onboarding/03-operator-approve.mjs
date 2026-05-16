// Сценарий: оператор Восхода открывает реестр запросов одобрений
// (Approvals) и подтверждает заявку нового пайщика (Партнёр-1).
//
// Реальный путь chairman'а в Восходе:
//   /:coopname/chairman/approvals — страница «Запросы одобрений»
//   (см. components/desktop/extensions/chairman/install.ts, name='approvals').
//
// Approval-запись появляется автоматически после того, как пайщик оплатил
// вступительный взнос. На локальном стенде без mock-провайдера платежей
// approval для нашей свежей заявки может отсутствовать — тогда сценарий
// делает шот пустого реестра (для документации этого достаточно).
//
// Зависит от: 02-sign-and-submit (фикстура partner1.json содержит username).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env, dismissOnboardingDialogs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOP_FIXTURE_PATH = path.resolve(__dirname, '../../state/cooperatives/partner1.json');

export const meta = {
  title: 'Оператор Восхода открывает реестр запросов одобрений и подтверждает заявку Партнёр-1',
  docPath: 'new/onboarding/03-operator-approve.md',
  assetsDir: 'assets/new/onboarding/03-operator-approve',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  const partner = JSON.parse(fs.readFileSync(COOP_FIXTURE_PATH, 'utf8'));
  if (!partner.username) {
    throw new Error('Фикстура partner1.json не содержит username — сначала запустите 02-sign-and-submit');
  }

  // --- 1. Логин под chairman'ом Восхода. ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 30_000 });
  await page.locator('label:has-text("электронную почту")').first().locator('input').fill(env.CHAIRMAN_EMAIL);
  await page.locator('label:has-text("ключ доступа")').first().locator('input').fill(env.CHAIRMAN_WIF);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/(chairman|participant|soviet)/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  // Каскад онбординг-диалогов (Положение ЦПП, ЭП, политика, пользовательское
  // соглашение) — скрыть через CSS. См. dismissOnboardingDialogs.
  await dismissOnboardingDialogs(page);
  await page.waitForTimeout(500);
  await shot(page, '01-chairman-home', 'Стартовый экран chairman\'а Восхода (онбординг-диалоги обработаны).');

  // --- 2. Идём в реестр одобрений. ---
  // Восход — SPA с hash-роутингом, поэтому URL формируется как `/#/<route>`.
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/chairman/approvals`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(`[03-operator-approve] url after goto: ${page.url()}`);
  await dismissOnboardingDialogs(page);
  await page.waitForTimeout(800);
  console.log(`[03-operator-approve] url after dismiss: ${page.url()}`);
  const domSummary = await page.evaluate(() => {
    const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'));
    const visiblePortals = portals.filter((p) => getComputedStyle(p).display !== 'none');
    return {
      totalPortals: portals.length,
      visiblePortals: visiblePortals.length,
      visibleIds: visiblePortals.map((p) => p.id),
      hasQTable: !!document.querySelector('.q-table'),
      hasApprovalsText: /Запросы одобрений/.test(document.body.textContent || ''),
      bodyKids: Array.from(document.body.children).map((c) => `${c.tagName}#${c.id || '-'}`).slice(0, 10),
    };
  });
  console.log(`[03-operator-approve] dom: ${JSON.stringify(domSummary)}`);
  // Дождаться q-table или текста-плейсхолдера.
  await Promise.race([
    page.locator('.q-table').first().waitFor({ state: 'visible', timeout: 30_000 }),
    page.locator('text=У председателя нет запросов').first().waitFor({ state: 'visible', timeout: 30_000 }),
  ]).catch(() => {});
  await page.waitForTimeout(800);
  await shot(
    page,
    '02-approvals-list',
    'Реестр «Запросы одобрений» (chairman): таблица с фильтром «Ожидает» — все pending-заявки кооператива.',
  );

  // --- 3. Ищем строку нашего Партнёр-1 по username. ---
  const row = page.locator(`tr:has(td:has-text("${partner.username}"))`).first();
  const found = await row.waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true).catch(() => false);

  if (!found) {
    // Approval для свежей заявки не появился (на тестовом стенде платёж
    // pending → approval не создан). Шотим пустой реестр и завершаемся —
    // дальше backend-зависимая часть, обрабатывается отдельно.
    console.log(`[03-operator-approve] approval для ${partner.username} не найден в реестре PENDING — backend не подтвердил платёж`);
    await shot(
      page,
      '03-approval-row-missing',
      `Заявка пайщика ${partner.username} (${partner.short_name}) ещё не появилась в реестре одобрений — на тестовом стенде без mock-провайдера платёж висит со статусом «pending» и approval не создаётся.`,
    );
    return;
  }

  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(
    page,
    '03-approval-row',
    `Строка заявки пайщика ${partner.username} (${partner.short_name}) в реестре одобрений — статус «Ожидает».`,
  );

  // --- 4. Разворачиваем строку — видим тело документа заявления. ---
  await row.locator('button').first().click();
  await page.waitForTimeout(800);
  await shot(
    page,
    '04-approval-expanded',
    'Развёрнутая строка заявки: chairman видит полный текст документа заявления на вступление.',
  );

  // --- 5. Клик «Одобрить». ---
  // ConfirmApprovalButton — в той же row, отдельная кнопка в колонке Действия.
  const confirmBtn = row.locator('button:has-text("Одобрить"), button:has-text("Подтвердить")').first();
  await confirmBtn.click({ timeout: 5_000 });
  // Возможна модалка подтверждения — подождём и шотнем если появится.
  const dialogAppeared = await page.locator('[id^="q-portal--dialog--"]').first()
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true).catch(() => false);
  if (dialogAppeared) {
    await page.waitForTimeout(400);
    await shot(
      page,
      '05-confirm-dialog',
      'Модалка подтверждения «Одобрить заявку» — chairman подписывает решение совета приватным ключом.',
    );
    // «Подтвердить» / «Подписать» в модалке.
    const dialogConfirm = page.locator('[id^="q-portal--dialog--"] button:has-text("Подтвердить"), [id^="q-portal--dialog--"] button:has-text("Подписать"), [id^="q-portal--dialog--"] button:has-text("Одобрить")').first();
    await dialogConfirm.click({ timeout: 5_000 }).catch(() => {});
  }

  await page.waitForTimeout(2500);
  await shot(
    page,
    '06-after-confirm',
    'Реестр после одобрения: статус заявки Партнёр-1 переходит в «Одобрено», approval уходит из фильтра «Ожидает».',
  );
};
