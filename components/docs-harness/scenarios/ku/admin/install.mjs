// Сценарий: председатель включает приложение «Кооперативный участок» из
// каталога приложений. Группа L0: до фаз засева, на девственном стенде.

import { loginAsChairman, dismissOnboardingDialogs, signOnboardingAgreements } from '../../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../../lib/edu.mjs';
import { KU } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.install',
  title: 'Установка приложения «Кооперативный участок»',
  docPath: 'new/ku/admin/install.md',
  assetsDir: 'assets/new/ku/admin/install',
  role: 'chairman',
};

export default async ({ page, context, shot, env, expect }) => {
  await loginAsChairman(page, context);
  await signOnboardingAgreements(page);
  await settleAfterLogin(page);

  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chairman/extensions/extension/trustee/install`, null);
  await page.locator('button:has-text("включить")').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await shot(page, '01-install-form', 'Каталог приложений, страница приложения «Кооперативный участок»: описание и кнопка «включить».');

  const installBtn = page.locator('button:has-text("включить")').first();
  if (await installBtn.count()) {
    await installBtn.click();
    await page.waitForTimeout(8000);
    await dismissOnboardingDialogs(page);
  }

  await openPage(page, KU.page('branches'), 'Участки');
  await shot(page, '02-after-install', 'После включения у председателя появился стол «Кооперативный участок»: участки, собрания, мой участок.', {
    expect: async (p) => {
      await expect(p.locator('text=Недостаточно прав доступа')).toHaveCount(0);
    },
  });
};
