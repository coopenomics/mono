// Сценарий: преподаватели на столе администратора — реестр, карточка,
// допуск к курсу, договоры на подписи председателя.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, row, closeDialog } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Преподаватели',
  docPath: 'new/edubridge/admin/teachers.md',
  assetsDir: 'assets/new/edubridge/admin/teachers',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  // Ждём строку таблицы, а не имя: узкая колонка прячет имя многоточием, и текст
  // для браузера «скрыт», хотя строка на месте.
  await openPage(page, EDU.admin('teachers'), 'Преподаватели');
  await row(page, 'orlova').waitFor({ state: 'visible', timeout: 60000 });
  await shot(page, '01-teachers', 'Преподаватели с подписанным договором участия: договор, ставка часа, курсы. Выше — договоры, которые ждут подписи председателя в запросах одобрений.');

  await row(page, 'orlova').click();
  await page.waitForTimeout(1200);
  await shot(page, '02-card', 'Карточка преподавателя: договор с датами подписей, ставка, рассказ о себе и курсы, к которым преподаватель допущен.');

  const assign = page.locator('button:has-text("Назначить курс")').first();
  if (await assign.isVisible().catch(() => false)) {
    await assign.click();
    await page.waitForSelector('text=Период с', { timeout: 15000 });
    await page.waitForTimeout(600);
    await shot(page, '03-assign-dialog', 'Допуск к курсу: курс, период ведения, расписание и ожидаемый результат. Ставка на курсе берётся из договора, но не выше плановой ставки курса.');
    await closeDialog(page);
  }
};
