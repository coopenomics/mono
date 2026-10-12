// Сценарий: карточка курса — описание, программа, преподаватель, доступ.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, scrollDown } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.catalog',
  title: 'Карточка курса',
  docPath: 'new/edubridge/member/course.md',
  assetsDir: 'assets/new/edubridge/member/course',
  role: 'user',
  fixtures: ['gromova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.PARENT));
  await settleAfterLogin(page);
  await openPage(page, EDU.member('catalog'), EDU.COURSE_TITLE);
  await page.locator(`text=${EDU.COURSE_TITLE}`).first().click();
  await page.waitForSelector('text=О курсе', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, '01-course', 'Карточка курса: взнос в месяц, начало занятий и длительность программы, описание, учебная программа и преподаватель. Кнопка «Получить доступ» ведёт к оформлению подписки.');
  await scrollDown(page, 1500);
  await shot(page, '02-syllabus', 'Учебная программа курса и преподаватель, который его ведёт.');
};
