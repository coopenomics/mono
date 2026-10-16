// Сценарий: председатель открывает стол кассира. Утверждённая советом
// служебная записка (фаза expenses:02-council) стоит на кассе во вкладке
// «К оплате», строка открывает записку.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { runPrepare } from '../../lib/prepare.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'cashier.desk',
  title: 'Касса',
  docPath: 'new/cashier/desk.md',
  assetsDir: 'assets/new/cashier/desk',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

export default async ({ page, context, shot, expect }) => {
  runPrepare(['expenses:02-council'], { log: (m) => console.log(`    ${m}`) });

  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/cashier/desk`, 'К оплате');
  await page.waitForTimeout(1500);
  const row = page.locator('tr').filter({ hasText: 'Аренда зала' }).first();
  await expect(row, 'на кассе нет утверждённой записки: фаза expenses:02-council').toBeVisible({ timeout: 30000 });
  await shot(page, '01-desk', 'Касса стола кассира: служебные записки по этапам выплаты. Во вкладке «К оплате» стоят записки после решения совета.');

  await page.locator('text=Закрытые').first().click();
  await page.waitForTimeout(800);
  await expect(page.locator('text=Закрытых записок нет').first(), 'вкладка «Закрытые» не переключилась').toBeVisible({ timeout: 15000 });
  await page.locator('text=К оплате').first().click();
  await page.waitForTimeout(800);

  await page.locator('tr').filter({ hasText: 'Аренда зала' }).first().click();
  await page.waitForSelector('text=Строки расходов', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '02-proposal', 'Строка кассы открывает служебную записку: строки расходов, получатели и суммы.');
};
