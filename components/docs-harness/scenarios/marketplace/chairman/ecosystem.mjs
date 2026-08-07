// Сценарий: admin-стол «Экосистема» (Story 9.4).
// Read-only реестр controller'ов других кооперативов с расширением Стола
// заказов. MVP — заглушка до подключения platform ecosystem_registry.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя — реестр экосистемы',
  docPath: 'new/marketplace/chairman/ecosystem.md',
  assetsDir: 'assets/new/marketplace/chairman/ecosystem',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/ecosystem`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-ecosystem',
    `Реестр экосистемы кооперативов с расширением Стола заказов. URL: \`${page.url()}\`.`,
  );
};
