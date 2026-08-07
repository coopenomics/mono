// Сценарий: offerer-стол «Подготовка отгрузки» (Эпик 5 / Story 5.5).
// Поставщик видит сводные заказы в статусах CONFIRMED → SHIPPING и
// подтверждает готовность отгрузки. На пустом стенде после reboot:extra
// сводных заказов ещё нет, показывается заглушка.
//
// Логин — за председателем кооператива (ant), как и в других marketplace
// сценариях harness'а: chairman имеет доступ ко всем рабочим столам пайщика
// для целей документации; полная фикстура `sidorov` для multi-account
// прогона потока II будет в магистрали II PLAN.md §9.4.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол поставщика — подготовка отгрузки',
  docPath: 'new/marketplace/offerer/shipment-prep.md',
  assetsDir: 'assets/new/marketplace/offerer/shipment-prep',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/supply-prep`, {
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
