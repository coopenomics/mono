// Сценарий: расчёты преподавателя — паевой взнос по программе, выписка и
// возврат на реквизиты. Взнос зачислен после подписи акта председателем
// (сценарий admin/contributions), реквизиты СБП добавлены фазой 06.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Расчёты',
  docPath: 'new/edubridge/teacher/settlement.md',
  assetsDir: 'assets/new/edubridge/teacher/settlement',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('settlement'), 'Паевой взнос по программе');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-settlement', 'Расчёты: принятые советом взносы зачислены паевым взносом по программе «Образование». В выписке — зачисление по принятому результату. Возврат оформляется кнопкой «Получить возврат».');

  const returnBtn = page.locator('button:has-text("Получить возврат")').first();
  await expect(returnBtn, 'кнопка возврата недоступна: взнос не зачислен').toBeEnabled({ timeout: 30000 });
  await returnBtn.click();
  await page.waitForSelector('text=Возврат паевого взноса', { timeout: 15000 });
  await page.locator('label:has-text("Реквизиты")').first().click();
  const option = page.locator('.q-menu .q-item').first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
  await page.waitForTimeout(500);
  await shot(page, '02-return-dialog', 'Возврат паевого взноса: возвращается вся доступная сумма, преподаватель выбирает реквизиты. Два заявления — о трансляции взноса в Цифровой Кошелёк и о возврате деньгами — подписываются разом.');
  await page.locator('.q-dialog button:has-text("Получить возврат")').last().click();
  await page.waitForSelector('text=Заявление о возврате подано', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '03-requested', 'Заявление подано: в выписке возврат со состоянием «На рассмотрении совета». После решения совета и выплаты кассиром состояние станет «Выплачено».');
};
