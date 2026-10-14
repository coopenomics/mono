// Сценарий: календарь школы на столе администратора — занятия всех курсов,
// отбор по преподавателю и курсу, перенос и отмена запланированного занятия.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, pick } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.admin',
  title: 'Календарь школы',
  docPath: 'new/edubridge/admin/calendar.md',
  assetsDir: 'assets/new/edubridge/admin/calendar',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('calendar'), 'Преподаватель');
  await page.waitForTimeout(1500);
  await shot(page, '01-calendar', 'Календарь школы: занятия всех курсов кооператива по месяцам. Сверху отбор по преподавателю и курсу и сводка — запланировано, проведено, просрочено.');

  await pick(page, 'Курс', EDU.COURSE_TITLE).catch(() => {});
  await page.waitForTimeout(1200);
  const chip = page.locator('.edu-cal__chip').first();
  await expect(chip, 'в календаре школы нет занятий').toBeVisible({ timeout: 20000 });
  await chip.click();
  await page.waitForTimeout(1500);
  await shot(page, '02-lesson', 'Занятие из календаря школы: курс, группа, преподаватель, время и обучающиеся. Запланированное занятие администратор переносит или отменяет кнопками внизу панели.');
};
