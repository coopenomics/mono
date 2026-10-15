// Сценарий: Календарь событий.
import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';
export const meta = { mode: 'docs', feature: 'chatcoop.calendar', title: 'Календарь событий', docPath: 'new/chatcoop/calendar.md',
  assetsDir: 'assets/new/chatcoop/calendar', role: 'chairman', prepare: ['chatcoop:01-install', 'chatcoop:02-rooms', 'chatcoop:03-calendar', 'chatcoop:04-transcript'] };
export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chatcoop/calendar`, null);
  await page.waitForTimeout(2500);
  await shot(page, '01-page', 'Календарь событий кооператива: заседания совета и общие собрания по комнатам. Подписка добавляет события в календарь телефона.');
  const rowDescription = 'Событие календаря: комната, время и описание.';
  if (!rowDescription) return;
  const row = page.locator('tbody tr, .q-item, .event-card, .transcription-card').filter({ hasText: /Заседание совета|Общее собрание/ }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(2000);
    await shot(page, '02-row', rowDescription);
  }
};
