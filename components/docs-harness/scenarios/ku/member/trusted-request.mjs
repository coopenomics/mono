// Сценарий: пайщик подаёт заявку в доверенные лица нового участка — договор
// о полной материальной ответственности и доверенность подписываются разом.

import { loginAs } from '../../../lib/harness.mjs';
import { loadFixture, openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';
import { KU, fillPassportIfAsked } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.trusted',
  title: 'Заявка в доверенные лица',
  docPath: 'new/ku/member/trusted.md',
  assetsDir: 'assets/new/ku/member/trusted',
  role: 'user',
  fixtures: ['zakharova'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(KU.APPLICANT));
  await settleAfterLogin(page);
  await openPage(page, KU.page('branches'), KU.BRANCH_NAME);
  await row(page, KU.BRANCH_NAME).click();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const request = page.locator('button:has-text("Стать доверенным лицом")').first();
  await expect(request, 'нет кнопки «Стать доверенным лицом»').toBeVisible({ timeout: 20000 });
  await shot(page, '01-branch', 'Карточка участка глазами пайщика: председатель, доверенные лица и кнопка «Стать доверенным лицом». Доверенных у участка не больше трёх.');

  await request.click();
  await fillPassportIfAsked(page, {
    shot,
    name: '02-passport',
    description: 'Паспортные данные пайщика для договора о полной материальной ответственности. Окно открывается один раз, данные сохраняются в профиле.',
  });
  await page.waitForSelector('text=Проверьте документы перед подписанием', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-preview', 'Документы заявки: договор о полной материальной ответственности и доверенность. Данные пайщика и председателя участка подставлены.');
  await page.locator('.q-dialog button:has-text("Подписать и подать заявку")').click();
  await page.waitForSelector('text=Заявка подана', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '04-submitted', 'Заявка подана и ждёт председателя участка: она в списке заявок участка в состоянии «На рассмотрении».');
};
