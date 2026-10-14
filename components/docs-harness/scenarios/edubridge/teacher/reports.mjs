// Сценарий: отчёты преподавателя — журнал занятий, отчёты без подачи,
// документы на подпись. Занятие № 1 отчитано фазой 05-lessons.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Отчёты',
  docPath: 'new/edubridge/teacher/reports.md',
  assetsDir: 'assets/new/edubridge/teacher/reports',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('reports'), 'Отчёты');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-reports', 'Отчёты преподавателя: занятия с отчётом и без, состояние взноса и действие по строке — отчитаться, передать материалы на хранение, подписать акт.');

  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow, 'журнал пуст: занятие № 1 из фазы 05-lessons не отчитано').toBeVisible({ timeout: 20000 });
  await firstRow.click();
  await page.waitForTimeout(1500);
  await shot(page, '02-details', 'Занятие целиком: курс, номер, дата, длительность, обучающиеся с оплаченным доступом, взнос и его состояние, материалы.');
};
