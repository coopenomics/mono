// Сценарий: все участники проголосовали. Учредитель как председатель
// собрания утверждает протокол и направляет заявление об учреждении участка
// в совет.

import { loginAs } from '../../../lib/harness.mjs';
import { loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';
import { KU, fillPassportIfAsked } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.meetings',
  title: 'Протокол и заявление в совет',
  docPath: 'new/ku/member/meeting-protocol.md',
  assetsDir: 'assets/new/ku/member/meeting-protocol',
  role: 'user',
  fixtures: ['sokolov'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(KU.FOUNDER));
  await settleAfterLogin(page);
  await openPage(page, KU.page('meetings'), 'Голосование');
  await page.locator('tbody tr').filter({ hasText: 'Голосование' }).first().click();
  await page.waitForSelector('text=Итоги голосования', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-results', 'Все участники проголосовали: у каждого вопроса итоги «За», «Против», «Воздержались» и число поданных бюллетеней.');

  await page.locator('button:has-text("Завершить и утвердить протокол")').click();
  await page.waitForSelector('text=Протокол утверждён', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '02-protocol', 'Протокол собрания подписан председателем собрания и виден на странице собрания. Кнопка «Направить в совет» отправляет заявление об учреждении участка.');

  await page.locator('button:has-text("Направить в совет")').click();
  await fillPassportIfAsked(page, {
    shot,
    name: '03-passport',
    description: 'Паспортные данные председателя участка: они нужны для договора о полной материальной ответственности и сохраняются в профиле.',
  });
  await page.waitForSelector('text=Проверьте документы перед подписанием', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, '04-exec-preview', 'Пакет в совет: заявление об учреждении участка, договор о полной материальной ответственности и доверенность председателю участка. Данные председателя уже подставлены.');
  await page.locator('.q-dialog button:has-text("Подписать и направить в совет")').click();
  await page.waitForSelector('text=На утверждении советом', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, '05-on-approval', 'Заявление направлено: собрание на утверждении советом. Совет голосует, председатель кооператива подписывает протокол решения.');
};
