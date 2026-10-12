// Сценарий: назначения преподавателя — курсы, к которым он допущен.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Назначения',
  docPath: 'new/edubridge/teacher/assignments.md',
  assetsDir: 'assets/new/edubridge/teacher/assignments',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('assignments'), EDU.COURSE_TITLE);
  await shot(page, '01-assignments', 'Назначения: курс, период ведения и состояние. Строка открывает назначение целиком.');
  await row(page, EDU.COURSE_TITLE).click();
  await page.waitForTimeout(1200);
  await shot(page, '02-details', 'Назначение целиком: расписание, период, ожидаемый результат и учебная программа курса.');
};
