// Сценарий: реестр платежей кооператива — кассир подтверждает входящий
// паевой взнос пайщика (фаза soviet:03-payment).

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'soviet.payments',
  title: 'Реестр платежей',
  docPath: 'new/council/payments.md',
  assetsDir: 'assets/new/council/payments',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
  prepare: ['soviet:03-payment'],
};

const SOVIET = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/${p}`;

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, SOVIET('payments'), 'Платеж');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-registry', 'Реестр платежей: пайщик, дата, сумма, тип платежа, направление и состояние. Входящие — взносы пайщиков, исходящие — выплаты по решениям совета.');

  const row = page.locator('tr.data-row').filter({ hasText: 'Петров' }).filter({ has: page.locator('button:has-text("Подтвердить")') }).first();
  await expect(row, 'нет входящего платежа Петрова в ожидании: фаза soviet:03-payment').toBeVisible({ timeout: 30000 });
  await row.click();
  await page.waitForTimeout(1200);
  await shot(page, '02-payment', 'Раскрытый платёж: назначение, реквизиты и сумма. Кнопка «Подтвердить» означает, что деньги пришли на счёт кооператива.');

  await row.locator('button:has-text("Подтвердить")').first().click();
  await page.waitForSelector('text=Подтвердить платеж', { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot(page, '03-confirm', 'Подтверждение платежа кассиром.');
  await page.locator('.q-dialog button:has-text("Продолжить")').last().click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, '04-paid', 'Платёж подтверждён: паевой взнос зачислен на кошелёк пайщика, состояние платежа сменилось.');
};
