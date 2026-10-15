// Сценарий: повестка совета — вопрос о выходе пайщика от голосования до
// утверждения председателем. Вопрос ставит фаза soviet:01-agenda, голоса
// членов совета Петра и Анны — фаза soviet:02-votes.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { runPrepare } from '../../lib/prepare.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'soviet.agenda',
  title: 'Повестка совета',
  docPath: 'new/council/agenda.md',
  assetsDir: 'assets/new/council/agenda',
  role: 'chairman',
  prepare: ['soviet:01-agenda', 'soviet:04-expense'],
};

const SOVIET = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/${p}`;

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, SOVIET('agenda'), null);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-agenda', 'Повестка совета: вопросы с номером, типом решения, заявителем, голосами и сроком. Строка открывает вопрос целиком.');

  const row = page.locator('tbody tr, .question-row, .q-table tbody tr').filter({ hasText: /Выход/ }).first();
  await expect(row, 'в повестке нет вопроса о выходе пайщика: фаза soviet:01-agenda').toBeVisible({ timeout: 30000 });
  await row.click();
  await page.waitForSelector('text=К повестке совета', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '02-question', 'Вопрос целиком: тип решения, заявитель, проект решения и документы вопроса. Внизу голосование «за» и «против» и кнопка утверждения председателем.');

  await page.locator('.vote-btn--for').first().click();
  await page.waitForSelector('text=Голос принят', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-voted', 'Голос председателя «за» принят. Пока за решение не проголосовало больше половины совета, кнопка «Утвердить» закрыта.');

  runPrepare(['soviet:02-votes'], { log: (m) => console.log(`    ${m}`) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=К повестке совета', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '04-quorum', 'Члены совета проголосовали «за», большинство набрано. Кнопка «Утвердить» открыта.');

  await page.locator('button:has-text("Утвердить")').first().click();
  await page.waitForSelector('text=Решение принято и исполнено', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, '05-authorized', 'Председатель утвердил решение: протокол подписан, решение исполнено. Вопрос уходит из повестки, документы решения — в реестре документов.');
};
