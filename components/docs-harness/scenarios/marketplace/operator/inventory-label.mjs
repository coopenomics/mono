// Сценарий: operator-стол «Маркировка имущества» (Эпик 5 / Story 5.8, шаг 8
// магистрали II). После приёмки партии оператор КУ маркирует имущество
// внутренним штрих-кодом EAN-13 (стандарт маркетплейсов, не QR —
// UX-DR11/DR12 BarcodeDisplay); этикетки печатаются и клеятся на единицы.
//
// Снимаем панель маркировки (два режима + формат EAN-13) и грид уже
// наклеенных этикеток EAN-13 по КУ `krg`.
//
// NB: BATCH-режим («Маркировка партии целиком») подтягивает партии через
// marketplaceListShipments, который scoped по offerer'у (стол поставщика);
// у KU-председателя селект партий пуст — нужен отдельный operator-scoped
// запрос партий по КУ-получателю (backend follow-up). Поэтому здесь
// показываем результат маркировки (грид EAN-13), а действие BATCH — нет.

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
  title: 'Стол ПВЗ — маркировка имущества EAN-13',
  docPath: 'new/marketplace/operator/inventory-label.md',
  assetsDir: 'assets/new/marketplace/operator/inventory-label',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/labeling`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-labeling-panel',
    'Стол «Маркировка имущества» оператора/председателя КУ. Два режима: «Маркировка партии целиком» (выбор партии поставки + стратегия + формат штрих-кода) и «Поштучно по заказу». Формат — EAN-13 (стандарт маркетплейсов, не QR; UX-DR11/DR12).',
  );

  // Загружаем уже промаркированный инвентарь КУ — грид этикеток EAN-13.
  const branameInput = page.locator('label:has-text("ID кооперативного участка")').locator('input').first();
  await branameInput.click({ clickCount: 3 });
  await branameInput.fill('krg');
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Загрузить инвентарь")').first().click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-inventory-grid',
    'Инвентарь КУ `krg`: сетка наклеенных этикеток EAN-13 (BarcodeDisplay). На каждую единицу — машиночитаемый штрих-код, название товара и пайщик-получатель. Кнопка «Печать партии» отправляет лист этикеток на принтер.',
  );
};
