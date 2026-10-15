// Сценарий: страница приложения «Робот совета» в каталоге приложений.
// На стенде робот установлен предустановкой boot, страница показывает его
// включённым.

import { loginAsChairman, signOnboardingAgreements } from '../../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'robot.install',
  title: 'Установка приложения «Робот совета»',
  docPath: 'new/robot/admin/install.md',
  assetsDir: 'assets/new/robot/admin/install',
  role: 'chairman',
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await signOnboardingAgreements(page);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chairman/extensions/extension/robot/install`, null);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, '01-install-form', 'Каталог приложений, страница приложения «Робот совета»: описание и состояние. Приложение ставит председатель, стол робота видят члены совета.');
};
