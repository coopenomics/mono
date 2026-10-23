// Сценарий: экономика кооператива на столе администратора.
//
// Единственная настройка MVP — ставка целевого членского взноса кооператива
// на обеспечение хозяйственной деятельности. Он прибавляется к цене
// поставщика и виден заказчику в каталоге и корзине.
//
// Фикстура: председатель кооператива (ant).

import { loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Экономика кооператива',
  docPath: 'new/marketplace/admin/economy.md',
  assetsDir: 'assets/new/marketplace/admin/economy',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.economy',
  cases: ['mkt.eco.ui.03'],
  prepare: ['marketplace:01-l1-accept'],
};

export default async ({ page, shot, expect, env, context }) => {
  await loginAsChairman(page, context);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/economy`, {
    waitUntil: 'domcontentloaded',
  });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  await shot(
    page,
    '01-economy',
    'Экономика на столе администратора: целевой членский взнос — единый для всех участков процент, который добавляется к цене поставщика и идёт на обеспечение хозяйственной деятельности кооператива. Изменение действует на заказы, созданные после установки.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Целевой членский взнос').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
