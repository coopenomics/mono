// Сценарий: настройки пайщика — пароль, подтверждение входа, сессии и
// заявление на выход из кооператива.
import { loginMember, openMember, participantMeta, USER } from '../../lib/participant.mjs';
export const meta = {
  ...participantMeta('settings', 'Настройки'),
  fixtures: ['ivanpetrov'],
};
export default async ({ page, shot }) => {
  await loginMember(page);
  await openMember(page, { url: USER('settings') });
  await shot(page, '01-page', 'Настройки пайщика: пароль входа, подтверждение входа кодом и активные сессии на устройствах.');
  const exit = page.locator('button:has-text("Выйти из кооператива")').first();
  if (!(await exit.isVisible().catch(() => false))) return;
  await exit.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await shot(page, '02-exit-card', 'Выход из кооператива: заявление на выход. Совет принимает решение, кооператив возвращает паевой взнос.');
  await exit.click();
  await page.waitForTimeout(2000);
  await shot(page, '03-exit-dialog', 'Заявление на выход из кооператива перед подписью.');
  await page.keyboard.press('Escape');
};
