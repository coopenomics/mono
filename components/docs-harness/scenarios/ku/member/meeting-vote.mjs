// Сценарий: учредитель ведёт собрание — открывает голосование с данными
// нового участка и председателем, голосует бюллетенем, утверждает протокол
// и направляет заявление об учреждении в совет. Бюллетени двух других
// участников подаёт фаза ku:03-ballots.

import { loginAs } from '../../../lib/harness.mjs';
import { runPrepare } from '../../../lib/prepare.mjs';
import { loadFixture, openPage, settleAfterLogin, fill, pick } from '../../../lib/edu.mjs';
import { KU, fillPassportIfAsked } from '../../../lib/ku.mjs';

export const meta = {
  mode: 'docs',
  feature: 'ku.meetings',
  title: 'Голосование и протокол',
  docPath: 'new/ku/member/meeting-vote.md',
  assetsDir: 'assets/new/ku/member/meeting-vote',
  role: 'user',
  fixtures: ['sokolov', 'popova', 'egorov'],
  prepare: ['ku:01-install', 'marketplace:02-branches'],
};

async function openFounderMeeting(page, status) {
  await openPage(page, KU.page('meetings'), status);
  await page.locator('tbody tr').filter({ hasText: status }).first().click();
  await page.waitForSelector('text=Повестка собрания', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(KU.FOUNDER));
  await settleAfterLogin(page);
  await openFounderMeeting(page, 'Сбор участников');

  // ── Открыть голосование ──────────────────────────────────────────────────
  await page.locator('button:has-text("Открыть голосование")').first().click();
  await page.waitForSelector('text=Наименование кооперативного участка', { timeout: 15000 });
  await fill(page, 'Наименование кооперативного участка', KU.BRANCH_NAME);
  await fill(page, 'Адрес кооперативного участка', KU.BRANCH_ADDRESS);
  await fill(page, 'Email кооперативного участка', KU.BRANCH_EMAIL);
  await fill(page, 'Телефон кооперативного участка', KU.BRANCH_PHONE);
  await pick(page, 'Председатель кооперативного участка', 'Соколов');
  await page.waitForTimeout(400);
  await shot(page, '01-start-dialog', 'Открытие голосования: наименование, адрес и контакты будущего участка и его председатель из числа участников. Голосование длится 15 минут.');
  await page.locator('.q-dialog button[type="submit"]').last().click();
  await page.waitForSelector('text=Подписать бюллетень', { timeout: 90000 });
  await page.waitForTimeout(1500);

  // ── Бюллетень ────────────────────────────────────────────────────────────
  const radios = page.locator('.agenda-card__vote .q-radio').filter({ hasText: /^За$/ });
  for (let i = 0; i < await radios.count(); i += 1) await radios.nth(i).click();
  await page.waitForTimeout(400);
  await shot(page, '02-ballot', 'Голосование открыто: у каждого вопроса повестки выбор «За», «Против» или «Воздержался». Кнопка «Подписать бюллетень» подписывает ответы участника.');
  await page.locator('button:has-text("Подписать бюллетень")').click();
  await expect(page.locator('button:has-text("Подписать бюллетень")'), 'бюллетень не принят').toHaveCount(0, { timeout: 90000 });
  await page.waitForTimeout(1500);

  runPrepare(['ku:03-ballots'], { log: (m) => console.log(`    ${m}`) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Итоги голосования', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '03-results', 'Все участники проголосовали: у каждого вопроса итоги «За», «Против», «Воздержались» и число поданных бюллетеней.');

  // ── Протокол ─────────────────────────────────────────────────────────────
  await page.locator('button:has-text("Завершить и утвердить протокол")').click();
  await page.waitForSelector('text=Протокол утверждён', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '04-protocol', 'Протокол собрания подписан председателем собрания. Протокол виден на странице собрания, кнопка «Направить в совет» отправляет заявление об учреждении участка.');

  // ── Заявление в совет ────────────────────────────────────────────────────
  await page.locator('button:has-text("Направить в совет")').click();
  await fillPassportIfAsked(page, {
    shot,
    name: '05-passport',
    description: 'Паспортные данные председателя участка: они нужны для договора о полной материальной ответственности и сохраняются в профиле.',
  });
  await page.waitForSelector('text=Проверьте документы перед подписанием', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, '06-exec-preview', 'Пакет в совет: заявление об учреждении участка, договор о полной материальной ответственности и доверенность председателю участка. Данные председателя уже подставлены.');
  await page.locator('.q-dialog button:has-text("Подписать и направить в совет")').click();
  await page.waitForSelector('text=На утверждении советом', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, '07-on-approval', 'Заявление направлено: собрание на утверждении советом. Совет голосует, председатель кооператива подписывает протокол решения.');
};
