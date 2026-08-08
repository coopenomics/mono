// Сценарий: admin-стол «Сводный склад кооператива» (Story 9.2).
// WarehouseSummaryGrid (UX-DR16) поверх marketplace_inventory:
// приход/расход/остаток по ku × sku. Доступ chairman/member.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя — сводный склад',
  docPath: 'new/marketplace/board/warehouse-readonly.md',
  assetsDir: 'assets/new/marketplace/board/warehouse-readonly',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/warehouse-summary`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-warehouse-summary-empty',
    `Сводный склад кооператива (admin). URL: \`${page.url()}\`.`,
  );
};
