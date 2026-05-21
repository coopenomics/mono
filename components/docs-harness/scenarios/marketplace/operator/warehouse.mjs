// Сценарий: operator-стол «Склад моего КУ» (Story 9.1).
// Таблица marketplace_inventory отфильтрована по braname; per-row статусы
// (LABELED / ISSUED / RETURNED / WRITTEN_OFF), фильтры по статусу/orderer,
// summary count by status. Backend: Warehouse: ['read:own-KU'].

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол ПВЗ — склад моего кооперативного участка',
  docPath: 'new/marketplace/operator/inventory-list.md',
  assetsDir: 'assets/new/marketplace/operator/inventory-list',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market-pvz/warehouse`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-operator-warehouse',
    `«Склад моего КУ» председателя КУ. URL: \`${page.url()}\`.`,
  );
};
