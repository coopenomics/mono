// Сценарий: экономика программы «Образование» — деньги по пути взноса ученика,
// настройки и расход программы со служебной запиской.

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

/** Сумма плитки «Кошелёк программы»: расход не может превышать свободные средства. */
async function fundBalance(page) {
  const caption = page.locator('text=/^Кошелёк программы$/i').first();
  for (const up of ['..', '../..', '../../..']) {
    const text = await caption.locator(`xpath=${up}`).innerText().catch(() => '');
    // Форматтер сумм ставит узкие пробелы между разрядами — убираем любые.
    const m = text.replace(/[\s\u00a0\u202f\u2009]/g, '').match(/(\d+)[,.](\d{2})/);
    if (m) return Number(m[1]);
  }
  return 0;
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
  await page.locator('button:has-text("Добавить позицию")').first().click();
  await page.waitForTimeout(500);
  // Для организации форма сама ставит «Оплата по счету» и блокирует поле.
  await pick(page, 'Тип получателя', 'Организация/ИП');
  await fill(page, 'Название организации', 'ООО «Учебные пособия»');
  await fill(page, 'Сумма (план)', String(amount));
  await fill(page, 'Что оплачиваем', 'Сборники заданий ОГЭ по математике, 20 экземпляров');
  await fill(page, 'Реквизиты получателя', 'ИНН 7700000000, р/с 40702810900000000002, БИК 044525225');
  await fill(page, 'Назначение платежа', 'Оплата по счёту № 5 от 14.10.2026 за учебные пособия');
  await page.waitForTimeout(500);
  await shot(page, '04-expense-form', 'Служебная записка на расход: цель и срок, позиции — получатель, способ оплаты, сумма, реквизиты и назначение платежа. Способ оплаты: оплата по счёту организации либо аванс пайщику под отчёт.');
  await page.locator('button:has-text("Подать на одобрение")').last().click();
  await page.waitForSelector('text=Расход подан', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '05-expense-submitted', 'Расход подан: заявление подписано, вопрос поставлен в повестку совета. Средства кошелька программы выделены под расход.');
};
