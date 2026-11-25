// Сценарий: «Пункты выдачи заказов» на столе администратора.
//
// С 18–19.11.2026 участки стоят карточками вместо таблицы: название, код,
// город и адрес, состояние подключения и координат. Нажатие на карточку
// открывает правую панель пункта выдачи — карта, город, адрес, контакты,
// режим работы и действия председателя кооператива. Сценарий ничего не
// меняет: только открывает панель.
//
// Фикстура: председатель кооператива (ant).

import { cleanViteOverlays, dismissOnboardingDialogs, loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Пункты выдачи заказов — карточки участков и панель пункта выдачи',
  docPath: 'new/marketplace/admin/issuance-points.md',
  assetsDir: 'assets/new/marketplace/admin/issuance-points-panel',
  role: 'chairman',
  mode: 'docs',
};

export default async ({ page, context, shot, expect, env }) => {
  await loginAsChairman(page, context);
  await pickBranchIfAsked(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/issuance-points`, {
    waitUntil: 'domcontentloaded',
  });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  const krg = page.locator('.admin-pvz__card', { hasText: 'Красногорск' }).first();
  await shot(
    page,
    '01-points',
    'Пункты выдачи заказов: участок — карточка с названием, кодом, городом и адресом; справа состояние подключения и координат. Нажатие на карточку открывает панель пункта выдачи.',
    {
      expect: async () => {
        await expect(krg).toBeVisible({ timeout: 30000 });
      },
    },
  );

  await krg.click();
  await page.waitForSelector('text=Режим работы', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Карта дорисовывает плитки после открытия панели.
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-point-panel',
    'Панель пункта выдачи: карта с меткой участка, город, адрес, телефон, почта и режим работы; внизу — действия председателя кооператива.',
  );

  await page.keyboard.press('Escape');
};
