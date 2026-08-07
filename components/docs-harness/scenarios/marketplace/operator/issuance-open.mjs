// Сценарий: operator-стол «Выдача заказов» — открытие выдачи первой подписью
// председателя КУ (шаг 9 магистрали, on-chain `signiss1`).
//
// Председатель КУ грузит ленту выдач своего ПВЗ, по заказу в статусе
// ACCEPTED_TO_COOP жмёт «Открыть выдачу» → TakeoverDialog (IssueActOpenDialog)
// показывает превью акта (registry_id=1102) → «Подписать и открыть выдачу»
// подписывает hash ключом сессии (signatureId=1) и шлёт marketplaceOpenIssuance.
// Заказ переходит ACCEPTED_TO_COOP → READY_TO_RECEIVE.
//
// MP_ISSUANCE_ORDER (префикс order-id) выбирает конкретную строку — иначе
// берём первую доступную «Открыть выдачу». Нужно чтобы не зацепить чужой
// заказ из накопленного состояния стенда.

import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs } from '../../../lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол ПВЗ — открытие выдачи (подпись председателя)',
  docPath: 'new/marketplace/branch-chairman/issuance-open-sign.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/issuance-open-sign',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dismissOnboardingDialogs(page);

  // Грузим ленту выдач КУ krg.
  const branameInput = page.locator('label:has-text("ID кооперативного участка выдачи")').locator('input').first();
  await branameInput.click({ clickCount: 3 });
  await branameInput.fill('krg');
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Загрузить ленту выдач")').first().click();
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-issuance-feed',
    'Лента выдач председателя КУ Красногорск (`braname=krg`). Заказы в статусе ACCEPTED_TO_COOP ждут открытия выдачи (кнопка «Открыть выдачу»), READY_TO_RECEIVE — финальной подписи заказчика («Завершить выдачу»).',
  );

  // Лента пагинирована (5/стр) — на стенде с накопленными заказами нужный
  // может быть не на первой странице. Ставим «строк на странице» в максимум
  // (последняя опция q-select обычно «Все»/0), чтобы строка отрисовалась в DOM.
  const rppSelect = page.locator('.q-table__bottom .q-select').first();
  if (await rppSelect.count()) {
    await rppSelect.click();
    await page.waitForTimeout(400);
    const rppOpts = page.locator('.q-menu .q-item');
    if (await rppOpts.count()) {
      await rppOpts.last().click();
      await page.waitForTimeout(1200);
    }
  }
  await cleanViteOverlays(page);

  // Целимся в строку нужного заказа (префикс order-id), иначе — первая «Открыть выдачу».
  const orderNeedle = process.env.MP_ISSUANCE_ORDER;
  let openBtn;
  if (orderNeedle) {
    const row = page.locator('tr', { hasText: orderNeedle.slice(0, 8) })
      .filter({ has: page.locator('button:has-text("Открыть выдачу")') })
      .first();
    if (!(await row.count())) {
      throw new Error(`[issuance-open] строка заказа «${orderNeedle.slice(0, 8)}» с кнопкой «Открыть выдачу» не найдена в ленте krg`);
    }
    openBtn = row.locator('button:has-text("Открыть выдачу")').first();
  } else {
    openBtn = page.locator('button:has-text("Открыть выдачу")').first();
  }
  if (!(await openBtn.count())) {
    console.warn('  ⚠️  Нет заказов ACCEPTED_TO_COOP с кнопкой «Открыть выдачу» — сценарий ограничится лентой');
    return;
  }

  await openBtn.click();
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  // Ждём загрузки превью акта (disable-confirm пока previewHtml пуст).
  const confirmBtn = page.locator('button:has-text("Подписать и открыть выдачу")').first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(
    () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((x) => (x.textContent || '').includes('Подписать и открыть выдачу'));
      return b && !b.disabled;
    },
    { timeout: 20000 },
  ).catch(() => {});

  await shot(
    page,
    '02-open-dialog',
    'Диалог открытия выдачи (IssueActOpenDialog, full-screen takeover): превью акта выдачи (registry_id=1102) с данными заказа. Председатель подписывает его приватным ключом сессии — первая подпись акта (signiss1).',
  );

  await confirmBtn.click();

  // Ждём Notify об успехе («Выдача открыта…»).
  await page.waitForFunction(
    () => {
      const notifs = document.querySelectorAll('.q-notification__message');
      for (const n of notifs) {
        if ((n.textContent || '').includes('Выдача открыта')) return true;
      }
      return false;
    },
    { timeout: 45000 },
  ).catch(() => {});
  await page.waitForTimeout(1000);

  await shot(
    page,
    '03-issuance-opened',
    'После подписи председателя: Notify «Выдача открыта. Заказчику отправлено уведомление» (positive). On-chain прошёл `signiss1`, заказ → READY_TO_RECEIVE и доступен заказчику для получения на ПВЗ.',
    { preserveNotifications: true },
  );
};
