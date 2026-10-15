// Сценарий: управление доступом — председатель назначает пайщику роль приложения.
import { openChairman } from '../../lib/chairman.mjs';
export const meta = { mode: 'docs', feature: 'chairman.access', title: 'Управление доступом', docPath: 'new/chairman/access-roles.md',
  assetsDir: 'assets/new/chairman/access-roles', role: 'chairman', fixtures: ['ivanpetrov'] };
export default async ({ page, context, shot, expect }) => {
  await openChairman(page, context, 'access');
  await shot(page, '01-roles', 'Управление доступом: роли приложений кооператива. Карточка роли называет приложение, что роль читает и чем управляет, и кому она назначена.');
  const assign = page.locator('.role-card button:has-text("Назначить")').first();
  if (!(await assign.isVisible().catch(() => false))) return;
  await assign.click();
  await page.waitForSelector('.q-dialog', { timeout: 15000 });
  const input = page.locator('.q-dialog input').first();
  await input.click();
  await input.pressSequentially('Петров', { delay: 40 });
  const option = page.locator('.q-menu .q-item').filter({ hasText: 'Петров' }).first();
  await option.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (await option.isVisible().catch(() => false)) await option.click();
  await page.waitForTimeout(800);
  await shot(page, '02-assign', 'Назначение роли: пайщик выбирается поиском по имени. Роль даёт ему доступ к страницам и действиям приложения.');
  await page.locator('.q-dialog button:has-text("Назначить")').last().click();
  await page.waitForSelector('text=Роль назначена', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '03-assigned', 'Роль назначена: пайщик в списке держателей роли с датой и автором назначения. Кнопка «Снять» отзывает роль.');
};
