// Сценарий: председатель закрывает расход — отчёты по всем строкам поданы;
// закрывают председатель и кассир.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'expenses.close',
  title: 'Закрытие расхода',
  docPath: 'new/expenses/close.md',
  assetsDir: 'assets/new/expenses/close',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/soviet/expenses`, null);
  await page.waitForTimeout(1500);
  await page.locator('text=Аренда зала').first().click();
  await page.waitForSelector('text=Строки расходов', { timeout: 30000 });
  await page.waitForTimeout(2000);
  const close = page.locator('button:has-text("Закрыть расход")').first();
  await expect(close, 'нет кнопки «Закрыть расход»: отчёты по строкам не поданы').toBeVisible({ timeout: 60000 });
  await shot(page, '01-report-submitted', 'Отчёты по всем строкам поданы: состояние записки «Отчёт подан», у председателя и кассира появилась кнопка «Закрыть расход».');
  await close.click();
  await page.waitForSelector('text=Расход закрыт', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, '02-closed', 'Расход закрыт: фактическая сумма учтена в кошельке-источнике, история записки показывает закрытие.');
};
