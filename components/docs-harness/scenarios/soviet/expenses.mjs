// Сценарий: реестр расходов на столе совета — служебные записки на расход
// с состоянием, суммой и позициями (фаза soviet:04-expense).

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'soviet.expenses',
  title: 'Реестр расходов',
  docPath: 'new/council/expenses.md',
  assetsDir: 'assets/new/council/expenses',
  role: 'chairman',
  prepare: ['soviet:04-expense'],
};

const SOVIET = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/${p}`;

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, SOVIET('expenses'), null);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const item = page.locator('text=Бумага и картриджи').first();
  await expect(item, 'в реестре нет служебной записки: фаза soviet:04-expense').toBeVisible({ timeout: 30000 });
  await shot(page, '01-registry', 'Реестр расходов кооператива: служебные записки с автором, датой, суммой и состоянием.');
  await item.click();
  await page.waitForTimeout(2000);
  await shot(page, '02-expense', 'Служебная записка целиком: позиции с получателем, способом оплаты и суммой, документы и история состояний.');
};
