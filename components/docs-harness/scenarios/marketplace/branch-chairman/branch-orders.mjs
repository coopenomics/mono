// Сценарий: Сводный стол КУ (председателя кооператива).
// Эпик 6 / Story 6.x — Приёмки, Выдачи, Возвраты по braname.
//
// Замечание: меж-роли «председатель КУ» в desktop matrix нет — роут
// /market-pvz/* открыт только `roles: ['chairman']` (председатель
// кооператива). На текущем MVP председатель сам открывает стол КУ для
// аудита. Отдельный access-уровень «branch chairman» подключится
// в Story 6.x+1 вместе с auto-detect braname через marketplaceWhoAmI.

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Сводный стол КУ: приёмки, выдачи, возвраты',
  docPath: 'new/marketplace/branch-chairman/branch-orders.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/branch-orders',
  role: 'chairman',
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market-pvz/branch-orders`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Сводный стол кооперативного участка', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await dismissOnboardingDialogs(page);

  await shot(
    page,
    '01-empty-input',
    'Сводный стол КУ до ввода braname: подсказка «Введите ID вашего КУ» + поле ввода. Auto-detect через marketplace_whoami появится на следующем шаге Story 6.x+1 — председатель КУ привязан к одному branch через trustee.',
  );

  const branameInput = page.locator('input[aria-label*="braname"], label:has-text("braname") input, label:has-text("ID кооперативного участка") input').first();
  if (await branameInput.isVisible().catch(() => false)) {
    await branameInput.fill('krg');
    await page.locator('button:has-text("Загрузить")').click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissOnboardingDialogs(page);
    await shot(
      page,
      '02-loaded-tabs',
      'После ввода braname КУ Красногорск (krg) — карта с 3 табами и счётчиками: Приёмки (Эпик 5), Выдачи (Эпик 6), Возвраты (Эпик 7). Polling 20s — обновляет все 3 ленты параллельно через Promise.all.',
    );
  }
};
