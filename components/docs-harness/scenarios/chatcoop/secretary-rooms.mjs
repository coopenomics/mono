// Сценарий: Комнаты секретаря.
import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';
export const meta = { mode: 'docs', feature: 'chatcoop.secretary-rooms', title: 'Комнаты секретаря', docPath: 'new/chatcoop/secretary-rooms.md',
  assetsDir: 'assets/new/chatcoop/secretary-rooms', role: 'chairman', prepare: ['chatcoop:01-install', 'chatcoop:02-rooms', 'chatcoop:03-calendar', 'chatcoop:04-transcript'] };
export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chatcoop/secretary-rooms`, null);
  await page.waitForTimeout(2500);
  await shot(page, '01-page', 'Комнаты секретаря: комнаты, в которых секретарь ведёт запись и протокол.');
  const rowDescription = null;
  if (!rowDescription) return;
  const row = page.locator('tbody tr, .q-item, .event-card, .transcription-card').filter({ hasText: /Заседание совета|Общее собрание/ }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(2000);
    await shot(page, '02-row', rowDescription);
  }
};
