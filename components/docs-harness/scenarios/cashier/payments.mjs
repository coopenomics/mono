// Сценарий: реестр платежей на столе кассира. По утверждённой записке заведены
// исходящие платежи; на этом столе кассир подтверждает оплату. Сценарий только
// смотрит: оплату проводит сюита «Расходы» (expenses/cashier).

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

export default async ({ page, context, shot, expect }) => {
  runPrepare(['expenses:02-council'], { log: (m) => console.log(`    ${m}`) });

  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/cashier/payments`, 'Платеж');
  await page.waitForTimeout(1500);
  const row = page.locator('tr.data-row').filter({ hasText: '6 000,00' }).first();
  await expect(row, 'в реестре платежей стола кассира нет платежа по записке').toBeVisible({ timeout: 30000 });
  // Кнопка подтверждения есть: право подтверждать оплату стол кассира берёт у себя, а не у стола совета.
  await expect(row.locator('button:has-text("Подтвердить")').first(), 'на столе кассира нет подтверждения оплаты').toBeVisible({ timeout: 15000 });
  await shot(page, '01-payments', 'Реестр платежей стола кассира: по каждой строке утверждённой записки заведён исходящий платёж, кассир подтверждает оплату.');
};
