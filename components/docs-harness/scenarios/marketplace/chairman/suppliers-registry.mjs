// Сценарий: реестр поставщиков на столе администратора.
//
// Поставщиком пайщик становится не сам: администратор одобряет заявку или
// добавляет напрямую. Реестр показывает всех допущенных; на стенде после
// seed-фаз 04/06 в нём ivanpetrov (рабочий поставщик сценариев) и sidorov
// (фоновый поставщик витрины).
//
// Фикстура: председатель кооператива (ant).

import { loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Реестр поставщиков',
  docPath: 'new/marketplace/admin/suppliers-registry.md',
  assetsDir: 'assets/new/marketplace/admin/suppliers-registry',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.offer',
  cases: ['mkt.offer.ui.01'],
  prepare: ['marketplace:01-l1-accept', 'marketplace:04-supplier', 'marketplace:06-catalog-offers'],
  fixtures: ['sidorov'],
};

export default async ({ page, shot, expect, env, context }) => {
  await loginAsChairman(page, context);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/suppliers`, {
    waitUntil: 'domcontentloaded',
  });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  await shot(
    page,
    '01-suppliers-registry',
    'Реестр поставщиков на столе администратора: все пайщики, допущенные к публикации предложений. Здесь администратор одобряет заявки и может добавить поставщика напрямую.',
    {
      expect: async (p) => {
        // Реестр обязан показывать допущенных поставщиков стенда: пустая
        // таблица означала бы, что допуск (фаза 04) не доехал до реестра.
        await expect(p.locator('text=Сидоров').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
