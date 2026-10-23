// Сценарий: кооператив подключает ЦПП «Образование». Совет утверждает четыре
// документа: положение о программе, оферту ученика, оферту преподавателя и
// договор участия в хозяйственной деятельности.
//
// Группа L0 сюиты: ЦПП ещё не принята, процесс снимается живым. Вопросы
// председатель объявляет кликами; голоса совета, протоколы и утверждение форм
// доводит фаза 01-install — она подхватывает уже опубликованные решения.

import { loginAsChairman, dismissOnboardingDialogs, signOnboardingAgreements } from '../../../lib/harness.mjs';
import { runSeedPhase } from '../../../lib/fixtures.mjs';
import { EDU, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.onboarding',
  title: 'Подключение ЦПП «Образование» кооперативом',
  docPath: 'new/edubridge/admin/configure.md',
  assetsDir: 'assets/new/edubridge/admin/configure',
  role: 'chairman',
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await signOnboardingAgreements(page);
  await settleAfterLogin(page);

  await openPage(page, EDU.admin('configure'), 'Положение о ЦПП «Образование»');
  await shot(page, '01-steps', 'Подключение ЦПП «Образование»: четыре вопроса совету — положение о программе, оферта ученика, оферта преподавателя, договор участия в хозяйственной деятельности. Пока совет их не утвердил, столы ученика и преподавателя закрыты.');

  const announce = page.locator('button:has-text("Объявить все"), button:has-text("Объявить вопрос")').first();
  const pending = await announce.isVisible().catch(() => false);
  if (pending) {
    await announce.click();
    await page.waitForSelector('text=Объявить вопросы в совет?', { timeout: 15000 });
    await page.waitForTimeout(600);
    await shot(page, '02-announce-confirm', 'Подтверждение объявления: проекты решений по вопросам направляются в совет по порядку, совет рассмотрит их на заседании.');
    await page.locator('.q-dialog button:has-text("Объявить")').last().click();
    await page.waitForTimeout(2500);
    await signOnboardingAgreements(page);
    await page.locator('text=В совете').first().waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(800);
    await dismissOnboardingDialogs(page);
    await shot(page, '03-in-council', 'Вопросы объявлены: у каждого метка «В совете». Члены совета голосуют на своём столе, председатель подписывает протокол — документ считается утверждённым.');

    // Голоса совета, протоколы, утверждение форм документов — фаза засева.
    runSeedPhase('01-install', { group: 'edubridge', log: (m) => console.log(`[configure] ${m}`) });
  }

  // После утверждения страница подключения закрывается (маршрут с gate), а у
  // председателя открываются рабочие страницы стола администратора.
  await openPage(page, EDU.admin('courses'), 'Курсы');
  await shot(page, '04-connected', 'ЦПП «Образование» подключена: совет утвердил положение, шаблоны оферт и договора. Страница подключения закрылась, у председателя открылся стол администратора — первым делом курсы.', {
    expect: async (p) => {
      await expect(p.locator('text=Курсов пока нет').or(p.locator('text=Курсы')).first()).toBeVisible({ timeout: 60000 });
      await expect(p.locator('text=Недостаточно прав доступа')).toHaveCount(0);
    },
  });
};
