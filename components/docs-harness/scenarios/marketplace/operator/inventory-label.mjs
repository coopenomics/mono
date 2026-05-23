// Сценарий: operator-стол «Маркировка имущества» (Эпик 5 / Story 5.8 + Эпик 6).
// После закрытия акта приёмки оператор клеит EAN-13 на каждую единицу
// через `BarcodeDisplay` (UX-DR12) + фиксирует факт маркировки.
// На пустом стенде — empty state, маркировать нечего.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол ПВЗ — маркировка имущества',
  docPath: 'new/marketplace/operator/inventory-label.md',
  assetsDir: 'assets/new/marketplace/operator/inventory-label',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market-pvz/labeling`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-labeling-empty',
    `Стол «Маркировка имущества» председателя КУ. URL: \`${page.url()}\`. Empty state: имущества, ожидающего маркировки EAN-13, на стенде нет — единицы появляются после закрытия акта приёмки (см. operator/apl-reception-create).`,
  );
};
