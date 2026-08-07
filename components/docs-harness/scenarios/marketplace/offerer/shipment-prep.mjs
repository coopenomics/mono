// Сценарий: offerer-стол «Подготовка отгрузки» (Эпик 5 / Story 5.5).
// Поставщик видит сводные заказы в статусах CONFIRMED → SHIPPING и
// подтверждает готовность отгрузки. На пустом стенде после reboot:extra
// сводных заказов ещё нет, показывается заглушка.
//
// Логин — за председателем кооператива (ant), как и в других marketplace
// сценариях harness'а: chairman имеет доступ ко всем рабочим столам пайщика
// для целей документации; полная фикстура `sidorov` для multi-account
// прогона потока II будет в магистрали II PLAN.md §9.4.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол поставщика — подготовка отгрузки',
  docPath: 'new/marketplace/offerer/shipment-prep.md',
  assetsDir: 'assets/new/marketplace/offerer/shipment-prep',
  role: 'user',
  mode: 'docs',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot }) => {
  // Стол поставщика: председателю он недоступен — прежняя версия логинилась
  // председателем и упиралась в отказ в правах.
  await loginAs(page, loadFixture('ivanpetrov'));
  await pickBranchIfAsked(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/supply-prep`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-supply-prep-empty',
    `Стол «Подготовка отгрузки» поставщика. URL: \`${page.url()}\`. Empty state: сводных заказов CONFIRMED, ожидающих отгрузки, на стенде нет.`,
  );
};
