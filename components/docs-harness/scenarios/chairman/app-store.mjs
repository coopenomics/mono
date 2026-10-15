// Сценарий: каталог приложений — витрина, установленные, страница и настройки приложения.
import { openChairman, CHAIR } from '../../lib/chairman.mjs';
import { openPage } from '../../lib/edu.mjs';
export const meta = { mode: 'docs', feature: 'chairman.extensions', title: 'Каталог приложений', docPath: 'new/chairman/app-store.md',
  assetsDir: 'assets/new/chairman/app-store', role: 'chairman' };
export default async ({ page, context, shot }) => {
  await openChairman(page, context, 'extensions/showcase');
  await shot(page, '01-showcase', 'Витрина приложений: приложения платформы с описанием и состоянием — установлено, в разработке.');
  await openPage(page, CHAIR('extensions/installed'), null);
  await page.waitForTimeout(1500);
  await shot(page, '02-installed', 'Установленные приложения кооператива.');
  await openPage(page, CHAIR('extensions/extension/market'), null);
  await page.waitForTimeout(2000);
  await shot(page, '03-extension', 'Страница приложения: описание, рабочие столы, инструкция и действия — включить, выключить, настроить.');
  await openPage(page, CHAIR('extensions/extension/market/settings'), null);
  await page.waitForTimeout(2000);
  await shot(page, '04-settings', 'Настройки приложения: параметры, которые приложение объявило в каталоге.');
};
