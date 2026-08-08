// Сценарий: заказчица оформляет заказ по опубликованному предложению.
//
// Путь: каталог витрины → «В корзину» → корзина → оформление → подтверждение.
// Пункт выдачи заказчица выбрала при подключении к столу (L3), поэтому здесь
// он уже проставлен и меняется отдельным действием.
//
// Гейт первого входа сюда НЕ входит: он покрыт сценарием
// onboarding/extension-gate. Прежняя версия сценария пыталась снимать его
// заодно и падала на «Недостаточно прав», потому что у подключённой заказчицы
// страницы подключения больше нет.
//
// Фикстура: ekaterina / Смирнова Екатерина Александровна — подключённая
// заказчица (участок krg).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол заказчика — оформление заказа',
  docPath: 'new/marketplace/orderer/order-create.md',
  assetsDir: 'assets/new/marketplace/orderer/order-create',
  role: 'user',
  mode: 'docs',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
  feature: 'marketplace.order',
  cases: ['mkt.order.happy.01'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    // Оформление списывает средства с кошелька заказчика: при нулевом балансе
    // сервер отбивает заказ («Недостаточно средств для оформления»), и падение
    // выглядит как поломка интерфейса.
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ekaterina');
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);

  // --- Каталог -------------------------------------------------------------
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=В корзину', { timeout: 60000 });
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-catalog',
    'Каталог витрины: заказчица выбирает предложение. Цена показана для заказчика — она уже включает членский взнос кооператива.',
  );

  // «В корзину» открывает диалог с количеством — товар кладётся только после
  // подтверждения. Прежняя версия сразу уходила в корзину и находила её пустой.
  await page.getByText('В корзину').first().click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-quantity-dialog',
    'Диалог выбора количества: заказчица указывает, сколько единиц берёт, и видит итоговую сумму до подтверждения.',
  );

  await page.locator('button:has-text("Добавить в корзину")').first().click();
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  // --- Корзина -------------------------------------------------------------
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
    'Корзина: выбранный товар, количество и итоговая сумма. Отсюда заказчица переходит к оформлению заказа.',
    {
      expect: async (p) => {
        // Пустая корзина здесь означала бы, что «В корзину» ничего не добавила.
        await expect(p.locator('text=Берёзовый сок').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  // --- Оформление ----------------------------------------------------------
  await page.locator('button:has-text("Оформить заказ")').first().click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-confirmation',
    'Подтверждение заказа: состав, пункт выдачи и сумма. После подтверждения заказ уходит поставщику и появляется в «Моих заказах».',
  );

  // --- Мои заказы ----------------------------------------------------------
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
    'Раздел «Мои заказы»: оформленный заказ со статусом ожидания решения поставщика.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Берёзовый сок').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
