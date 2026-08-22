// Сценарий: выключенная кооперативом категория исчезает из формы предложения.
//
// Белый список категорий — не украшение стола председателя: он ограничивает
// то, что поставщик вообще может опубликовать. Проверяем это с двух сторон в
// одном проходе: председатель выключает категорию, поставщик открывает свою
// форму — категории в списке нет.
//
// Сценарий восстанавливает состояние: каталог возвращается открытым, иначе
// следующим шагом цепочки поставщик не смог бы подать предложение.
//
// Роли две, поэтому поставщик работает в своём окне: сессия пайщика лежит в
// IndexedDB кооператива, и на одной вкладке одновременно живёт только одна.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanViteOverlays,
  env,
  loginAs,
  loginAsChairman,
  pickBranchIfAsked,
} from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Доступные категории — выключенная категория недоступна поставщику',
  assetsDir: 'assets/new/marketplace/chairman/category-disabled-in-offer-form',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.categories',
  cases: ['mkt.cat.side.04'],
  fixtures: ['ivanpetrov'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
  ],
};

/** Открывает список категорий в форме предложения и возвращает его состав. */
async function readOfferFormCategories(p) {
  await p.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/create-offer`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await cleanViteOverlays(p);

  await p.locator('.q-field:has-text("Категория")').first().click();
  const options = p.locator('.q-menu .q-item, .q-menu [role="option"]');
  await options.first().waitFor({ state: 'visible', timeout: 20000 });
  return (await options.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/category-whitelist`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Доступные категории', { timeout: 60000 });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 20000 });
  // Первая колонка таблицы — название категории.
  const disabledCategory = (await firstRow.locator('td').first().innerText()).trim();
  expect(disabledCategory.length).toBeGreaterThan(0);

  const toggle = firstRow.locator('.q-toggle').first();
  await pickBranchIfAsked(page, { timeout: 4000 });
  await toggle.click({ force: true });
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-category-off',
    `Председатель выключил категорию «${disabledCategory}»: каталог перестал быть открытым. Ниже — что после этого видит поставщик в своей форме.`,
    {
      expect: async (p) => {
        await expect(p.locator('text=Открыт весь каталог')).toHaveCount(0, { timeout: 10000 });
      },
    },
  );

  // Поставщик — в своём окне: две сессии кооператива на одной вкладке не живут.
  const supplierContext = await context.browser().newContext({
    viewport: page.viewportSize(),
    locale: 'ru-RU',
  });
  let categories = [];
  try {
    const supplierPage = await supplierContext.newPage();
    await loginAs(supplierPage, loadFixture('ivanpetrov'));
    await pickBranchIfAsked(supplierPage);
    categories = await readOfferFormCategories(supplierPage);

    await shot(
      supplierPage,
      '02-offer-form-categories',
      `Список категорий в форме предложения поставщика: выключенной категории «${disabledCategory}» в нём нет — опубликовать в ней предложение невозможно.`,
      {
        expect: async (p) => {
          // Список обязан быть непустым: иначе отсутствие выключенной
          // категории ничего не доказывает — не отрисовался бы весь справочник.
          await expect(p.locator('.q-menu .q-item, .q-menu [role="option"]').first())
            .toBeVisible({ timeout: 10000 });
        },
      },
    );
  } finally {
    await supplierContext.close();
  }

  expect(categories.length).toBeGreaterThan(0);
  expect(categories).not.toContain(disabledCategory);

  // Возвращаем каталог открытым: дальше по цепочке поставщик публикует
  // предложение, и урезанный справочник сломал бы следующий сценарий.
  await toggle.click({ force: true });
  await page.waitForTimeout(2500);
  await expect(page.locator('text=Открыт весь каталог').first()).toBeVisible({ timeout: 15000 });
};
