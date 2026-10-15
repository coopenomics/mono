// Сценарий: касса — путь служебной записки после решения совета (фаза
// expenses:02-council). Кассир оплачивает счёт организации и прикладывает
// платёжку и закрывающие документы, выдаёт аванс пайщику, отчитывается за
// пайщика чеком; записка закрывается.

import path from 'node:path';
import { env, loginAsChairman, HARNESS_ROOT } from '../../lib/harness.mjs';
import { runPrepare } from '../../lib/prepare.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'expenses.cashier',
  title: 'Касса',
  docPath: 'new/expenses/cashier.md',
  assetsDir: 'assets/new/expenses/cashier',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

const EXP = (p = '') => `${env.APP_PREFIX}/${env.COOPNAME}/expenses${p ? `/${p}` : ''}`;
const PAYMENTS = () => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/payments`;
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
  await openPage(page, EXP('cashier'), 'К оплате');
  await page.waitForTimeout(1500);
  await shot(page, '01-to-pay', 'Касса, вкладка «К оплате»: служебные записки, которые совет утвердил. Кассир открывает записку и выплачивает её строки.');

  await openPage(page, PAYMENTS(), 'Платеж');
  await page.waitForTimeout(1500);
  const first = pendingRow(page, '6 000,00');
  await expect(first, 'в реестре платежей нет платежа по записке: фаза expenses:02-council').toBeVisible({ timeout: 30000 });
  await shot(page, '02-payments', 'Реестр платежей: по каждой строке записки заведён исходящий платёж. Оплата счёта идёт организации по реквизитам, аванс — пайщику на его способ получения.');
  await first.click();
  await page.waitForTimeout(1200);
  await shot(page, '03-org-payment', 'Платёж организации: получатель, реквизиты, назначение и сумма из служебной записки.');
  await confirmPayment(page, first);

  const proofInput = page.locator('tr.expand-row input[type="file"]');
  if (await proofInput.count()) {
    await proofInput.first().setInputFiles(PROOF);
    await page.waitForTimeout(3000);
    await shot(page, '04-org-proof', 'Счёт оплачен: кассир прикладывает платёжное поручение и закрывающие документы организации — акт, накладную или чек. Отчёт по такой строке сдаёт сам кассир.');
  }

  const advance = pendingRow(page, '1 500,00');
  if (await advance.isVisible().catch(() => false)) {
    await advance.click();
    await page.waitForTimeout(1000);
    await shot(page, '05-advance-payment', 'Платёж аванса под отчёт: деньги уходят пайщику, он отвечает за них отчётом.');
    await confirmPayment(page, advance);
  }

  await openPage(page, EXP('cashier'), 'Ждут отчёта');
  await page.locator('text=Ждут отчёта').first().click();
  await page.waitForTimeout(1500);
  await shot(page, '06-awaiting-report', 'Вкладка «Ждут отчёта»: аванс выдан, пайщик ещё не отчитался чеками.');

  // Кассир принимает чеки от пайщика лично и отчитывается за него.
  await openPage(page, PAYMENTS(), 'Платеж');
  await page.waitForTimeout(1500);
  const reportRow = page.locator('tr.data-row').filter({ hasText: '1 500,00' }).first();
  if (await reportRow.isVisible().catch(() => false)) {
    await reportRow.click();
    await page.waitForTimeout(1200);
    const onBehalf = page.locator('button:has-text("Отчитаться за пайщика")').first();
    if (await page.locator('text=Фактически потрачено по чекам').first().isVisible().catch(() => false)) {
      const amount = page.locator('tr.expand-row input').first();
      await amount.fill('1500');
      const file = page.locator('tr.expand-row input[type="file"]').last();
      await file.setInputFiles(PROOF);
      await page.waitForTimeout(2500);
      await shot(page, '07-report', 'Отчёт по авансу: фактически потраченная сумма и чек. Если потрачено меньше, заводится платёж возврата, если больше — платёж доплаты.');
      if (await onBehalf.isVisible().catch(() => false)) {
        await onBehalf.click();
        await page.waitForTimeout(4000);
        await shot(page, '08-reported', 'Отчёт подан: позиция ждёт подтверждения расчёта, затем записка закрывается.');
      }
    }
  }

  await openPage(page, EXP('cashier'), 'Закрытые');
  await page.locator('text=Закрытые').first().click();
  await page.waitForTimeout(1500);
  await shot(page, '09-closed', 'Вкладка «Закрытые»: служебные записки, по которым выплаты сделаны и отчёты приняты.');
};
