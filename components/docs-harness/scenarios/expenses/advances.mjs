// Сценарий: «Мои авансы» — служебные записки, где пайщик получатель аванса.
// Входит пайщик Иван Петров после того, как касса выдала ему аванс.

import { env, loginAs } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin, loadFixture } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'expenses.advances',
  title: 'Мои авансы',
  docPath: 'new/expenses/advances.md',
  assetsDir: 'assets/new/expenses/advances',
  role: 'member',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture('ivanpetrov'));
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/expenses/my/advances`, null);
  await page.waitForTimeout(2000);
  await shot(page, '01-my-advances', 'Мои авансы: служебные записки, по которым пайщик получил аванс под отчёт, с суммой и состоянием.');
  const row = page.locator('tbody tr, .q-item').filter({ hasText: /Аренда зала|Закупка воды|Подготовка/ }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(2000);
    await shot(page, '02-advance', 'Записка глазами получателя аванса: его строка, сумма аванса и отчёт с чеками.');
  }
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/user/payments`, null);
  await page.waitForTimeout(2000);
  await shot(page, '03-my-payments', 'Платежи пайщика: аванс по служебной записке среди его платежей. Здесь пайщик сам отчитывается чеком по своей строке.');
};
