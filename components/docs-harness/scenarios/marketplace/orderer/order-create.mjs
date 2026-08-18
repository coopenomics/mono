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

/**
 * Заказ оформляется на несколько единиц, а не на одну.
 *
 * Одна единица делала непредставимой половину расхождений: «принять на единицу
 * меньше» это ноль, то есть не недоприём, а отказ от позиции; частичная выдача
 * тоже сводилась к «всё или ничего». Десять единиц дают запас, чтобы принять
 * девять и выдать восемь, и при этом заказ остаётся по карману заказчице
 * (10 × 250 ₽ + членский взнос 30% = 3250 ₽ при балансе 30 000 ₽).
 *
 * Число вынесено сюда: от него считаются суммы во всей цепочке ниже — приёмка,
 * выдача, возврат, остаток склада.
 */
export const ORDER_QUANTITY = 10;

export const meta = {
  title: 'Стол заказчика — оформление заказа',
  docPath: 'new/marketplace/orderer/cart-order.md',
  assetsDir: 'assets/new/marketplace/orderer/cart-order',
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

  // Количество — управляемое поле: fill() без blur оставляет модель на единице,
  // и заказ уходит на одну штуку при внешне правильном экране.
  const cartDialog = page
    .locator('[id^="q-portal--dialog--"]')
    .filter({ hasText: 'Добавить в корзину' })
    .first();
  const qtyInput = cartDialog.locator('input[type="number"]').first();
  await qtyInput.click();
  await qtyInput.fill('');
  await qtyInput.type(String(ORDER_QUANTITY));
  await qtyInput.blur();
  await page.waitForTimeout(800);

  await shot(
    page,
    '02-quantity-dialog',
    `Диалог выбора количества: заказчица берёт ${ORDER_QUANTITY} единиц и видит итоговую сумму до подтверждения — цена уже с членским взносом.`,
    {
      expect: async () => {
        // Значение должно быть в модели, а не только на экране: итог считается
        // от неё, и расхождение здесь тихо уронит суммы всей цепочки.
        expect(await qtyInput.inputValue()).toBe(String(ORDER_QUANTITY));
        const total = await cartDialog.locator('.add-to-cart__total').first().innerText();
        const price = await cartDialog.locator('.add-to-cart__price').first().innerText();
        const num = (t) => Number.parseFloat(String(t).replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.'));
        expect(num(total)).toBeCloseTo(num(price) * ORDER_QUANTITY, 2);
      },
    },
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
