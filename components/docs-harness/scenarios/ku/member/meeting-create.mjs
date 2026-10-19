// Сценарий: пайщик (учредитель) объявляет собрание об учреждении
// кооперативного участка. Собрание открывается со сбором участников.

import { loginAs } from '../../../lib/harness.mjs';
import { loadFixture, openPage, settleAfterLogin, fill, pick } from '../../../lib/edu.mjs';
import { KU, nextWeekAt } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.meetings',
  title: 'Собрания',
  docPath: 'new/ku/member/meetings.md',
  assetsDir: 'assets/new/ku/member/meetings',
  role: 'user',
  fixtures: ['sokolov'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(KU.FOUNDER));
  await settleAfterLogin(page);
  await openPage(page, KU.page('meetings'), 'Объявить собрание');
  await page.waitForTimeout(1000);
  await shot(page, '01-meetings', 'Собрания пайщиков: участок, дата и время, состояние, число участников. Любой пайщик объявляет собрание кнопкой «Объявить собрание».');

  await page.locator('button:has-text("Объявить собрание")').first().click();
  await page.waitForSelector('text=Тип собрания', { timeout: 15000 });
  await pick(page, 'Тип собрания', 'Создание кооперативного участка');
  await fill(page, 'Место проведения собрания', KU.MEET_PLACE);
  await page.locator('input[type="datetime-local"]').first().fill(nextWeekAt(18));
  await page.waitForTimeout(500);
  await shot(page, '02-create-dialog', 'Объявление собрания: тип, место и время. У собрания об учреждении участка повестка стандартная — организация участка и избрание его председателя.');

  await page.locator('.q-dialog button:has-text("Подписать и объявить")').click();
  await page.waitForSelector('text=Собрание объявлено', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await openPage(page, KU.page('meetings'), 'Сбор участников');
  await page.locator('tbody tr').filter({ hasText: 'Сбор участников' }).first().click();
  await page.waitForSelector('text=Повестка собрания', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('text=Участники собрания').first()).toBeVisible({ timeout: 15000 });
  await shot(page, '03-meeting-opened', 'Собрание объявлено и собирает участников. Сверху место и время, ниже участники и повестка с проектами решений. Голосование открывается, когда участников не меньше трёх.');
};
