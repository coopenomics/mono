// Сценарий: установка приложения «Кооперативный мессенджер» из каталога.
import { env, loginAsChairman } from '../../lib/harness.mjs';
import { runPrepare } from '../../lib/prepare.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';
export const meta = { mode: 'docs', feature: 'chatcoop.install', title: 'Установка мессенджера', docPath: 'new/chatcoop/install.md',
  assetsDir: 'assets/new/chatcoop/install', role: 'chairman' };
export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/chairman/extensions/extension/chatcoop`, null);
  await page.waitForTimeout(2000);
  await shot(page, '01-extension', 'Мессенджер в каталоге приложений: описание, рабочий стол и инструкция по установке.');
  runPrepare(['chatcoop:01-install', 'chatcoop:02-rooms', 'chatcoop:03-calendar', 'chatcoop:04-transcript'], { log: (m) => console.log(`    ${m}`) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '02-installed', 'Мессенджер установлен: у пайщиков появляется рабочий стол мессенджера, кооператив заводит учётные записи и комнаты.');
};
