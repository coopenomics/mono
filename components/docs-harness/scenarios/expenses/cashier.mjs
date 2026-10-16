// Сценарий: кассир выплачивает строки служебной записки после решения совета
// (фаза expenses:02-council) в реестре платежей стола кассира: оплачивает счёт
// организации и прикладывает чек, выдаёт аванс пайщику. Отчёт по авансу
// пайщик сдаёт сам (сценарий advances), кассир может отчитаться за него.

import path from 'node:path';
import { env, loginAsChairman, HARNESS_ROOT } from '../../lib/harness.mjs';
import { runPrepare } from '../../lib/prepare.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'expenses.cashier',
  title: 'Выплаты по записке',
  docPath: 'new/expenses/cashier.md',
  assetsDir: 'assets/new/expenses/cashier',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

const PAYMENTS = () => `${env.APP_PREFIX}/${env.COOPNAME}/cashier/payments`;
const PROOF = path.join(HARNESS_ROOT, 'fixtures', 'sok.jpg');

function pendingRow(page, text) {
  return page.locator('tr.data-row').filter({ hasText: text }).filter({ has: page.locator('button:has-text("Подтвердить")') }).first();
}

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
  const org = pendingRow(page, '6 000,00');
  await expect(org, 'в реестре платежей нет платежа по записке: фаза expenses:02-council').toBeVisible({ timeout: 30000 });
  await shot(page, '02-payments', 'Реестр платежей: по каждой строке утверждённой записки заведён исходящий платёж. Оплата счёта идёт организации по реквизитам, аванс — пайщику на его способ получения.');
  await org.click();
  await page.waitForTimeout(1200);
  await shot(page, '03-org-payment', 'Платёж организации: получатель, реквизиты, назначение и сумма из служебной записки.');
  await confirmPayment(page, org);

  const proofInput = page.locator('tr.expand-row input[type="file"]');
  if (await proofInput.count()) {
    await proofInput.first().setInputFiles(PROOF);
    await page.waitForTimeout(3000);
    await shot(page, '04-org-proof', 'Счёт оплачен: кассир прикладывает платёжное поручение и закрывающие документы организации — акт, накладную или чек. Отчёт по такой строке сдаёт сам кассир.');
  }

  const advance = pendingRow(page, '1 500,00');
  await expect(advance, 'нет платежа аванса пайщику').toBeVisible({ timeout: 30000 });
  await advance.click();
  await page.waitForTimeout(1000);
  await shot(page, '05-advance-payment', 'Платёж аванса под отчёт: деньги уходят пайщику, он отвечает за них отчётом.');
  await confirmPayment(page, advance);
  await page.waitForTimeout(1500);
  await shot(page, '07-report', 'Аванс выплачен. В раскрытой строке шаг «Отчёт пайщика»: если пайщик принёс чеки лично, кассир указывает потраченную сумму, прикладывает чек и отчитывается за него. Обычно пайщик отчитывается сам в своих платежах.');
};
