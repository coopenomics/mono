// Сценарий: расчёты преподавателя — паевой взнос по программе и выписка.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Расчёты',
  docPath: 'new/edubridge/teacher/settlement.md',
  assetsDir: 'assets/new/edubridge/teacher/settlement',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('settlement'), 'Паевой взнос по программе');
  await shot(page, '01-settlement', 'Расчёты: принятые советом взносы зачисляются паевым взносом по программе «Образование». Возврат оформляется одной кнопкой на реквизиты преподавателя, заявление рассматривает совет.');
};
