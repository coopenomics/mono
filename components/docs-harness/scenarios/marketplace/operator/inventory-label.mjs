// Сценарий: маркировка принятого имущества на складе участка.
//
// После приёмки позиция лежит на складе с пометкой «Без этикетки». Оператор
// печатает лист этикеток, наклеивает их на имущество и привязывает сканером —
// тогда при выдаче позиция находится за секунду по коду.
//
// Саму привязку сценарий НЕ выполняет: коды этикеток система выдаёт в
// печатной форме (PDF), прочитать их из harness нечем, а ручной ввод
// произвольного кода сканер справедливо отбивает — «Нераспознанный код.
// Отсканируйте код передачи поставщика, QR с ТТН экспедитора или код
// получения заказчика». Поэтому здесь документируется механика и состояние
// до привязки; закрытие случая привязки требует чтения печатной формы.
//
// Адресное хранение (боксы и ячейки) на стенде выключено в настройках
// расширения, поэтому шага с выбором бокса здесь нет.
//
// Прежняя версия сценария ходила на /market-pvz/labeling (маршрута больше нет)
// и требовала ручного ввода «ID кооперативного участка» — участок берётся из
// контекста стола.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель КУ Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

// Номер этикетки в формате EAN-13 — тот же вид, что подсказывает интерфейс.
const LABEL_CODE = '4600000000017';

export const meta = {
  title: 'Стол ПВЗ — маркировка имущества',
  docPath: 'new/marketplace/operator/inventory-label.md',
  assetsDir: 'assets/new/marketplace/operator/inventory-label',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.supply',
  cases: ['mkt.supply.happy.05'],
  // Привязка этикетки (mkt.supply.side.09) остаётся незакрытой — см. шапку.
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Раскладка и маркировка', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-warehouse-unlabeled',
    'Раскладка и маркировка: принятое имущество с количеством и заказчиком. Пометка «Без этикетки» означает, что позицию ещё не привязали к коду — при выдаче её придётся искать вручную.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Без этикетки').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.locator('button:has-text("Печать этикеток")').first().click();
  await page.waitForSelector('text=Сколько этикеток напечатать', { timeout: 20000 });
  await page.waitForTimeout(1000);

  await shot(
    page,
    '02-print-dialog',
    'Печать этикеток: оператор указывает количество, распечатывает лист, разрезает и наклеивает этикетки на имущество. Коды этикеток выдаёт система — произвольный номер сканер не примет.',
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  await page.getByText('qr_code_scanner').first().click({ force: true });
  await page.waitForSelector('text=Или введите код вручную', { timeout: 20000 });
  await page.waitForTimeout(1000);

  await shot(
    page,
    '03-bind-dialog',
    'Привязка этикетки к позиции: тот же сканер читает код передачи поставщика, QR товарно-транспортной накладной и код получения заказчика — по нему же оператор находит позицию при выдаче.',
  );
};
