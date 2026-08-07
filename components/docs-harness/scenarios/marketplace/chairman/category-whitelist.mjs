// Сценарий: Председатель настраивает whitelist доступных категорий товаров.
// Эпик 3 / Story 3.x — пустой whitelist означает, что доступен весь
// глобальный каталог; с whitelist'ом — только перечисленные категории.
//
// Backend `available-category-admin.resolver.ts` (@AuthRoles chairman).
// Tree-выбор через `marketplaceGetCategoryTree` подключится на следующем
// шаге; в MVP — диалог с ручным вводом ID через запятую.
//
// Фикстура: chairman кооператива (ant, Иван Иванов).

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Whitelist категорий товаров кооператива',
  docPath: 'new/marketplace/chairman/category-whitelist.md',
  assetsDir: 'assets/new/marketplace/chairman/category-whitelist',
  role: 'chairman',
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  // 1. Открыть страницу доступных категорий
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/category-whitelist`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Доступные категории', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await dismissOnboardingDialogs(page);
  await shot(
    page,
    '01-overview',
    'Страница «Доступные категории»: 4 stat-карточки в шапке — всего записей, число категорий, число типов товаров и состояние whitelist (активен / открыт каталог). Пустой whitelist означает, что пайщикам доступен весь глобальный каталог категорий.',
  );

  // 2. Открыть диалог добавления категорий
  const addBtn = page.locator('button:has-text("Добавить")').first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    await page.waitForSelector('text=Добавить категории в whitelist', { timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(
      page,
      '02-add-dialog',
      'Диалог добавления: в MVP — ручной ввод ID через запятую (1, 7, 15). На следующем шаге Story 3.x подключится tree-выбор через marketplaceGetCategoryTree — выбор по дереву категорий и типов.',
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
};
