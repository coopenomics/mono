// Сценарий: председатель участка одобряет заявку в доверенные лица встречной
// подписью. Заявку подал пайщик в сценарии member/trusted-request.

import { loginAs } from '../../../lib/harness.mjs';
import { loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';
import { KU, fillPassportIfAsked } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.trusted',
  title: 'Одобрение доверенного лица',
  docPath: 'new/ku/branch-chairman/trusted.md',
  assetsDir: 'assets/new/ku/branch-chairman/trusted',
  role: 'user',
  fixtures: ['sokolov'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(KU.FOUNDER));
  await settleAfterLogin(page);
  await openPage(page, KU.page('my-branch'), 'Заявки на доверенных');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const approve = page.locator('button:has-text("Одобрить")').first();
  await expect(approve, 'нет заявки на доверенного с кнопкой «Одобрить»').toBeVisible({ timeout: 30000 });
  await shot(page, '01-requests', 'Заявки на доверенных: заявитель, договор и доверенность, состояние. Председатель участка одобряет или отклоняет заявку.');

  await page.locator('button:has-text("Договор")').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.locator('.q-dialog:has-text("Договор о полной материальной ответственности")').count()) {
    await shot(page, '02-contract', 'Договор о полной материальной ответственности с подписью заявителя.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  await approve.click();
  await fillPassportIfAsked(page, { timeout: 4000 });
  await page.waitForSelector('text=Доверенное лицо принято', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '03-approved', 'Заявка одобрена встречной подписью председателя: пайщик в списке доверенных лиц участка.');
};
