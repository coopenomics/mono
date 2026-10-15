// Сценарий: совет учредил участок (фаза ku:04-council). Учредитель видит
// собрание завершённым с протоколом и решением совета, новый участок — в
// реестре и на странице «Мой участок».

import { loginAs } from '../../../lib/harness.mjs';
import { runPrepare } from '../../../lib/prepare.mjs';
import { loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';
import { KU } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.meetings',
  title: 'Решение совета',
  docPath: 'new/ku/member/meeting-council.md',
  assetsDir: 'assets/new/ku/member/meeting-council',
  role: 'user',
  fixtures: ['sokolov'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, shot, expect }) => {
  runPrepare(['ku:04-council'], { log: (m) => console.log(`    ${m}`) });

  await loginAs(page, loadFixture(KU.FOUNDER));
  await settleAfterLogin(page);
  await openPage(page, KU.page('meetings'), 'Завершено');
  await page.locator('tbody tr').filter({ hasText: 'Завершено' }).first().click();
  await page.waitForSelector('text=Документы собрания', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-completed', 'Собрание завершено: совет учредил участок. Внизу страницы документы собрания — протокол собрания пайщиков и решение совета об организации участка.');

  await page.locator('text=Решение совета об организации кооперативного участка').first().click();
  await page.waitForTimeout(2000);
  await shot(page, '02-council-decision', 'Решение совета об организации кооперативного участка: номер решения, наименование и адрес участка, его председатель.');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  await openPage(page, KU.page('my-branch'), KU.BRANCH_NAME);
  await page.waitForTimeout(1500);
  await expect(page.locator(`text=${KU.BRANCH_NAME}`).first()).toBeVisible({ timeout: 30000 });
  await shot(page, '03-my-branch', 'Мой участок: учредитель стал председателем нового участка. Здесь адрес и контакты участка, доверенные лица, заявки в доверенные и пайщики участка.');
};
