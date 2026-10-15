// Сценарий: повестка совета — вопрос о новой редакции шаблона документа от
// голосования до утверждения председателем. Вопрос ставит фаза
// soviet:02-propose (либо председатель в сценарии документов), голоса членов
// совета Петра и Анны — фаза soviet:02-votes.

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
  prepare: ['soviet:02-propose', 'soviet:04-expense'],
};

const SOVIET = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/${p}`;

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, SOVIET('agenda'), null);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-agenda', 'Повестка совета: вопросы с номером, типом решения, заявителем, голосами и сроком. Строка открывает вопрос целиком.');

  const cards = page.locator('.question-card');
  const byText = cards.filter({ hasText: /редакц/i }).first();
  const card = (await byText.isVisible().catch(() => false)) ? byText : cards.first();
  await expect(card, 'повестка пуста: фаза soviet:02-propose').toBeVisible({ timeout: 30000 });
  await card.locator('.question-card__row').click();
  await page.waitForTimeout(1800);
  await shot(page, '02-drawer', 'Строка вопроса открывает его сведения в правой панели: заявитель, проект решения, документы.');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await card.locator('text=Подробнее').first().click();
  await page.waitForSelector('text=К повестке совета', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '02b-question', 'Вопрос целиком: тип решения, заявитель, проект решения с текстом новой редакции и её хэшем. Внизу голосование «за» и «против» и кнопка утверждения председателем.');

  await page.locator('.vote-btn--for').first().click();
  // Сообщения живут секунды; факт голоса — нажатая кнопка «за».
  await page.waitForSelector('.vote-btn--for.is-active', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-voted', 'Голос председателя «за» принят. Пока за решение не проголосовало больше половины совета, кнопка «Утвердить» закрыта.');

  runPrepare(['soviet:02-votes'], { log: (m) => console.log(`    ${m}`) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=К повестке совета', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '04-quorum', 'Члены совета проголосовали «за», большинство набрано. Кнопка «Утвердить» открыта.');

  await page.locator('button:has-text("Утвердить")').first().click();
  await page.waitForSelector('text=/Решение принято и исполнено|в повестке нет/', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, '05-authorized', 'Председатель утвердил решение: протокол подписан, решение исполнено. Новая редакция шаблона вступает в силу, вопрос уходит из повестки, протокол — в реестре документов.');
};
