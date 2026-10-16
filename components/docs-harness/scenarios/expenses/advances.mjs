// Сценарий: пайщик Иван Петров отчитывается по авансу в своих платежах —
// указывает потраченную сумму и прикладывает чек.

import path from 'node:path';
import { env, loginAs, HARNESS_ROOT } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin, loadFixture } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'expenses.advances',
  title: 'Отчёт по авансу',
  docPath: 'new/expenses/advances.md',
  assetsDir: 'assets/new/expenses/advances',
  role: 'member',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

const PROOF = path.join(HARNESS_ROOT, 'fixtures', 'sok.jpg');

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('ivanpetrov'));
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/user/payments`, null);
  await page.waitForTimeout(2000);
  const row = page.locator('tr.data-row').filter({ hasText: '1 500,00' }).first();
  await expect(row, 'у пайщика нет платежа аванса: сценарий cashier').toBeVisible({ timeout: 30000 });
  await shot(page, '03-my-payments', 'Платежи пайщика: аванс по служебной записке — исходящий платёж кооператива с состоянием «Завершён».');
  await row.click();
  await page.waitForTimeout(1500);
  await shot(page, '04-report-form', 'Раскрытый аванс: потраченная сумма и чек. Сумма меньше аванса заводит платёж возврата разницы, больше — платёж доплаты.');
  const file = page.locator('tr.expand-row input[type="file"]').last();
  await file.setInputFiles(PROOF);
  await page.waitForTimeout(3000);
  const submit = page.locator('button:has-text("Отчитаться по авансу")').first();
  await expect(submit, 'нет кнопки «Отчитаться по авансу»').toBeVisible({ timeout: 15000 });
  await submit.click();
  await page.waitForSelector('text=/Отчёт по авансу принят|Отчёт подан/', { timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, '05-reported', 'Отчёт по авансу подан: чек приложен, строка записки отчитана. Совет закрывает расход.');
};
