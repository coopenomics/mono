// Сценарий: реестр предложений на столе администратора.
//
// В отличие от «Модерации» (только ожидающие решения) реестр показывает все
// предложения кооператива во всех статусах. После seed-фазы 06 в нём десять
// опубликованных позиций витрины.
//
// Фикстура: председатель кооператива (ant).

import { loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Реестр предложений',
  docPath: 'new/marketplace/admin/offers-registry.md',
  assetsDir: 'assets/new/marketplace/admin/offers-registry',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.offer',
  cases: ['mkt.offer.ui.02'],
  prepare: ['marketplace:01-l1-accept', 'marketplace:06-catalog-offers'],
  fixtures: ['sidorov'],
};

export default async ({ page, shot, expect, env, context }) => {
  await loginAsChairman(page, context);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/offers`, {
    waitUntil: 'domcontentloaded',
  });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  await shot(
    page,
    '01-offers-registry',
    'Реестр предложений: все предложения кооператива со статусами — опубликованные, ожидающие модерации, отклонённые. Отсюда администратор открывает карточку любого предложения в режиме просмотра.',
    {
      expect: async (p) => {
        // Витрина фазы 06 обязана быть видна и администратору: пустой реестр
        // означал бы, что список фильтруется неверно.
        await expect(p.locator('text=Мёд цветочный').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
