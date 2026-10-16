// Сценарий: председатель открывает «Расходы» стола кассира после выдачи аванса
// (сценарий cashier/payments): записка, по которой аванс выдан, а счёт ещё не
// оплачен, стоит во вкладке «Ждут отчёта»; вкладки переключаются, строка
// открывает записку.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'cashier.desk',
  title: 'Расходы',
  docPath: 'new/cashier/expenses.md',
  assetsDir: 'assets/new/cashier/expenses',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

const tab = (page, label) => page.locator('button.tab').filter({ hasText: label }).first();
const proposalRow = (page) => page.locator('tr').filter({ hasText: 'Аренда зала' }).first();

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/cashier/expenses`, 'К оплате');
  await page.waitForTimeout(1500);
  await shot(page, '01-to-pay', 'Расходы стола кассира: служебные записки по этапам выплаты. Во вкладке «К оплате» — записки после решения совета.');

  await tab(page, 'Ждут отчёта').click();
  await page.waitForTimeout(1200);
  await expect(proposalRow(page), 'записки с выданным авансом нет во вкладке «Ждут отчёта»: сценарий cashier/payments').toBeVisible({ timeout: 30000 });
  await shot(page, '02-awaiting-report', 'Аванс по записке выдан, отчёта ещё нет — записка во вкладке «Ждут отчёта».');

  await tab(page, 'Закрытые').click();
  await page.waitForTimeout(800);
  await expect(page.locator('text=Закрытых записок нет').first(), 'вкладка «Закрытые» не переключилась').toBeVisible({ timeout: 15000 });

  await tab(page, 'Ждут отчёта').click();
  await page.waitForTimeout(800);
  await proposalRow(page).click();
  await page.waitForSelector('text=Строки расходов', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-proposal', 'Строка открывает служебную записку: строки расходов, получатели и суммы.');
};
