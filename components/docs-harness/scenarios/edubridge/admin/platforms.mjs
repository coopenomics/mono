// Сценарий: площадки, на которых проходят курсы (Skillspace, GetCourse).
// Ключи подключения вводятся в окне; на стенде документации площадок нет,
// поэтому окно показывается и закрывается без сохранения.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, closeDialog } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.access',
  title: 'Площадки',
  docPath: 'new/edubridge/admin/platforms.md',
  assetsDir: 'assets/new/edubridge/admin/platforms',
  role: 'chairman',
  prepare: ['edubridge:01-install'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('platforms'), 'Площадки');
  await shot(page, '01-platforms', 'Площадки: для каждой — состояние, ключи подключения и последняя проверка. Ключи хранятся зашифрованными, их видит только председатель.');

  const setKeys = page.locator('button:has-text("Задать ключи"), button:has-text("Ключи")').first();
  if (await setKeys.isVisible().catch(() => false)) {
    await setKeys.click();
    await page.waitForSelector('text=Ключи', { timeout: 15000 });
    await page.waitForTimeout(600);
    await shot(page, '02-keys-dialog', 'Окно ключей площадки: после сохранения кооператив сразу проверяет подключение и показывает результат в строке площадки.');
    await closeDialog(page);
  }
};
