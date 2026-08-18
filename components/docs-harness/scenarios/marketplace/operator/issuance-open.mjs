// Сценарий: оператор открывает выдачу заказа по коду получателя.
//
// Заказы на пункте выдачи сгруппированы по заказчикам. Открыть выдачу можно
// только по QR-коду получателя — так подтверждается, что пришёл именно он.
// Код имеет вид `blago:receive:<кооператив>:<пайщик>` и показывается заказчику
// в разделе «Показать QR». В harness камеры нет, используется штатный ручной
// ввод кода.
//
// Прежняя версия требовала ручного ввода «ID кооперативного участка выдачи» —
// такого шага больше нет, участок берётся из контекста стола.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель КУ Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
// Цена приёмки — оттуда, где её задаёт акт: две копии числа разъехались бы
// молча, и проверка цены выдачи перестала бы что-либо значить.
import { FACT_UNIT_PRICE as RECEPTION_UNIT_PRICE } from './apl-reception-create.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

const RECEIVER_CODE = `blago:receive:${process.env.COOPNAME || 'voskhod'}:ekaterina`;

/**
 * Заказчица забирает не всё принятое: приняли девять единиц, выдаём восемь.
 * Невыданное не пропадает и не остаётся за пайщицей — оно превращается в
 * обезличенный остаток кооператива, который потом можно предложить заново
 * (см. operator/stock-republish).
 */
const ISSUE_QUANTITY = 8;

export const meta = {
  title: 'Стол ПВЗ — открытие выдачи заказа',
  assetsDir: 'assets/new/marketplace/operator/issuance-open',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.issuance',
  cases: ['mkt.iss.happy.01'],
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

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Сканировать QR', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-issuance-board',
    'Поток выдач участка: заказы сгруппированы по заказчикам, карточки показывают, что кому причитается. Выдачу нельзя открыть «просто так» — нужен код получателя.',
  );

  await page.getByText('Сканировать QR').first().click({ force: true });
  await page.waitForSelector('text=Или введите код вручную', { timeout: 20000 });
  await page.waitForTimeout(1000);

  await shot(
    page,
    '02-scan-receiver',
    'Оператор читает код получателя: заказчик показывает его с экрана телефона или с распечатки. Код подтверждает, что за заказом пришёл именно тот пайщик.',
  );

  // Поле ввода — внутри диалога: первым input на странице идёт поиск.
  const dialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Сканирование QR' }).first();
  const input = dialog.locator('input').first();
  await input.click();
  await input.type(RECEIVER_CODE, { delay: 20 });
  await page.waitForTimeout(400);
  await dialog.locator('button:has-text("Применить")').first().click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await expect(page.locator('text=Нераспознанный код')).toHaveCount(0, { timeout: 15000 });
  const issueDialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Открытие выдачи пайщику' }).first();
  await expect(issueDialog.locator('text=Открытие выдачи пайщику').first()).toBeVisible({ timeout: 15000 });

  // Выдаём меньше принятого: поле факта управляемое, без blur модель остаётся
  // с прежним количеством и акт уйдёт на полном объёме.
  const factQty = issueDialog.locator('.correction-table__fact input').first();
  const acceptedQty = Number.parseFloat(await factQty.inputValue());

  // Цена, с которой открылась выдача. Имущество приняли дешевле объявленного
  // (недоприём с уценкой), поэтому здесь обязана стоять цена ПРИЁМКИ, а не
  // цена заказа: по ней имущество лежит на складе, по ней же пайщик за него
  // платит. Если сюда попадёт цена заказа, выбытие со склада уйдёт дороже
  // прихода, и счёт материалов уйдёт в минус на всю разницу (так и было до
  // 14 августа: приход 1800 ₽, выбытие 2000 ₽).
  // В блоке правки два поля подряд: количество и цена за единицу отпуска.
  const factPriceInput = issueDialog.locator('.correction-table__fact input').nth(1);
  const openedPrice = Number.parseFloat(await factPriceInput.inputValue());
  await factQty.click();
  await factQty.fill(String(ISSUE_QUANTITY));
  await factQty.blur();
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-issuance-opened',
    `Код принят: открылась выдача пайщику. Оператор сверяет имущество с заказами — «План» это сколько заказано, «Принято» сколько на складе. Здесь заказчица забирает ${ISSUE_QUANTITY} единиц из принятых ${acceptedQty}: невыданное останется на складе обезличенным остатком кооператива, а разница вернётся в кошелёк Стола заказов.`,
    {
      preserveNotifications: true,
      expect: async () => {
        // Количество обязано быть в модели: от него считается и сумма к
        // оплате, и возврат, и то, что осядет на складе.
        expect(Number.parseFloat(await factQty.inputValue())).toBe(ISSUE_QUANTITY);
        expect(acceptedQty).toBeGreaterThan(ISSUE_QUANTITY);
        // Выдача открылась по цене приёмки (её задал акт приёмки), а не по
        // цене заказа — иначе выбытие со склада пойдёт дороже прихода.
        expect(openedPrice).toBe(RECEPTION_UNIT_PRICE);
        // Недовыдача обязана быть названа деньгами, а не просто уменьшить итог.
        const refund = issueDialog.locator('.issue-act__sum').filter({ hasText: 'Вернётся в кошелёк' });
        await expect(refund.first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  await page.locator('button:has-text("Подписать и отправить пайщику")').first().click();
  await page.waitForTimeout(10000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-issuance-signed',
    'Акт выдачи подписан оператором и отправлен пайщику: теперь заказчик подтверждает получение сам в своём кабинете. До его подписи имущество считается невыданным.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Диалог обязан закрыться — иначе подпись не ушла на сервер.
        await expect(p.locator('text=Открытие выдачи пайщику')).toHaveCount(0, { timeout: 20000 });
      },
    },
  );
};
