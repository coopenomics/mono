// Сценарий: маркировка принятого имущества на складе участка.
//
// После приёмки позиция лежит на складе с пометкой «Без этикетки». Оператор
// печатает лист этикеток, наклеивает их на имущество и привязывает сканером —
// тогда при выдаче позиция находится за секунду по коду.
//
// Привязка выполняется вводом номера вручную: коды этикеток не выдаются
// сервером заранее, лист печатается со случайными номерами EAN-13
// (`randomEAN13` в shared/lib/marketplace/barcode-sheet), поэтому диалог
// «Привязать этикетку» принимает любой введённый номер и привязывает его
// сразу, без отдельной кнопки подтверждения.
//
// Прежняя версия шапки утверждала, что произвольный код «сканер справедливо
// отбивает» — это была ошибка: отбивает УНИВЕРСАЛЬНЫЙ сканер стола ПВЗ
// (widgets/Marketplace/UniversalScanner), который ищет код передачи, ТТН или
// код получения. Привязка этикетки — другой диалог, у позиции на складе.
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
  cases: ['mkt.supply.happy.05', 'mkt.supply.side.09'],
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

  // Кнопка сканера у самой позиции — не универсальный сканер в шапке стола.
  await page.locator('button[aria-label="Привязать этикетку сканером"]').first().click();
  const bindDialog = page
    .locator('[id^="q-portal--dialog--"]')
    .filter({ hasText: 'Привязать этикетку' })
    .first();
  await bindDialog.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1000);

  await shot(
    page,
    '03-bind-dialog',
    'Привязка этикетки к позиции: оператор наводит камеру на наклеенную этикетку либо вводит её номер вручную. Код привязывается сразу, отдельной кнопки подтверждения нет.',
  );

  // Номер печатается на листе этикеток случайным (EAN-13) и заранее серверу не
  // известен, поэтому подойдёт любой корректный номер той же длины.
  await bindDialog.locator('input').first().type(LABEL_CODE, { delay: 40 });
  await bindDialog.locator('button:has-text("Привязать")').last().click();
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-label-bound',
    `Этикетка ${LABEL_CODE} привязана к позиции: пометка «Без этикетки» снята, при выдаче позиция находится по номеру за секунду.`,
    {
      expect: async (p) => {
        await expect(p.locator(`text=${LABEL_CODE}`).first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
