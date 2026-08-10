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

/** Ввод в поле факта: 0 — количество, 1 — цена за единицу. */
async function setFactField(dialog, index, value) {
  const input = dialog.locator('.correction-table__fact input').nth(index);
  await input.click();
  await input.fill(String(value));
  await input.blur();
  // Пересчёт итогов идёт на реактивности, но перерисовка не мгновенная.
  await dialog.page().waitForTimeout(1200);
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

  // ── Недовыдача: заказчик забирает на единицу меньше ──────────────────────
  const shortQty = Math.max(plannedQty - 1, 0);
  await setFactField(dialog, 0, shortQty);

  const shortTotal = await sumByLabel(dialog, 'Итого к оплате');
  const refund = await sumByLabel(dialog, 'Вернётся в кошелёк Стола заказов');

  await shot(
    page,
    '02-short-issue',
    'Выдано меньше принятого: итог к оплате уменьшился, а разница показана отдельной строкой — она вернётся в кошелёк Стола заказов. Невыданное остаётся на складе участка обезличенным остатком кооператива.',
    {
      preserveNotifications: true,
      expect: async () => {
        // Недовыдача обязана уменьшить сумму: если итог не двинулся, пайщик
        // заплатит за то, чего не получил.
        expect(shortTotal).toBeLessThan(baseTotal);
        // И разница обязана быть названа возвратом, а не потеряться молча.
        expect(refund).toBeGreaterThan(0);
      },
    },
  );

  // ── Недовыдача плюс повышение цены ───────────────────────────────────────
  await setFactField(dialog, 1, (unitPrice * 1.5).toFixed(2));

  const dearerTotal = await sumByLabel(dialog, 'Итого к оплате');

  await shot(
    page,
    '03-short-and-dearer',
    'То же количество, но цена за единицу поднята: итог вырос относительно недовыдачи по прежней цене. Количество и цена — независимые расхождения, и в деньгах они складываются.',
    {
      preserveNotifications: true,
      expect: async () => {
        expect(dearerTotal).toBeGreaterThan(shortTotal);
      },
    },
  );

  // ── Гард: выдать больше принятого нельзя ─────────────────────────────────
  await setFactField(dialog, 1, unitPrice);
  await setFactField(dialog, 0, plannedQty + 5);

  await shot(
    page,
    '04-over-accepted',
    'Оператор пробует выдать больше, чем принято на склад: строка помечается как превышение, и подписать акт на такое количество нельзя. Физически этого имущества на участке нет.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        await expect(
          p.locator('.correction-table__summary-chips').getByText('Больше принятого').first()
        ).toBeVisible({ timeout: 10000 });
      },
    },
  );

  // Возвращаем план и уходим без подписи: заказ должен остаться нетронутым
  // для следующих сценариев цепочки.
  await setFactField(dialog, 0, plannedQty);
  await dialog.locator('button:has-text("Отмена"), button:has-text("Закрыть")').first().click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '05-closed-without-signing',
    'Диалог закрыт без подписи: правка факта сама по себе ничего не меняет — пока акт не подписан, заказ остаётся в прежнем состоянии.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        await expect(p.locator('text=Открытие выдачи пайщику')).toHaveCount(0, { timeout: 15000 });
      },
    },
  );
};
