// Сценарий: реестр действий автоматизации — по каждому типу решения голос
// члена совета, подпись протокола председателем, кворум робота. На стенде
// совет доверил роботу приём пайщика, решения Стола заказов и выход пайщика
// (предустановка boot и фаза robot:01-activity).

import { loginAsChairman } from '../../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'robot.registry',
  title: 'Действия автоматизации',
  docPath: 'new/robot/admin/registry.md',
  assetsDir: 'assets/new/robot/admin/registry',
  role: 'chairman',
  prepare: ['robot:01-activity'],
};

export default async ({ page, context, shot, env, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/robot/registry`, 'Решение');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.locator('tbody tr').first(), 'реестр действий автоматизации пуст').toBeVisible({ timeout: 30000 });
  await shot(page, '01-registry', 'Действия автоматизации: по каждому типу решения — мой голос, мой протокол, кворум робота и кто подписывает протокол.');

  // Выбор голоса робота по типу решения: вручную, сразу или как другой член совета.
  const myVote = page.locator('tbody tr').first().locator('td').nth(1).locator('button').first();
  if (await myVote.isVisible().catch(() => false)) {
    await myVote.click();
    await page.locator('.q-menu').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '02-vote-mode', 'Как голосует робот за члена совета по этому типу решения: «Вручную», «Сразу» или «Как ‹член совета›» — тем же голосом и только после него.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(800);
  await shot(page, '03-actions', 'Внизу страницы — «Сохранить настройки», «Отменить» и «Отозвать доступ робота». Первое сохранение выпускает ключ разрешения робота и передаёт его роботу.');
};
