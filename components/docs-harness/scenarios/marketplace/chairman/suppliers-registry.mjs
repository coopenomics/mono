// Сценарий: реестр поставщиков на столе администратора.
//
// Поставщиком пайщик становится не сам: администратор одобряет заявку или
// добавляет напрямую. Реестр показывает всех допущенных; на стенде после
// seed-фаз 04/06 в нём ivanpetrov (рабочий поставщик сценариев) и sidorov
// (фоновый поставщик витрины).
//
// Фикстура: председатель кооператива (ant).

import { cleanViteOverlays, loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

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

  // Карточка поставщика (с 19.11.2026): договор, статус и кнопка
  // «Приостановить действие договора». Сценарий договор не приостанавливает.
  await page.locator('tr:has-text("Сидоров")').first().click();
  await page.waitForSelector('text=Приостановить действие договора', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-supplier-card',
    'Карточка поставщика в реестре: договор, модель поставки и состояние. Кнопка «Приостановить действие договора» скрывает предложения поставщика из каталога и закрывает новые заказы на него; «Возобновить действие договора» возвращает допуск.',
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // «Добавить поставщика»: поставщик выбирается поиском среди пайщиков по ФИО,
  // организации или аккаунту, аккаунт стоит под именем. Окно не отправляется.
  await page.locator('#header-actions-host button').first().click();
  const addDialog = page.locator('.q-dialog__inner:visible').filter({ hasText: 'Добавить поставщика' }).first();
  await addDialog.waitFor({ state: 'visible', timeout: 20000 });
  await addDialog.locator('input').first().click();
  await addDialog.locator('input').first().type('Петров', { delay: 60 });
  await page.locator('.q-menu .q-item').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800);
  await shot(
    page,
    '03-add-supplier-search',
    'Окно «Добавить поставщика»: поиск пайщика по ФИО, организации или аккаунту; аккаунт стоит под именем, однофамильцев не перепутать. Ниже — номер и дата договора.',
  );
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
};
