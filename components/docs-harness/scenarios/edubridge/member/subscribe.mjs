// Сценарий: оформление подписки — «Получить доступ» на карточке курса.
// Артём записан фазой 04-member; здесь ученик записывает второго обучающегося.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, pick } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.enrollment',
  title: 'Получение доступа к курсу',
  docPath: 'new/edubridge/member/subscribe.md',
  assetsDir: 'assets/new/edubridge/member/subscribe',
  role: 'user',
  fixtures: ['gromova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.PARENT));
  await settleAfterLogin(page);

  // Второго обучающегося заводит сценарий learners; у Артёма подписка уже есть.
  await openPage(page, EDU.member('learners'), EDU.LEARNER_NAME);
  const vera = page.locator('text=Громова Вера').first();
  const target = (await vera.isVisible().catch(() => false)) ? vera : page.locator(`text=${EDU.LEARNER_NAME}`).first();
  await target.click();
  await page.waitForTimeout(1200);
  await shot(page, '01-learner-card', 'Карточка обучающегося: подписки и кнопка «Записать на курс».');

  await page.locator('button:has-text("Записать на курс")').first().click();
  await page.waitForSelector('text=Кто будет обучаться', { timeout: 20000 });
  await page.waitForTimeout(800);
  const courseSelect = page.locator('label:has-text("Курс")').first();
  const chosen = await courseSelect.locator('input, .q-field__native').first().innerText().catch(() => '');
  if (!chosen.includes('ОГЭ')) await pick(page, 'Курс', EDU.COURSE_TITLE).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '02-dialog', 'Получение доступа: курс, кто будет обучаться, способ взноса — помесячно или разом за весь курс со скидкой, расчёт: сколько зачтётся с кошелька программы, сколько конвертируется с паевого, до какого дня оплачено.');

  const pay = page.locator('.q-dialog button:has-text("Получить доступ")').last();
  if (await pay.isEnabled().catch(() => false)) {
    await pay.click();
    await page.waitForSelector('text=Кто будет обучаться', { state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await openPage(page, EDU.member('subscriptions'), EDU.COURSE_TITLE);
  await shot(page, '03-subscribed', 'Подписка оформлена: членский взнос внесён, доступ выдаётся. Для очного курса занятия идут по расписанию, для курса на площадке доступ уходит на адрес обучающегося.');
};
