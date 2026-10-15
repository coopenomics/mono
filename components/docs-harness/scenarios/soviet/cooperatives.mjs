// Сценарий: реестр кооперативов союза.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'soviet.union',
  title: 'Реестр кооперативов',
  docPath: 'new/council/cooperatives.md',
  assetsDir: 'assets/new/council/cooperatives',
  role: 'chairman',
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/soviet/union/cooperatives`, null);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '01-registry', 'Реестр кооперативов союза: кооперативы сети с наименованием, адресом и состоянием подключения.');
};
