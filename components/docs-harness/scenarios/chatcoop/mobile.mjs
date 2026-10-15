// Сценарий: Мобильный клиент.
import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';
export const meta = { mode: 'docs', feature: 'chatcoop.mobile', title: 'Мобильный клиент', docPath: 'new/chatcoop/mobile.md',
  assetsDir: 'assets/new/chatcoop/mobile', role: 'chairman', prepare: ['chatcoop:01-install', 'chatcoop:02-rooms', 'chatcoop:03-calendar', 'chatcoop:04-transcript'] };
export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chatcoop/mobile`, null);
  await page.waitForTimeout(2500);
  await shot(page, '01-page', 'Мобильный клиент: приложение для телефона и данные для входа в него.');
  const rowDescription = null;
  if (!rowDescription) return;
  const row = page.locator('tbody tr, .q-item, .event-card, .transcription-card').filter({ hasText: /Заседание совета|Общее собрание/ }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(2000);
    await shot(page, '02-row', rowDescription);
  }
};
