// Сценарий: реестр расходов и служебная записка — подана членом совета
// (фаза expenses:01-proposal), ждёт решения совета.

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

const EXP = (p = '') => `${env.APP_PREFIX}/${env.COOPNAME}/expenses${p ? `/${p}` : ''}`;

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EXP(), null);
  await page.waitForTimeout(1500);
  const item = page.locator('text=Подготовка помещения').first();
  await expect(item, 'в реестре нет служебной записки: фаза expenses:01-proposal').toBeVisible({ timeout: 30000 });
  await shot(page, '01-registry', 'Реестр расходов: служебные записки с автором, кошельком-источником, суммой и состоянием.');
  await item.click();
  await page.waitForSelector('text=Строки расходов', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, '02-proposal', 'Служебная записка до решения совета: сводка, строки расходов — оплата счёта организации и аванс под отчёт пайщику, заявление члена совета.');

  await openPage(page, EXP('admin/approve'), null);
  await page.waitForTimeout(1500);
  await shot(page, '03-approve-queue', 'Очередь председателя: поданные служебные записки, которые ждут его подписи.');
};
