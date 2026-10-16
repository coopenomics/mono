// Сценарий: председатель открывает «Авансы» стола кассира после выдачи аванса
// (сценарий cashier/payments): аванс Ивана Петрова ждёт отчёта; отбор по
// состоянию переключает список; строка открывает служебную записку.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'cashier.desk',
  title: 'Авансы',
  docPath: 'new/cashier/advances.md',
  assetsDir: 'assets/new/cashier/advances',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/cashier/advances`, 'Ждёт отчёта');
  await page.waitForTimeout(1500);
  const row = page.locator('tr').filter({ hasText: 'Закупка воды и бумаги' }).first();
  await expect(row, 'аванс не выдан: сценарий cashier/payments').toBeVisible({ timeout: 30000 });
  await expect(row, 'получатель не по ФИО').toContainText('Петров Иван');
  await expect(row, 'в строке не та сумма аванса').toContainText('1 500,00');
  // Строка оплаты счёта организации той же записки авансом не числится.
  await expect(page.locator('tr').filter({ hasText: 'Аренда зала' }), 'строка организации попала в авансы').toHaveCount(0);
  await shot(page, '01-advances', 'Авансы стола кассира: кому выдан аванс, по какой записке, сумма, сколько потрачено, состояние и дата выдачи.');

  await page.locator('button.tab').filter({ hasText: 'Отчёт принят' }).first().click();
  await page.waitForTimeout(1500);
  await expect(page.locator('tr').filter({ hasText: 'Закупка воды и бумаги' }), 'аванс без отчёта попал в «Отчёт принят»').toHaveCount(0, { timeout: 15000 });
  await shot(page, '02-reported', 'Отбор по состоянию: во вкладке «Отчёт принят» — авансы с принятым отчётом.');

  await page.locator('button.tab').filter({ hasText: 'Ждёт отчёта' }).first().click();
  await page.waitForTimeout(1500);
  await page.locator('tr').filter({ hasText: 'Закупка воды и бумаги' }).first().click();
  await page.waitForSelector('text=Строки расходов', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-proposal', 'Строка аванса открывает служебную записку.');
};
