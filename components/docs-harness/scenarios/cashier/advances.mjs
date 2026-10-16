// Сценарий: пайщик Иван Петров открывает «Авансы» на столе пайщика — там
// служебная записка, по строке которой он получает аванс под отчёт.

import { env, loginAs } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin, loadFixture } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'cashier.desk',
  title: 'Авансы пайщика',
  docPath: 'new/cashier/advances.md',
  assetsDir: 'assets/new/cashier/advances',
  role: 'member',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('ivanpetrov'));
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/user/advances`, null);
  await page.waitForTimeout(1500);
  const row = page.locator('tr').filter({ hasText: 'Закупка воды и бумаги' }).first();
  await expect(row, 'в авансах пайщика нет записки: фаза expenses:01-proposal').toBeVisible({ timeout: 30000 });
  await expect(row, 'в строке аванса не та сумма').toContainText('1 500,00');
  // Строка оплаты счёта организации в той же записке авансом пайщика не числится.
  await expect(page.locator('tr').filter({ hasText: 'Аренда зала' }), 'строка организации попала в авансы').toHaveCount(0);
  await shot(page, '01-advances', 'Авансы пайщика: служебные записки, по строкам которых он получает аванс под отчёт, с суммой аванса и состоянием записки.');

  await row.click();
  await page.waitForSelector('text=Строки расходов', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '02-proposal', 'Строка открывает служебную записку. Отчёт по авансу пайщик подаёт в разделе «Платежи».');
};
