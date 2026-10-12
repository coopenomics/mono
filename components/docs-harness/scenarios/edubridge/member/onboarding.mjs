// Сценарий: подключение ученика к столу — оферта ученика ЦПП «Образование».
// Пайщик свежий из пула: подпись не отменяется, стол после неё открыт.

import { loginAs } from '../../../lib/harness.mjs';
import { freshEduFixture } from '../../../lib/fixtures.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, signGateStep } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.onboarding',
  title: 'Подключение ученика',
  docPath: 'new/edubridge/member/onboarding.md',
  assetsDir: 'assets/new/edubridge/member/onboarding',
  role: 'user',
  prepare: ['edubridge:01-install', 'edubridge:02-course'],
};

export default async ({ page, shot }) => {
  const username = freshEduFixture('parent', { log: (m) => console.log(`  ${m}`) });
  await loginAs(page, loadFixture(username));
  await settleAfterLogin(page);

  await openPage(page, EDU.member('onboarding'), 'оферту ученика');
  await page.locator('.q-checkbox').last().waitFor({ state: 'visible', timeout: 60000 });
  await shot(page, '01-offer', 'Чтобы записываться на курсы, пайщик подписывает оферту ученика по ЦПП «Образование». Документ читается целиком на странице, затем галочка согласия и кнопка подписи.');
  await signGateStep(page, 'Подписать');

  await openPage(page, EDU.member('catalog'), 'Каталог');
  await shot(page, '02-after', 'После подписи стол ученика открыт: каталог, обучающиеся и подписки. Оферта подписывается один раз.');
};
