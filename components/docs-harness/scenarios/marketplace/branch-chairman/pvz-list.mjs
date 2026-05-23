// Сценарий: Стол ПВЗ — «ПВЗ кооператива».
// Список всех пунктов выдачи. Видно председателю КУ (operator/branch-chairman).
// Маршрут /<coopname>/market-pvz/list (workspace market-pvz).

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя ПВЗ — список ПВЗ кооператива',
  docPath: 'new/marketplace/chairman/branches.md',
  assetsDir: 'assets/new/marketplace/chairman/branches',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market-pvz/list`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-pvz-list',
    `Список ПВЗ кооператива. URL: \`${page.url()}\`.`,
  );
};
