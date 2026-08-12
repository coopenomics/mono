// Сценарий: второй пайщик заказывает обезличенный остаток кооператива.
//
// Имущество, оставшееся после недовыдачи и принятых возвратов, председатель
// участка заново опубликовал в каталоге (см. operator/stock-republish). Для
// заказчика это обычное предложение — с той разницей, что продавец сам
// кооператив, выдача идёт сразу со склада участка, а цена и срок
// гарантийного возврата назначены заново.
//
// Заказывает ДРУГОЙ пайщик, не тот, чей заказ породил остаток: возврат по
// такому заказу должен вернуть имущество кооперативу, а не первому заказчику.
//
// Фикстура: orderer2 / Зайцева Анна — подключённая заказчица участка krg.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

/** Метка предложения кооператива в каталоге — по ней отличаем его от поставщика. */
const COOP_STOCK_LABEL = 'Со склада кооператива';

export const meta = {
  title: 'Стол заказчика — заказ остатка кооператива',
  docPath: 'new/marketplace/orderer/stock-order.md',
  assetsDir: 'assets/new/marketplace/orderer/stock-order',
  role: 'user',
  mode: 'docs',
  fixture: 'orderer2',
  fixtures: ['orderer2'],
  feature: 'marketplace.stock',
  cases: ['mkt.stock.happy.02'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('orderer2'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=В корзину', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  const stockCard = page
    .locator('.mp-catalog-offer-card')
    .filter({ hasText: COOP_STOCK_LABEL })
    .first();

  await shot(
    page,
    '01-catalog-with-stock',
    'Каталог глазами второго заказчика: рядом с предложениями поставщиков стоит предложение самого кооператива — остаток склада с выдачей сразу.',
    {
      expect: async () => {
        // Без карточки остатка заказывать нечего: значит публикация не дошла
        // до витрины.
        await expect(stockCard).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await stockCard.getByText('В корзину').first().click();
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  const cartDialog = page
    .locator('[id^="q-portal--dialog--"]')
    .filter({ hasText: 'Добавить в корзину' })
    .first();

  await shot(
    page,
    '02-quantity-dialog',
    'Диалог количества для остатка: доступно ровно столько, сколько лежит на складе участка — больше остатка взять нельзя.',
    { preserveNotifications: true },
  );

  await cartDialog.locator('button:has-text("Добавить в корзину")').first().click();
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/cart`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-cart',
    'Корзина второго заказчика: позиция остатка с новой ценой — той, которую председатель назначил при публикации, а не ценой исходного предложения поставщика.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        await expect(p.locator('button:has-text("Оформить заказ")').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.locator('button:has-text("Оформить заказ")').first().click();
  await page.waitForTimeout(10000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-confirmation',
    'Заказ остатка оформлен. Цикла поставки здесь нет: имущество уже на участке, поэтому заказ сразу готов к выдаче.',
    { preserveNotifications: true },
  );

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '05-my-orders',
    'Заказ второго пайщика в его разделе «Мои заказы»: имущество то же самое, но заказ новый и принадлежит другому пайщику.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Заказ обязан появиться: пустой список означал бы, что оформление
        // молча отбилось сервером.
        await expect(p.locator('text=Берёзовый сок').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
