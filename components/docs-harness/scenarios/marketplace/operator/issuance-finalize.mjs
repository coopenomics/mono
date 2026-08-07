// Сценарий: operator-стол выдачи — финальная подпись заказчика (шаг 10
// магистрали II, on-chain `signiss2`).
//
// Канон второй подписи: председатель уже подписал акт при открытии выдачи
// (signiss1). Backend отдаёт заказчику агрегат (rawDocument + document с
// подписью председателя); заказчик накладывает финальную подпись
// (signatureId=2) поверх — документ не перегенерируется. delivery_signer =
// председатель, открывший выдачу (order.chairman_account).
//
// Предусловие: в КУ выдачи `krg` есть заказ в статусе READY_TO_RECEIVE
// (выдача открыта первой подписью — шаг 9). Иначе сценарий снимает список.

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
  title: 'Стол ПВЗ — финальная подпись выдачи',
  docPath: 'new/marketplace/operator/issuance-finalize.md',
  assetsDir: 'assets/new/marketplace/operator/issuance-finalize',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg', 'ekaterina'],
};

export default async ({ page, shot }) => {
  const chair = loadFixture('chairkrg');
  const orderer = loadFixture('ekaterina');

  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, chair);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dismissOnboardingDialogs(page);

  const branameInput = page.locator('label:has-text("ID кооперативного участка выдачи")').locator('input').first();
  await branameInput.click({ clickCount: 3 });
  await branameInput.fill('krg');
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Загрузить ленту выдач")').first().click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-issuance-list',
    'Лента выдач председателя КУ Красногорск (`braname=krg`). Заказы в статусе ACCEPTED_TO_COOP ждут открытия (кнопка «Открыть выдачу»), в READY_TO_RECEIVE — финальной подписи заказчика (кнопка «Завершить выдачу»).',
  );

  // Лента может накопить много заказов и разбиться на страницы (5/стр.) —
  // поднимаем размер страницы до «Все», чтобы actionable-заказ
  // (READY_TO_RECEIVE) точно оказался в DOM, на какой бы странице он ни был.
  try {
    const perPageSelect = page.locator('.q-table__bottom .q-select').first();
    if (await perPageSelect.count()) {
      await perPageSelect.click();
      await page.waitForTimeout(300);
      await page.locator('.q-menu .q-item').last().click();
      await page.waitForTimeout(500);
    }
  } catch {
    /* пагинации нет — лента короткая */
  }

  const finalizeBtn = page.locator('button:has-text("Завершить выдачу")').first();
  const hasReady = await finalizeBtn.count().then((c) => c > 0).catch(() => false);
  if (!hasReady) {
    console.warn('  ⚠️  Нет заказов в статусе READY_TO_RECEIVE — сценарий ограничится списком');
    return;
  }
  await finalizeBtn.scrollIntoViewIfNeeded().catch(() => {});

  await finalizeBtn.click();
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-finalize-scan',
    'Шаг 1 финальной выдачи — сверка штрих-кода заказа (BarcodeScanner). Оператор сканирует EAN-13 единицы, чтобы убедиться, что выдаётся правильный заказ.',
  );

  // Шаг 1 → 2: мок-сканер.
  await page.locator('button:has-text("Сканировать штрих-код заказа")').first().click();
  await page.waitForTimeout(700);
  await cleanViteOverlays(page);
  await shot(
    page,
    '03-finalize-fact',
    'Шаг 2 — сверка «план vs факт» (CorrectionTable). Оператор подтверждает или корректирует фактически выдаваемое количество; UI считает фактическую стоимость и подсказывает корректирующие операции при расхождении.',
  );

  // Шаг 2 → 3.
  await page.locator('button:has-text("Перейти к подписи")').first().click();
  await page.waitForTimeout(700);
  await cleanViteOverlays(page);
  await shot(
    page,
    '04-finalize-sign',
    'Шаг 3 — финальная подпись. Председатель уже подписал акт при открытии выдачи; заказчик вводит свой приватный ключ и накладывает вторую, финальную подпись поверх — имущество переходит к нему.',
  );

  // Заказчик вводит свой WIF и подписывает.
  const wifInput = page.locator('input[type="password"]').first();
  await wifInput.fill(orderer.wif);
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Подписать и выдать")').first().click();

  await page.waitForFunction(
    () => {
      const notifs = document.querySelectorAll('.q-notification__message');
      for (const n of notifs) {
        if ((n.textContent || '').includes('Заказ выдан')) return true;
      }
      return false;
    },
    { timeout: 45000 },
  ).catch(() => {});
  await page.waitForTimeout(800);

  await shot(
    page,
    '05-issuance-received',
    'После финальной подписи: Notify «Заказ выдан. Статус заказа — RECEIVED» (positive). On-chain прошёл `signiss2` с обеими подписями (председатель + заказчик), заказ → RECEIVED.',
    { preserveNotifications: true },
  );
};
