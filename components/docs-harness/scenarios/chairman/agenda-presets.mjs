// Сценарий: пресеты предложений повестки совета.
import { openChairman } from '../../lib/chairman.mjs';
export const meta = { mode: 'docs', feature: 'chairman.presets', title: 'Пресеты предложений', docPath: 'new/chairman/agenda-presets.md',
  assetsDir: 'assets/new/chairman/agenda-presets', role: 'chairman' };
export default async ({ page, context, shot }) => {
  await openChairman(page, context, 'agenda-presets');
  await shot(page, '01-presets', 'Пресеты предложений повестки: готовые вопросы для совета. Пресет собирает документы предложения по шаблону.');
  const item = page.locator('.q-item').filter({ hasText: /./ }).first();
  const create = page.locator('button:has-text("Создать предложение"), button:has-text("Сгенерировать")').first();
  if (await create.isVisible().catch(() => false)) {
    await create.click();
    await page.waitForTimeout(1500);
    await shot(page, '02-dialog', 'Предложение повестки: вопрос на повестке и проект решения. Кнопка «Создать предложение» ставит вопрос в повестку совета.');
    await page.keyboard.press('Escape');
  } else if (await item.isVisible().catch(() => false)) {
    await item.click();
    await page.waitForTimeout(1500);
    await shot(page, '02-dialog', 'Предложение повестки: вопрос на повестке и проект решения.');
  }
};
