// Сценарий: реестр расходов на столе совета и служебная записка — подана
// членом совета (фаза expenses:01-proposal), ждёт решения совета.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'expenses.registry',
  title: 'Реестр расходов',
  docPath: 'new/expenses/registry.md',
  assetsDir: 'assets/new/expenses/registry',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/soviet/expenses`, null);
  await page.waitForTimeout(1500);
  const item = page.locator('text=Аренда зала').first();
  await expect(item, 'в реестре нет служебной записки: фаза expenses:01-proposal').toBeVisible({ timeout: 30000 });
  await shot(page, '01-registry', 'Реестр расходов на столе совета: служебные записки с автором, кошельком-источником, суммой и состоянием.');
  await item.click();
  await page.waitForSelector('text=Строки расходов', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, '02-proposal', 'Служебная записка до решения совета: сводка, строки расходов — оплата счёта организации и аванс под отчёт пайщику, заявление члена совета.');
  await page.locator('text=Строки расходов').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, '03-lines', 'Строки записки: получатель, способ — оплата по счёту или аванс под отчёт, сумма по плану и состояние строки.');
};
