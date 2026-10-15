// Сценарий: подключение преподавателя к столу — рассказ о себе, оферта
// преподавателя, договор участия в хозяйственной деятельности. Пайщик берётся
// свежий из пула: подпись оферты не отменяется, стол после неё открыт.

import { loginAs } from '../../../lib/harness.mjs';
import { freshEduFixture } from '../../../lib/fixtures.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, fill, signGateStep } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Подключение преподавателя',
  docPath: 'new/edubridge/teacher/onboarding.md',
  assetsDir: 'assets/new/edubridge/teacher/onboarding',
  role: 'user',
  prepare: ['edubridge:01-install'],
};

export default async ({ page, shot }) => {
  const username = freshEduFixture('teacher', { log: (m) => console.log(`  ${m}`) });
  await loginAs(page, loadFixture(username));
  await settleAfterLogin(page);

  await openPage(page, EDU.teacher('onboarding'), 'О себе');
  await shot(page, '01-gate', 'Стол преподавателя открывается подключением: три шага — рассказ о себе, оферта преподавателя, договор участия в хозяйственной деятельности.');

  await fill(page, 'О себе', 'Преподаю физику и математику, 9 лет в школе, готовлю к ОГЭ и олимпиадам.', 'textarea');
  await page.locator('button:has-text("Сохранить и продолжить")').first().click();
  await page.waitForTimeout(1500);

  await page.locator('.q-checkbox').last().waitFor({ state: 'visible', timeout: 60000 });
  await shot(page, '02-offer', 'Оферта преподавателя: документ читается целиком на странице, затем галочка согласия и кнопка «Подписать и продолжить». Подписывается прочитанный экземпляр.');
  await signGateStep(page, 'Подписать');

  await page.locator('.q-checkbox').last().waitFor({ state: 'visible', timeout: 60000 });
  await shot(page, '03-contract', 'Договор участия в хозяйственной деятельности: подписывают преподаватель и председатель совета. Заключается один раз; к курсам преподавателя допускает администратор.');
  await signGateStep(page, 'Подписать');

  await openPage(page, EDU.teacher('profile'), 'Договор участия');
  await shot(page, '04-profile-pending', 'После подписи договор ожидает подписи председателя совета. Назначения на курсы начнут действовать после его подписания.');
};
