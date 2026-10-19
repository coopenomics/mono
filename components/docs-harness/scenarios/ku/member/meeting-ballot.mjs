// Сценарий: участник собрания голосует бюллетенем. Третий участник голосует
// фазой ku:03-ballots.

import { loginAs } from '../../../lib/harness.mjs';
import { runPrepare } from '../../../lib/prepare.mjs';
import { loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';
import { KU } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.meetings',
  title: 'Бюллетень участника',
  docPath: 'new/ku/member/meeting-ballot.md',
  assetsDir: 'assets/new/ku/member/meeting-ballot',
  role: 'user',
  fixtures: ['popova', 'egorov'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(KU.JOINER));
  await settleAfterLogin(page);
  await openPage(page, KU.page('meetings'), 'Голосование');
  await page.locator('tbody tr').filter({ hasText: 'Голосование' }).first().click();
  await page.waitForSelector('text=Подписать бюллетень', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-voting', 'Собрание в голосовании глазами участника: наименование и адрес будущего участка, его председатель, время до конца голосования и повестка с выбором ответа.');

  const radios = page.locator('.agenda-card__vote .q-radio').filter({ hasText: /^За$/ });
  for (let i = 0; i < await radios.count(); i += 1) await radios.nth(i).click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Подписать бюллетень")').click();
  await expect(page.locator('button:has-text("Подписать бюллетень")'), 'бюллетень не принят').toHaveCount(0, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, '02-voted', 'Бюллетень подписан: ответы участника записаны, по вопросам видны текущие итоги голосования.');

  runPrepare(['ku:03-ballots'], { log: (m) => console.log(`    ${m}`) });
};
