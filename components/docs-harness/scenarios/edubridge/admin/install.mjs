// Сценарий: председатель устанавливает приложение «Образование» из магазина
// приложений. До установки у кооператива нет ни одного стола образования.
//
// Группа L0 сюиты: идёт на девственном стенде, до фаз засева.

import { loginAsChairman, dismissOnboardingDialogs, signOnboardingAgreements } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.onboarding',
  title: 'Установка приложения «Образование»',
  docPath: 'new/edubridge/admin/install.md',
  assetsDir: 'assets/new/edubridge/admin/install',
  role: 'chairman',
};

export default async ({ page, context, shot, env, expect }) => {
  await loginAsChairman(page, context);
  await signOnboardingAgreements(page);
  await settleAfterLogin(page);

  // 1. Страница установки приложения в магазине приложений.
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chairman/extensions/extension/edubridge/install`, null);
  await page.locator('button:has-text("включить")').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await shot(page, '01-install-form', 'Магазин приложений, страница приложения «Образование»: описание, настройки и кнопка «включить». До включения столов образования у кооператива нет.');

  // 2. Включение. После установки интерфейс сам открывает первую доступную
  //    страницу приложения — подключение ЦПП советом.
  const installBtn = page.locator('button:has-text("включить")').first();
  if (await installBtn.count()) {
    await installBtn.click();
    await page.waitForTimeout(8000);
    await dismissOnboardingDialogs(page);
  }

  await openPage(page, EDU.admin('configure'), 'Образование');
  await shot(page, '02-after-install', 'После включения у председателя появился стол администратора образования, открыта страница подключения ЦПП: совет утверждает положение, оферты и договор.', {
    expect: async (p) => {
      await expect(p.locator('text=Положение о ЦПП «Образование»').first()).toBeVisible({ timeout: 30000 });
      await expect(p.locator('text=Недостаточно прав доступа')).toHaveCount(0);
    },
  });
};
