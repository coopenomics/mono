// Сценарий: экономика кооператива на столе администратора.
//
// Настройки модели кооператива, единые для всех участков: ставка
// обеспечительной части паевого взноса (прибавляется к стоимости заказа),
// доля инициатора участка в экономии месяца и верхний предел резерва
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
    'Экономика на столе администратора: один ряд плиток — ставка обеспечительной части паевого взноса, доля инициатора участка в экономии месяца, верхний предел резерва материальной помощи на получателя в месяц и проценты фондов накопления кооператива (ими распоряжается совет). Число правится карандашом у значения, подробности — подсказкой у подписи.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Обеспечительная часть').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Доля инициатора').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Предел резерва матпомощи').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Фонды накопления').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  // Окно правки доли инициатора: подсказка о том, что прошедшие месяцы не пересчитываются.
  // Числа экрана — карточки WalletCard, правка — кнопка «Редактировать» под
  // числом карточки (до 04.11 был карандаш с подписью для чтения с экрана).
  await page
    .locator('.wallet')
    .filter({ has: page.locator('.wallet__title', { hasText: 'Доля инициатора' }) })
    .first()
    .locator('button:has-text("Редактировать")')
    .first()
    .click();
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
