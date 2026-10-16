// Сценарий: реестр платежей на столе кассира. По утверждённой записке заведены
// исходящие платежи; кассир подтверждает выдачу аванса пайщику. Повторный
// прогон аванс второй раз не выдаёт: подтверждённый платёж только смотрится.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { runPrepare } from '../../lib/prepare.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'cashier.desk',
  title: 'Реестр платежей кассира',
  docPath: 'new/cashier/payments.md',
  assetsDir: 'assets/new/cashier/payments',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

const PAYMENTS = () => `${env.APP_PREFIX}/${env.COOPNAME}/cashier/payments`;

async function confirmPayment(page, row) {
  await row.locator('button:has-text("Подтвердить")').first().click();
  await page.waitForSelector('text=Подтвердить платеж', { timeout: 15000 });
  await page.locator('.q-dialog button:has-text("Продолжить")').last().click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

export default async ({ page, context, shot, expect }) => {
  runPrepare(['expenses:02-council'], { log: (m) => console.log(`    ${m}`) });

  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, PAYMENTS(), 'Платеж');
  await page.waitForTimeout(1500);
  const org = page.locator('tr.data-row').filter({ hasText: '6 000,00' }).first();
  await expect(org, 'в реестре платежей стола кассира нет платежа по записке').toBeVisible({ timeout: 30000 });
  await shot(page, '01-payments', 'Реестр платежей стола кассира: по каждой строке утверждённой записки заведён исходящий платёж, кассир подтверждает оплату.');

  const advance = page.locator('tr.data-row').filter({ hasText: '1 500,00' }).first();
  await expect(advance, 'нет платежа аванса пайщику').toBeVisible({ timeout: 30000 });
  const confirm = advance.locator('button:has-text("Подтвердить")');
  if (await confirm.count()) {
    // Право подтверждать оплату стол кассира берёт у себя, а не у стола совета.
    await advance.click();
    await page.waitForTimeout(1000);
    await shot(page, '02-advance-payment', 'Платёж аванса под отчёт: кассир переводит деньги пайщику и подтверждает оплату.');
    await confirmPayment(page, advance);
  }
  await expect(page.locator('tr.data-row').filter({ hasText: '1 500,00' }).locator('button:has-text("Подтвердить")'), 'аванс не подтвердился').toHaveCount(0, { timeout: 30000 });
  await shot(page, '03-advance-paid', 'Аванс выдан: платёж подтверждён, пайщик отчитывается по нему в своих платежах.');
};
