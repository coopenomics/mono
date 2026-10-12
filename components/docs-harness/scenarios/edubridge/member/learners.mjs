// Сценарий: обучающиеся ученика — список и добавление.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, fill, pick } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.enrollment',
  title: 'Обучающиеся',
  docPath: 'new/edubridge/member/learners.md',
  assetsDir: 'assets/new/edubridge/member/learners',
  role: 'user',
  fixtures: ['gromova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:04-member'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.PARENT));
  await settleAfterLogin(page);
  await openPage(page, EDU.member('learners'), EDU.LEARNER_NAME);
  await shot(page, '01-learners', 'Обучающиеся — те, кто проходит курс: сам пайщик или тот, кого он записывает. У каждого — способ получения доступа и число подписок.');

  await page.locator('button:has-text("Добавить обучающегося")').first().click();
  await page.waitForSelector('text=Фамилия, имя, отчество', { timeout: 15000 });
  await page.waitForTimeout(500);
  const other = page.locator('text=Другой человек').first();
  if (await other.isVisible().catch(() => false)) await other.click();
  await fill(page, 'Фамилия, имя, отчество', 'Громова Вера Николаевна');
  await pick(page, 'Способ получения доступа', 'Очно').catch(() => {});
  const code = page.locator('label:has-text("Код пропуска")').locator('input').first();
  if (await code.isVisible().catch(() => false)) await code.fill('ПР-2042');
  await shot(page, '02-new-learner', 'Новый обучающийся: фамилия, имя, отчество и способ получения доступа — очно по коду пропуска, на электронную почту или в Telegram. На этот адрес уходит доступ к курсу.');

  await page.locator('button:has-text("Сохранить"), button[type="submit"]').last().click();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '03-added', 'Обучающийся добавлен. Записать его на курс можно из каталога либо из его карточки.');
};
