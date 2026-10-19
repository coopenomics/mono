// Сценарий: состояние робота для председателя — что члены совета доверили
// роботу, ключи и застрявшие решения.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'robot.admin',
  title: 'Состояние робота',
  docPath: 'new/robot/admin/state.md',
  assetsDir: 'assets/new/robot/admin/state',
  role: 'chairman',
  prepare: ['robot:01-activity'],
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/robot/admin`, 'Что члены совета доверили роботу');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-state', 'Состояние робота: по каждому члену совета — что доверено роботу, состояние ключа и когда ключ передан. Ниже застрявшие решения с кнопкой повтора.');
};
