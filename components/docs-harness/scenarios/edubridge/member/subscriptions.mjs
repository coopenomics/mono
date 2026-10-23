// Сценарий: подписки ученика — оплаченный срок, продление, гарантия.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, row, closeDialog } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.enrollment',
  title: 'Мои подписки',
  docPath: 'new/edubridge/member/subscriptions.md',
  assetsDir: 'assets/new/edubridge/member/subscriptions',
  role: 'user',
  fixtures: ['gromova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.PARENT));
  await settleAfterLogin(page);
  await openPage(page, EDU.member('subscriptions'), EDU.COURSE_TITLE);
  await shot(page, '01-subscriptions', 'Подписки: курс, обучающийся, до какого дня оплачено, состояние доступа. Кнопка «Продлить» вносит взнос за следующий месяц.');

  await row(page, EDU.COURSE_TITLE).click();
  await page.waitForTimeout(1200);
  await shot(page, '02-details', 'Подписка целиком: обучающийся, расписание, внесённый взнос, гарантийный срок и заявление по гарантии, возврат при отмене.');

  await closeDialog(page); // панель подписки закрыта — кнопка в таблице доступна
  const extend = page.locator('button:has-text("Продлить")').first();
  if (await extend.isVisible().catch(() => false)) {
    await extend.click();
    await page.waitForSelector('text=Будет продлено до, text=Будет оплачено до', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, '03-extend', 'Продление: взнос за следующий месяц идёт в ту же группу, расчёт показывает новую дату оплаченного срока.');
    await closeDialog(page);
  }
};
