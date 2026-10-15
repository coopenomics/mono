// Сценарий: участки кооператива глазами председателя кооператива — реестр
// участков и карточка участка с председателем, адресом, доверенными лицами.
// Участки krg/odn/myt заводит засев Стола заказов (фаза marketplace:02-branches).

import { loginAsChairman } from '../../../lib/harness.mjs';
import { openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';
import { KU } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.branches',
  title: 'Участки',
  docPath: 'new/ku/admin/branches.md',
  assetsDir: 'assets/new/ku/admin/branches',
  role: 'chairman',
  fixtures: ['chairkrg', 'chairodn', 'chairmyt', 'trustedkrg'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, KU.page('branches'), 'Участок');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await expect(page.locator('tbody tr').first(), 'реестр участков пуст: фаза marketplace:02-branches не завела участки').toBeVisible({ timeout: 30000 });
  await shot(page, '01-branches', 'Участки кооператива: наименование, председатель, число пайщиков и доверенных лиц. Сверху — система управления: при трёх и более участках общие собрания идут через участки.');

  await row(page, 'Красногорск').click();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '02-branch', 'Карточка участка: председатель, адрес и телефон, доверенные лица и пайщики участка.');
};
