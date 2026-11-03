// Сценарий: экономика кооператива на столе администратора.
//
// Настройки модели кооператива, единые для всех участков: ставка
// обеспечительной части паевого взноса (прибавляется к стоимости заказа),
// доля инициатора участка в экономии месяца и потолок резерва
// социально-экономического обеспечения пайщиков на получателя в месяц
// (коэффициент экономического участия, 99D-23). Проценты фондов накопления —
// для чтения.
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
  cases: ['mkt.eco.ui.03', 'mkt.order.keu.ui.01'],
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
    'Экономика на столе администратора: три настройки модели — ставка обеспечительной части паевого взноса, доля инициатора участка в экономии месяца и потолок резерва социально-экономического обеспечения пайщиков на получателя в месяц. Ниже строкой — проценты фондов накопления кооператива, ими распоряжается совет. Доля и потолок применяются при расчёте итога месяца, прошедшие месяцы не пересчитываются.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Ставка обеспечительной части').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Доля инициатора').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Потолок резерва').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  // Окно правки доли инициатора: подсказка о том, что прошедшие месяцы не пересчитываются.
  await page.locator('[data-setting="initiator"] button').first().click();
  await page.waitForTimeout(600);
  await shot(
    page,
    '02-initiator-share-dialog',
    'Правка доли инициатора участка в экономии месяца: остальное возвращается пайщикам на свободный паевой Стола заказов. Новое значение действует на следующие итоги месяцев.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Прошедшие месяцы не пересчитываются').first()).toBeVisible({ timeout: 10000 });
      },
    },
  );
  await page.keyboard.press('Escape');
};
