// Сценарий: журнал робота — каждое решение, которым занимался робот: этап,
// голоса, транзакции, ошибки. Решения о выходе пайщика даёт фаза robot:01-activity.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'robot.journal',
  title: 'Журнал робота',
  docPath: 'new/robot/admin/journal.md',
  assetsDir: 'assets/new/robot/admin/journal',
  role: 'chairman',
  prepare: ['robot:01-activity'],
};

export default async ({ page, context, shot, env, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/robot/journal`, 'Решение');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.locator('text=Исполнено').first(), 'в журнале нет исполненных решений').toBeVisible({ timeout: 30000 });
  await shot(page, '01-journal', 'Журнал робота: решение, этап, голоса робота, транзакции и ошибка. Этап «Исполнено» означает, что робот подал голоса, подписал протокол и исполнил решение.');
};
