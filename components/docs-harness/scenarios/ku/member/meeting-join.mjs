// Сценарий: пайщик присоединяется к объявленному собранию. Третий участник
// присоединяется фазой ku:02-join — его экран тот же.

import { loginAs } from '../../../lib/harness.mjs';
import { runPrepare } from '../../../lib/prepare.mjs';
import { loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';
import { KU } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.meetings',
  title: 'Участие в собрании',
  docPath: 'new/ku/member/meeting-join.md',
  assetsDir: 'assets/new/ku/member/meeting-join',
  role: 'user',
  fixtures: ['popova', 'egorov'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(KU.JOINER));
  await settleAfterLogin(page);
  await openPage(page, KU.page('meetings'), 'Сбор участников');
  await page.locator('tbody tr').filter({ hasText: 'Сбор участников' }).first().click();
  await page.waitForSelector('text=Повестка собрания', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const join = page.locator('button:has-text("Участвовать")').first();
  await expect(join, 'нет кнопки «Участвовать»: собрание не в сборе участников').toBeVisible({ timeout: 20000 });
  await shot(page, '01-meeting', 'Собрание глазами пайщика: место, время, повестка. Кнопка «Участвовать» подаёт заявление на участие.');

  await join.click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await expect(page.locator('button:has-text("Участвовать")'), 'кнопка «Участвовать» осталась — участие не записано').toHaveCount(0, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, '02-joined', 'Пайщик в списке участников собрания. Голосовать он сможет, когда председатель собрания откроет голосование.');

  runPrepare(['ku:02-join'], { log: (m) => console.log(`    ${m}`) });
};
