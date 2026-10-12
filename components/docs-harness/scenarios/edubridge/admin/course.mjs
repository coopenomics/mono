// Сценарий: страница курса на столе администратора — группы, экономика,
// публикация и действия.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.admin',
  title: 'Страница курса',
  docPath: 'new/edubridge/admin/course.md',
  assetsDir: 'assets/new/edubridge/admin/course',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('courses'), EDU.COURSE_TITLE);
  await page.locator(`text=${EDU.COURSE_TITLE}`).first().click();
  await page.waitForSelector('text=Группы', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, '01-course', 'Страница курса: условия, преподаватели, экономика — оплата занятий по плановой ставке и целевой членский взнос во взносе одного обучающегося.');
  await page.locator('text=Группы').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, '02-groups', 'Группы курса: обучающиеся, проведённые занятия, резерв выплат и выплаченное преподавателям. Условия группы закреплены на день её открытия.');
};
