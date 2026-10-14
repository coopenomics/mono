// Сценарий: календарь преподавателя. Занятия ставятся в календарь окнами
// расписания курса; плитка открывает занятие, у прошедшего — отчёт. Отчёты,
// документы на подпись и журнал — на странице «Отчёты» (сценарий reports).

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Календарь',
  docPath: 'new/edubridge/teacher/lessons.md',
  assetsDir: 'assets/new/edubridge/teacher/lessons',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('lessons'), 'Календарь занятий');
  await page.waitForTimeout(1200);
  await shot(page, '01-calendar', 'Календарь преподавателя: занятия по месяцам, цвет плитки — состояние: запланировано, проведено, отчёт просрочен, отменено. Занятия ставит в календарь администратор окнами расписания курса.');

  const chip = page.locator('.edu-cal__chip').first();
  await expect(chip, 'в календаре нет ни одного занятия: окна расписания курса не построили календарь').toBeVisible({ timeout: 20000 });
  await chip.click();
  await page.waitForTimeout(1500);
  await shot(page, '02-lesson', 'Занятие из календаря: курс, группа, время, длительность и обучающиеся с оплаченным доступом. Отчёт открывается после конца занятия — до него панель говорит, с какого момента.');
};
