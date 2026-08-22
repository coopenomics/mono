// Сценарий: оператор участка принимает партию поставщика.
//
// Приёмка начинается со сканирования QR-кода поставщика — код подтверждает его
// личность и состав партии. В harness камеры нет, поэтому используем штатный
// ручной ввод («Или введите код вручную»): это тот же путь, которым оператор
// пользуется, когда камера недоступна.
//
// Код поставщика имеет вид `blago:pickup:<кооператив>:<пайщик>` и показывается
// на столе поставщика кнопкой «Мой код для ПВЗ».
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель Красногорск,
// он же оператор участка на стенде.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

const SUPPLIER_CODE = `blago:pickup:${process.env.COOPNAME || 'voskhod'}:ivanpetrov`;

/**
 * Партия приходит не такой, какой её заказали: поставщик привёз на единицу
 * меньше и товар приняли дешевле объявленного. Оба расхождения оператор
 * фиксирует в одной сверке, и от них считается, сколько вернётся заказчику.
 *
 * Заказ — 10 единиц по 250 ₽. Принимаем 9 по 200 ₽: 9 × 200 = 1800 ₽ вместо
 * 2500 ₽, и разница вместе с частью членского взноса возвращается пайщице.
 */
const FACT_QUANTITY = 9;
export const FACT_UNIT_PRICE = 200;

export const meta = {
  title: 'Стол ПВЗ — приёмка партии поставщика',
  docPath: 'new/marketplace/operator/reception-flow.md',
  assetsDir: 'assets/new/marketplace/operator/reception-flow',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.supply',
  cases: ['mkt.supply.happy.01'],
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
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/reception`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('button:has-text("Сканировать QR")', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-expected-shipments',
    'Ожидаемые поставки участка: карточка поставщика, состав партии и сумма поставки. Пока партия не принята, она числится за поставщиком.',
    {
      expect: async (p) => {
        // Партия, собранная поставщиком, обязана дойти до участка.
        await expect(p.locator('text=Ожидает приёмки').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.locator('button:has-text("Сканировать QR")').first().click();
  await page.waitForSelector('text=Сканирование QR партии', { timeout: 20000 });
  await page.waitForTimeout(1000);

  await shot(
    page,
    '02-scan-dialog',
    'Диалог приёмки: оператор наводит камеру на код передачи либо вводит его вручную — например когда поставщик показывает код с распечатки.',
  );

  await page.locator('input').first().fill(SUPPLIER_CODE);
  await page.locator('button:has-text("Применить")').first().click();
  await page.waitForTimeout(6000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await expect(page.locator('text=Приёмка имущества поставщика').first()).toBeVisible({ timeout: 15000 });

  // Правим факт: количество и цену. Поля управляемые — без blur модель
  // остаётся с прежним значением, и акт уйдёт на заказанных числах при
  // внешне правильном экране.
  const factInputs = page.locator('.reception__unit-fact input');
  const qtyInput = factInputs.nth(1); // 0 — «Заказано», только для чтения
  const priceInput = factInputs.nth(2);
  await qtyInput.click();
  await qtyInput.fill(String(FACT_QUANTITY));
  await qtyInput.blur();
  await page.waitForTimeout(500);
  await priceInput.click();
  await priceInput.fill(String(FACT_UNIT_PRICE));
  await priceInput.blur();
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-reception-check',
    `Сверка с фактом: поставщик привёз ${FACT_QUANTITY} единиц вместо заказанных десяти, и принимают их по ${FACT_UNIT_PRICE} ₽ вместо 250 ₽. Оба расхождения оператор фиксирует здесь; снятая галка означала бы, что позицию не принимают вовсе.`,
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Значения обязаны быть в модели, а не только на экране: от них
        // считается и сумма акта, и возврат заказчику.
        expect(await qtyInput.inputValue()).toBe(String(FACT_QUANTITY));
        expect(await priceInput.inputValue()).toBe(String(FACT_UNIT_PRICE));
        await expect(p.locator('text=Приёмка имущества поставщика').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  await page.locator('button:has-text("Сформировать акты")').first().click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-acts-created',
    'Акт приёма-передачи сформирован. Дальше его подписывает поставщик, а закрывающую подпись ставит председатель участка — только после этого имущество оприходуется на склад.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Диалог приёмки обязан закрыться: иначе акты не создались.
        await expect(p.locator('text=Приёмка имущества поставщика')).toHaveCount(0, { timeout: 20000 });
      },
    },
  );
};
