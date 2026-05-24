// Сценарий: operator-стол гарантийных возвратов (Story 7.2-7.4).
// Председатель КУ рассматривает поступившие заявления удалённо,
// приглашает на очный осмотр, принимает или отказывает.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол ПВЗ — гарантийные возвраты',
  docPath: 'new/marketplace/branch-chairman/return-approve.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/return-approve',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market-pvz/returns`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-operator-returns-empty',
    `«Гарантийные возвраты» председателя КУ. URL: \`${page.url()}\`.`,
  );
};
