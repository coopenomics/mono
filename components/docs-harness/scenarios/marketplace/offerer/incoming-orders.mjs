// Сценарий: Поставщик видит входящие заказы по своим Offer'ам.
// Эпик 4 / Story 4.5 — read-обзор заказов где supplier = текущий пайщик.
//
// Канон OrderCard с role='offerer'. Фильтр по статусу через q-tabs.
// Действия по акцепту партии — на отдельной странице «Подготовка отгрузки».
//
// Фикстура: sidorov (Дмитрий Николаевич Сидоров), поставщик.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, env, cleanViteOverlays } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Входящие заказы поставщика',
  docPath: 'new/marketplace/offerer/incoming-orders.md',
  assetsDir: 'assets/new/marketplace/offerer/incoming-orders',
  role: 'user',
  fixture: 'sidorov',
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('sidorov');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market/incoming-orders`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Входящие заказы', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-overview',
    'Стол поставщика: лента входящих заказов от пайщиков. Фильтр по статусу через табы — «Все», «Ждут моего акцепта», «Индивидуальные ожидающие», «Приняты», «Поставка готова», «Приняты кооперативом», «Получены», «Отменены». Polling 15s.',
  );

  // Переключиться на фильтр «Ждут моего акцепта» — это критичный статус для J2.
  const pendingTab = page.locator('button:has-text("Ждут моего акцепта"), [role="tab"]:has-text("Ждут моего акцепта")').first();
  if (await pendingTab.isVisible().catch(() => false)) {
    await pendingTab.click();
    await page.waitForTimeout(900);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-pending-filter',
      'Фильтр «Ждут моего акцепта» — заказы в статусе ACCEPTED_PENDING_SUPPLIER, которые поставщику нужно принять или отказаться через TakeoverDialog Эпика 5 на /market/supply-prep.',
    );
  }
};
