// Сценарий: оформление подписки — «Получить доступ» на карточке курса.
// Артём записан фазой 04-member; здесь ученик записывает второго обучающегося.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

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

  // У Артёма подписка уже есть (фаза 04-member), второго обучающегося заводит
  // сценарий learners. Карточка курса у ученика с подпиской показывает
  // «Продлить», без подписки — «Получить доступ»; окно за кнопкой одно.
  await openPage(page, EDU.member('catalog'), EDU.COURSE_TITLE);
  await page.locator(`text=${EDU.COURSE_TITLE}`).first().click();
  await page.waitForSelector('text=О курсе', { timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.locator('button:has-text("Получить доступ")').or(page.locator('button:has-text("Продлить")')).first().click();
  await page.waitForSelector('text=Кто будет обучаться', { timeout: 20000 });
  await page.waitForTimeout(1200);

  const vera = page.locator('.q-dialog :text("Громова Вера")').first();
  if (await vera.isVisible().catch(() => false)) await vera.click();
  await page.waitForTimeout(1500);
  await shot(page, '01-dialog', 'Получение доступа: кто будет обучаться, способ взноса — помесячно или разом за весь курс со скидкой, расчёт: сколько зачтётся с кошелька программы, сколько конвертируется с паевого, до какого дня оплачено.');

  const pay = page.locator('.q-dialog button:has-text("Получить доступ")').last();
  if (await pay.isEnabled().catch(() => false)) {
    await pay.click();
    await page.waitForSelector('text=Кто будет обучаться', { state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await openPage(page, EDU.member('subscriptions'), EDU.COURSE_TITLE);
  await shot(page, '02-subscribed', 'Подписка оформлена: членский взнос внесён, доступ выдаётся. Для очного курса занятия идут по расписанию, для курса на площадке доступ уходит на адрес обучающегося.');
};
