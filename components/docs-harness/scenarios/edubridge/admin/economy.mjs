// Сценарий: экономика программы «Образование» — деньги по пути взноса ученика,
// настройки и расход программы со служебной запиской.

import crypto from 'node:crypto';
import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, fill, pick } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.economy',
  title: 'Экономика программы',
  docPath: 'new/edubridge/admin/economy.md',
  assetsDir: 'assets/new/edubridge/admin/economy',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

const BIK = '044525225';

/**
 * Расчётный счёт с верным ключом по БИК (веса 7-1-3, как в сценарии
 * expenses/counterparties): случайный хвост — повторный запуск не упирается
 * в «такой контрагент уже есть».
 */
function bankAccount() {
  const tail = String(crypto.randomInt(0, 1e11)).padStart(11, '0');
  const digits = (BIK.slice(-3) + `407028100${tail}`).split('').map(Number);
  const weights = [7, 1, 3];
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i % 3], 0);
  const key = (((10 - (sum % 10)) % 10) * 7) % 10;
  return `40702810${key}${tail}`;
}

/**
 * Ввод в поле окна контрагента. Поиск по ИНН подставляет наименование, КПП и
 * ОГРН из реестра и закрывает их для правки — такое поле пропускаем.
 */
async function fillIn(dialog, label, value) {
  const input = dialog.getByLabel(label, { exact: true }).first();
  if (!(await input.isEditable().catch(() => false))) return;
  await input.click();
  await input.fill(value);
}

/**
 * Сумма карточки «Кошелёк программы»: расход не может превышать свободные
 * средства. Карточка — общий WalletCard: подпись `.wallet__title` вместе с
 * иконкой подсказки, сумма — в соседней колонке `.wallet__metric-val`.
 */
async function fundBalance(page) {
  const card = page
    .locator('.wallet')
    .filter({ has: page.locator('.wallet__title', { hasText: 'Кошелёк программы' }) })
    .first();
  const text = await card.locator('.wallet__metric-val').first().innerText({ timeout: 15000 }).catch(() => '');
  // Форматтер сумм ставит узкие пробелы между разрядами — убираем любые.
  const m = text.replace(/[\s\u00a0\u202f\u2009]/g, '').match(/(\d+)[,.](\d{2})/);
  return m ? Number(m[1]) : 0;
}

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('economy'), 'Кошелёк программы');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-money', 'Деньги программы по пути взноса ученика: кошельки учеников, удержано по гарантии, кошелёк программы, резерв выплат преподавателям. Ниже — движения.');
  const free = await fundBalance(page);

  const settings = page.locator('text=Настройки').first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
    await page.waitForTimeout(1000);
    await shot(page, '02-settings', 'Настройки: целевой членский взнос в процентах — часть взноса ученика на ведение программы, издержки и возвраты по Положению. Один на все курсы кооператива.');
  }
  const expenses = page.locator('text=Расходы').first();
  if (!(await expenses.isVisible().catch(() => false))) return;
  await expenses.click();
  await page.waitForTimeout(1000);
  await shot(page, '03-expenses', 'Расходы программы оплачиваются с кошелька программы: служебная записка, решение совета, выплата кассиром.');

  // Расход — не больше свободных средств кошелька программы.
  const amount = Math.min(2500, Math.floor(free));
  if (amount < 100) {
    console.log(`    кошелёк программы ${free} — расход не подаётся`);
    return;
  }
  await page.locator('button:has-text("Подать расход")').first().click();
  await page.waitForSelector('text=Цель расходов', { timeout: 15000 });
  await fill(page, 'Цель расходов', 'Учебные пособия для курса подготовки к ОГЭ');
  const due = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  await fill(page, 'Срок исполнения', due);
  // Первую позицию форма заводит сама; лишняя пустая позиция блокирует подачу.
  await page.waitForSelector('text=Позиция №1', { timeout: 15000 });
  // Для организации форма сама ставит «Оплата по счету» и блокирует поле.
  await pick(page, 'Тип получателя', 'Организация/ИП');
  // Организация — из реестра контрагентов (99D-35): на чистом стенде он пуст,
  // контрагента заводим кнопкой «Добавить» в поле «Получатель — организация».
  // Сохранённый контрагент выбирается в позиции сам, реквизиты берутся из его
  // карточки — отдельного поля реквизитов у организации нет.
  await page.locator('.cp-select button:has-text("Добавить")').first().click();
  const cpDialog = page.locator('.q-dialog').filter({ hasText: 'Новый контрагент' }).last();
  await cpDialog.locator('text=Новый контрагент').first().waitFor({ state: 'visible', timeout: 20000 });
  await fillIn(cpDialog, 'ИНН', '7707083893');
  await page.waitForTimeout(1500);
  await fillIn(cpDialog, 'Наименование', 'ООО «Учебные пособия»');
  await fillIn(cpDialog, 'КПП', '773601001');
  await fillIn(cpDialog, 'ОГРН', '1027700132195');
  await fillIn(cpDialog, 'Расчётный счёт', bankAccount());
  await fillIn(cpDialog, 'Банк', 'ПАО Сбербанк');
  await fillIn(cpDialog, 'БИК', BIK);
  await fillIn(cpDialog, 'Корр. счёт', '30101810400000000225');
  await fillIn(cpDialog, 'Назначение платежа по умолчанию', 'Оплата по счёту за учебные пособия. Без НДС');
  await cpDialog.locator('button:has-text("Сохранить")').first().click();
  await cpDialog.waitFor({ state: 'hidden', timeout: 30000 });
  await page.waitForTimeout(800);
  await fill(page, 'Сумма (план)', String(amount));
  await fill(page, 'Что оплачиваем', 'Сборники заданий ОГЭ по математике, 20 экземпляров');
  await fill(page, 'Назначение платежа', 'Оплата по счёту № 5 от 14.10.2026 за учебные пособия');
  await page.waitForTimeout(500);
  await shot(page, '04-expense-form', 'Служебная записка на расход: цель и срок, позиции — получатель, способ оплаты, сумма, реквизиты и назначение платежа. Способ оплаты: оплата по счёту организации либо аванс пайщику под отчёт.');
  await page.locator('button:has-text("Подать на одобрение")').last().click();
  await page.waitForSelector('text=Расход подан', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '05-expense-submitted', 'Расход подан: заявление подписано, вопрос поставлен в повестку совета. Средства кошелька программы выделены под расход.');
};
