// Сценарий: Быстрый клиент.
import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';
export const meta = { mode: 'docs', feature: 'chatcoop.chat', title: 'Быстрый клиент', docPath: 'new/chatcoop/chat.md',
  assetsDir: 'assets/new/chatcoop/chat', role: 'chairman', prepare: ['chatcoop:01-install', 'chatcoop:02-rooms', 'chatcoop:03-calendar', 'chatcoop:04-transcript'] };
export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chatcoop/chat`, null);
  await page.waitForTimeout(2500);
  await shot(page, '01-page', 'Быстрый клиент мессенджера в рабочем столе: комнаты кооператива и переписка. Учётную запись мессенджера пайщик заводит при первом входе.');
  const rowDescription = null;
  if (!rowDescription) return;
  const row = page.locator('tbody tr, .q-item, .event-card, .transcription-card').filter({ hasText: /Заседание совета|Общее собрание/ }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(2000);
    await shot(page, '02-row', rowDescription);
  }
};
