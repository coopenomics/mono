// Сценарий: профиль преподавателя — договор, ставка, курсы, рассказ о себе.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, closeDialog } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Профиль преподавателя',
  docPath: 'new/edubridge/teacher/profile.md',
  assetsDir: 'assets/new/edubridge/teacher/profile',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('profile'), 'Договор участия');
  await shot(page, '01-profile', 'Профиль преподавателя: договор участия с номером и датами подписей, ставка за час, курсы, которые преподаватель ведёт, и рассказ о себе.');

  const edit = page.locator('button:has-text("Изменить"), button:has-text("Рассказать о себе")').first();
  if (await edit.isVisible().catch(() => false)) {
    await edit.click();
    await page.waitForSelector('.q-dialog textarea', { timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, '02-about', 'Рассказ о себе правится в окне: предметы, опыт, образование. Его видят администратор и ученики на карточке курса.');
    await closeDialog(page);
  }
};
