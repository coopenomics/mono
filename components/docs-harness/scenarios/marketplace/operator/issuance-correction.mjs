// Сценарий: оператор правит факт выдачи — количество и цену — и сверяет,
// как пересчитываются деньги.
//
// Расхождения бывают трёх видов и комбинируются: привезли меньше заказанного
// (недоприём), заказчик забрал меньше принятого (недовыдача), имущество
// отпускается по другой цене. Все три правятся в одной таблице сверки, и
// именно от них считается, вернутся ли деньги в кошелёк Стола заказов или
// придётся доплатить с паевого.
//
// Сценарий НИЧЕГО НЕ ПОДПИСЫВАЕТ: диалог закрывается отменой, заказ остаётся
// нетронутым. Иначе он переопределил бы количество и сумму заказа, от которых
// дальше считаются возврат и остаток склада — вся ветка после выдачи поехала
// бы на других числах.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель КУ Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

const RECEIVER_CODE = `blago:receive:${process.env.COOPNAME || 'voskhod'}:ekaterina`;

export const meta = {
  title: 'Стол ПВЗ — правка количества и цены при выдаче',
  docPath: 'new/marketplace/operator/issuance-correction.md',
  assetsDir: 'assets/new/marketplace/operator/issuance-correction',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.issuance',
  cases: ['mkt.iss.side.07'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

/** «1 234,56 ₽» → 1234.56. Пробелы бывают неразрывными, дробная часть — с запятой. */
const parseMoney = (text) =>
  Number.parseFloat(
    String(text)
      .replace(/ | |\s/g, '')
      .replace('₽', '')
      .replace(',', '.')
  );

/** Значение строки итогов по её подписи. */
async function sumByLabel(dialog, label) {
  const row = dialog.locator('.issue-act__sum').filter({ hasText: label }).first();
  if ((await row.count()) === 0) return null;
  return parseMoney(await row.locator('.issue-act__sum-value').innerText());
}

/**
 * Ввод в поле факта: 0 — количество, 1 — цена за единицу.
 *
 * После ввода ждём, пока итог к оплате перестанет совпадать с прежним:
 * пересчёт идёт на реактивности, и фиксированная пауза его не гарантирует —
 * читать сумму сразу после ввода значит читать доредактированное состояние.
 */
async function setFactField(dialog, index, value, prevTotal) {
  const input = dialog.locator('.correction-table__fact input').nth(index);
  await input.click();
  await input.fill(String(value));
  await input.blur();
  if (prevTotal !== undefined && prevTotal !== null) {
    for (let i = 0; i < 40; i++) {
      const now = await sumByLabel(dialog, 'Итого к оплате');
      if (now !== null && Math.abs(now - prevTotal) > 0.001) return now;
      await dialog.page().waitForTimeout(250);
    }
  }
  await dialog.page().waitForTimeout(1000);
  return sumByLabel(dialog, 'Итого к оплате');
}

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Сканировать QR', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  // Открываем выдачу тем же штатным путём, что и обычный сценарий: по коду
  // получателя. Камеры в harness нет — используется ручной ввод.
  await page.getByText('Сканировать QR').first().click({ force: true });
  await page.waitForSelector('text=Или введите код вручную', { timeout: 20000 });
  const scanDialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Сканирование QR' }).first();
  const codeInput = scanDialog.locator('input').first();
  await codeInput.click();
  await codeInput.type(RECEIVER_CODE, { delay: 20 });
  await page.waitForTimeout(400);
  await scanDialog.locator('button:has-text("Применить")').first().click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  const dialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Открытие выдачи пайщику' }).first();
  await expect(dialog.locator('text=Открытие выдачи пайщику').first()).toBeVisible({ timeout: 20000 });

  const qtyInput = dialog.locator('.correction-table__fact input').first();
  const priceInput = dialog.locator('.correction-table__fact input').nth(1);
  const plannedQty = Number.parseFloat(await qtyInput.inputValue());
  const unitPrice = Number.parseFloat(await priceInput.inputValue());
  const baseTotal = await sumByLabel(dialog, 'Итого к оплате');

  await shot(
    page,
    '01-fact-as-planned',
    'Выдача открыта без расхождений: факт совпадает с планом. Внизу — себестоимость, членский взнос и итог к оплате; ни возврата, ни доплаты в списке нет, потому что расхождения нет.',
    {
      preserveNotifications: true,
      expect: async () => {
        // Сверка бессмысленна, если заказ пуст или цена нулевая — тогда любой
        // пересчёт ниже сойдётся сам собой и ничего не проверит.
        expect(plannedQty).toBeGreaterThan(0);
        expect(unitPrice).toBeGreaterThan(0);
        expect(baseTotal).toBeGreaterThan(0);
      },
    },
  );

  // ── Цена снижена: имущество приняли хуже ожидаемого ──────────────────────
  const cheaperTotal = await setFactField(dialog, 1, (unitPrice / 2).toFixed(2), baseTotal);

  await shot(
    page,
    '02-cheaper',
    'Цена за единицу снижена: итог к оплате уменьшился вместе с ней. Цена — самостоятельное расхождение, количество при этом не менялось.',
    {
      preserveNotifications: true,
      expect: async () => {
        expect(cheaperTotal).toBeLessThan(baseTotal);
      },
    },
  );

  // ── Цена повышена ────────────────────────────────────────────────────────
  const dearerTotal = await setFactField(dialog, 1, (unitPrice * 2).toFixed(2), cheaperTotal);

  await shot(
    page,
    '03-dearer',
    'Цена поднята выше заказанной: итог вырос, и разница показана как доплата по факту — она спишется с паевого взноса пайщика.',
    {
      preserveNotifications: true,
      expect: async () => {
        expect(dearerTotal).toBeGreaterThan(cheaperTotal);
        expect(dearerTotal).toBeGreaterThan(baseTotal);
      },
    },
  );

  // ── Гард: выдать больше принятого нельзя ─────────────────────────────────
  // Форма не даёт даже набрать лишнее: введённое количество обрезается по
  // принятому на склад. Бейдж «Больше принятого» остаётся для случая, когда
  // превышение приходит уже готовым с сервера — например, остаток уменьшился
  // после открытия выдачи.
  await setFactField(dialog, 1, unitPrice, dearerTotal);
  const restoredTotal = await sumByLabel(dialog, 'Итого к оплате');
  await setFactField(dialog, 0, plannedQty + 5);
  const cappedQty = Number.parseFloat(await qtyInput.inputValue());
  const cappedTotal = await sumByLabel(dialog, 'Итого к оплате');

  await shot(
    page,
    '04-over-accepted',
    'Оператор пробует выдать больше, чем принято на склад: количество обрезается до принятого. Физически этого имущества на участке нет, и набрать его в акт нельзя.',
    {
      preserveNotifications: true,
      expect: async () => {
        // Обрезано ровно до принятого, а не просто «как-то уменьшено».
        expect(cappedQty).toBe(plannedQty);
        // И деньги от несостоявшегося превышения не выросли.
        expect(cappedTotal).toBe(restoredTotal);
      },
    },
  );

  // ── Позиция снята с выдачи целиком ───────────────────────────────────────
  // Заказ на этом стенде — одна единица, поэтому «забрать меньше» здесь
  // означает не забрать вовсе: галочка снимается, и вся сумма возвращается.
  await setFactField(dialog, 0, plannedQty);
  await dialog.locator('.correction-table__check .q-checkbox').first().click();
  await page.waitForTimeout(1500);

  const droppedTotal = await sumByLabel(dialog, 'Итого к оплате');
  const refund = await sumByLabel(dialog, 'Вернётся в кошелёк Стола заказов');

  await shot(
    page,
    '05-position-dropped',
    'Позиция снята с выдачи: к оплате не остаётся ничего, а вся сумма возвращается в кошелёк Стола заказов. Само имущество остаётся на складе участка — обезличенным остатком кооператива.',
    {
      preserveNotifications: true,
      expect: async () => {
        expect(droppedTotal).toBe(0);
        // Деньги не должны раствориться: снятая позиция обязана превратиться
        // в возврат, а не просто исчезнуть из итога.
        expect(refund).toBeGreaterThan(0);
      },
    },
  );

  // Возвращаем позицию и уходим без подписи: заказ должен остаться нетронутым
  // для следующих сценариев цепочки.
  await dialog.locator('.correction-table__check .q-checkbox').first().click();
  await page.waitForTimeout(1000);
  await dialog.locator('button:has-text("Отмена"), button:has-text("Закрыть")').first().click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '06-closed-without-signing',
    'Диалог закрыт без подписи: правка факта сама по себе ничего не меняет — пока акт не подписан, заказ остаётся в прежнем состоянии.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        await expect(p.locator('text=Открытие выдачи пайщику')).toHaveCount(0, { timeout: 15000 });
      },
    },
  );
};
