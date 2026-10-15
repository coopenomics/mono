// Сценарий: взносы преподавателей результатами интеллектуальной деятельности
// и вторая подпись председателя на акте приёма-передачи. Акт подписан
// преподавателем в сценарии teacher/reports.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.contract',
  title: 'Взносы преподавателей',
  docPath: 'new/edubridge/admin/contributions.md',
  assetsDir: 'assets/new/edubridge/admin/contributions',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('contributions'), 'Взнос');
  await page.waitForTimeout(1200);
  await shot(page, '01-contributions', 'Взносы преподавателей: преподаватель, взнос, обучающиеся, сумма и состояние. Решение принимает совет в повестке; акт приёма-передачи после подписи преподавателя ждёт подписи председателя.');

  // Акт на подписи — в карточке преподавателя, блок документов на подписи.
  await openPage(page, EDU.admin('teachers'), 'Преподаватели');
  await row(page, EDU.TEACHER).waitFor({ state: 'visible', timeout: 60000 });
  await row(page, EDU.TEACHER).click();
  await page.waitForTimeout(1500);
  const signBtn = page.locator('button:has-text("Подписать")').first();
  await expect(signBtn, 'в карточке преподавателя нет документа на подписи: акт не подписан преподавателем').toBeVisible({ timeout: 20000 });
  await shot(page, '02-act-to-sign', 'Карточка преподавателя: акт приёма-передачи с подписью преподавателя ждёт подписи председателя. Кнопка «Подписать» ставит вторую подпись.');
  await signBtn.click();
  await page.waitForSelector('text=Подписать документ', { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot(page, '03-sign-confirm', 'Подтверждение подписи: документ подписывается ключом председателя.');
  await page.locator('.q-dialog button:has-text("Подписать")').last().click();
  await page.waitForSelector('text=Документ подписан', { timeout: 90000 });
  await page.waitForTimeout(1500);

  await openPage(page, EDU.admin('contributions'), 'Взнос');
  await expect(row(page, 'Принят'), 'взнос не стал «Принят» после подписи председателя').toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, '04-accepted', 'Взнос принят: обе подписи на акте стоят, сумма зачислена преподавателю паевым взносом по программе. Второй взнос — на ответственном хранении до конца гарантийного срока.');
};
