// Сценарий: выплата преподавателю состоялась — выписка расчётов и платёж в
// личном реестре. Возврат подан в сценарии settlement, совет решил (фаза 07),
// кассир подтвердил платёж (сценарий admin/payments).

import { env, loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Расчёты: выплата',
  docPath: 'new/edubridge/teacher/settlement.md',
  assetsDir: 'assets/new/edubridge/teacher/settlement',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('settlement'), 'Паевой взнос по программе');
  await expect(row(page, 'Выплачено'), 'возврат не стал «Выплачено»: кассир не подтвердил платёж').toBeVisible({ timeout: 120000 });
  await page.waitForTimeout(800);
  await shot(page, '04-paid', 'Выплата состоялась: возврат в выписке — «Выплачено», паевой взнос по программе обнулён. Зачисление по принятому результату остаётся в истории.');

  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/user/payments`, 'Платеж');
  await page.waitForTimeout(1500);
  await shot(page, '05-my-payments', 'Платежи пайщика: выплата из кооператива на реквизиты преподавателя с суммой, состоянием и назначением.');
};
