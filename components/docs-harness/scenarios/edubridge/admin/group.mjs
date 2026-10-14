// Сценарий: страница группы курса — условия группы и её календарь занятий.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.admin',
  title: 'Группа курса',
  docPath: 'new/edubridge/admin/group.md',
  assetsDir: 'assets/new/edubridge/admin/group',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('courses'), EDU.COURSE_TITLE);
  await page.locator(`text=${EDU.COURSE_TITLE}`).first().click();
  await page.waitForSelector('text=Группы', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Строка группы открывает боковую панель с условиями группы и её
  // расписанием; отдельная страница — по «Открыть страницу».
  await row(page, 'Группа').click();
  await page.waitForTimeout(1500);
  await shot(page, '00-group-panel', 'Панель группы на странице курса: состояние набора, взнос, стоимость часа, обучающиеся и проведённые занятия, расчёт группы в месяц и окна расписания группы.');
  await page.locator('button:has-text("Открыть страницу"), a:has-text("Открыть страницу")').first().click();
  await page.waitForURL(/\/groups\//, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-group', 'Страница группы: дата начала, обучающиеся, проведённые занятия и календарь занятий группы. Условия группы закреплены на день её открытия.');

  const chip = page.locator('.edu-cal__chip').first();
  await expect(chip, 'в календаре группы нет занятий').toBeVisible({ timeout: 20000 });
  await chip.click();
  await page.waitForTimeout(1500);
  await shot(page, '02-lesson', 'Занятие группы: время, длительность, преподаватель, обучающиеся с оплаченным доступом и состояние отчёта.');
};
