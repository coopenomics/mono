// Сценарий: председатель участка заново предлагает пайщикам обезличенный
// остаток кооператива.
//
// Остаток появляется двумя путями: недовыдача (заказчик забрал меньше, чем
// приняли) и принятый гарантийный возврат. Адресность с такого имущества
// снята — оно принадлежит кооперативу и может быть предложено любому
// пайщику заново, обычно с уценкой и своим сроком гарантийного возврата.
//
// Публикуется ОДНА позиция: остальные нужны списанию (там список кандидатов
// строится из того же свободного остатка).
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель КУ Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

/** Цена перепредложения — ниже цены прибытия: остаток продаётся с уценкой. */
export const REPUBLISH_PRICE = 200;
/** Свой срок гарантийного возврата на перепредложенное имущество. */
export const REPUBLISH_WARRANTY_DAYS = 14;

export const meta = {
  title: 'Стол ПВЗ — перепредложение остатка кооператива',
  assetsDir: 'assets/new/marketplace/operator/stock-republish',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.stock',
  cases: ['mkt.stock.happy.01'],
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

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse/stock`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  // Ждём баннер вкладки, а не подпись над списком: подпись живёт внутри
  // блока позиций и при пустом остатке не рендерится вовсе — ожидание по ней
  // упирается в таймаут вместо внятного «остатка нет».
  await page.waitForSelector('text=Обезличенный остаток кооператива', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  const rows = page.locator('table.table tbody tr');
  const rowsBefore = await rows.count();

  await shot(
    page,
    '01-coop-stock',
    'Обезличенный остаток кооператива: то, что осталось после недовыдач и принятых возвратов. Адресности у этого имущества больше нет — оно принадлежит кооперативу.',
    {
      expect: async () => {
        // Пустой остаток означал бы, что ни недовыдача, ни возврат не дошли
        // до склада — перепредлагать нечего и сценарий бессмыслен.
        expect(rowsBefore).toBeGreaterThan(0);
      },
    },
  );

  // Берём одну свободную позицию: зарезервированные чекбоксом не выбираются
  // (у них disable), а остальные свободные нужны списанию. Кликаем по самому
  // q-checkbox: нативный input у Quasar скрыт классом hidden и клика не примет.
  const freeRow = rows.filter({ hasText: 'Свободна' }).first();
  await expect(freeRow).toBeVisible({ timeout: 20000 });
  await freeRow.locator('.q-checkbox').first().click();
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  await page.locator('button:has-text("Опубликовать (")').first().click();
  await page.waitForSelector('text=Публикация остатка в каталог', { timeout: 20000 });
  await page.waitForTimeout(1000);

  const dialog = page
    .locator('[id^="q-portal--dialog--"]')
    .filter({ hasText: 'Публикация остатка в каталог' })
    .first();
  const priceInput = dialog.locator('input').first();
  const warrantyInput = dialog.locator('input').nth(1);
  await priceInput.click();
  await priceInput.fill(String(REPUBLISH_PRICE));
  await warrantyInput.click();
  await warrantyInput.fill(String(REPUBLISH_WARRANTY_DAYS));
  await warrantyInput.blur();
  await page.waitForTimeout(600);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-publish-dialog',
    `Публикация остатка: цена ${REPUBLISH_PRICE} ₽ ниже цены прибытия — имущество идёт с уценкой, и председатель отдельно назначает срок гарантийного возврата (${REPUBLISH_WARRANTY_DAYS} дней) вместо срока исходного предложения.`,
    { preserveNotifications: true },
  );

  await dialog.locator('button:has-text("Опубликовать")').last().click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-published',
    'Позиция опубликована: она стала предложением кооператива с мгновенной выдачей со склада и видна пайщикам в каталоге наравне с предложениями поставщиков.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Состояние позиции обязано смениться на «На витрине»: без этого
        // заказать её пайщик не сможет.
        await expect(p.locator('text=На витрине').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
