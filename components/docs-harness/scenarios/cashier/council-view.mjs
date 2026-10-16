// Сценарий: член совета Пётр открывает стол кассира. Совет кассу читает,
// правят её председатель и кассир: реестр платежей, расходы и авансы видны,
// кнопок подтверждения оплаты, загрузки документов и отчёта за пайщика нет.

import { env, loginAs } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'cashier.desk',
  title: 'Стол кассира глазами совета',
  docPath: 'new/cashier/council-view.md',
  assetsDir: 'assets/new/cashier/council-view',
  role: 'member',
  fixtures: ['ivanpetrov'],
  prepare: ['expenses:01-proposal'],
};

// Член совета расширенного совета стенда (boot:extra) — ключ тот же, что у председателя.
const COUNCIL = () => ({ username: 'petr', email: 'sidorov@example.com', wif: env.CHAIRMAN_WIF });

export default async ({ page, shot, expect }) => {
  await loginAs(page, COUNCIL());
  await settleAfterLogin(page);

  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/cashier/expenses`, 'К оплате');
  await page.waitForTimeout(1500);
  await shot(page, '01-expenses', 'Член совета читает расходы стола кассира.');

  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/cashier/advances`, 'Ждёт отчёта');
  await page.waitForTimeout(1500);
  await expect(page.locator('tr').filter({ hasText: 'Закупка воды и бумаги' }).first(), 'член совета не видит авансов').toBeVisible({ timeout: 30000 });
  await shot(page, '02-advances', 'Авансы кооператива — на чтение.');

  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/cashier/payments`, 'Платеж');
  await page.waitForTimeout(1500);
  const advance = page.locator('tr.data-row').filter({ hasText: '1 500,00' }).first();
  await expect(advance, 'член совета не видит реестр платежей стола кассира').toBeVisible({ timeout: 30000 });
  await expect(page.locator('tr.data-row button:has-text("Подтвердить")'), 'у члена совета есть подтверждение оплаты').toHaveCount(0);
  await advance.click();
  await page.waitForTimeout(1500);
  const details = page.locator('tr.expand-row').first();
  await expect(details.locator('input[type="file"]'), 'у члена совета есть загрузка документов').toHaveCount(0);
  await expect(details.locator('button:has-text("за пайщика")'), 'у члена совета есть отчёт за пайщика').toHaveCount(0);
  await shot(page, '03-payments', 'Реестр платежей стола кассира у члена совета: платежи и документы видны, подтверждения, загрузки и отчёта за пайщика нет.');
};
