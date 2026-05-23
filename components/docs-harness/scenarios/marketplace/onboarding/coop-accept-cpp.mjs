// Сценарий: Председатель кооператива принимает ЦПП «Стол заказов».
// Эпик 1 / Story 1.9-1.10 — L1 онбординг кооператива.
//
// Председатель видит статус ЦПП (active / not_accepted) и кнопку
// «Принять ЦПП Marketplace». После клика — диалог подтверждения с
// stub `accepted_by_board_decision_id` (в MVP — текстовая ссылка;
// полноценная повестка совета — FR40 / Эпик 8, Phase 2).
//
// Фикстура: chairman кооператива (ant, Иван Иванов).

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'L1 онбординг — приём ЦПП «Стол заказов» кооперативом',
  docPath: 'new/marketplace/onboarding/coop-accept-cpp.md',
  assetsDir: 'assets/new/marketplace/onboarding/coop-accept-cpp',
  role: 'chairman',
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  // 1. Открыть страницу подключения ЦПП
  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market/onboarding/coop-cpp`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Подключение ЦПП', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await dismissOnboardingDialogs(page);
  await shot(
    page,
    '01-status',
    'Страница подключения ЦПП «Стол заказов»: chip справа показывает текущий статус расширения (Подключено / Не подключено). Карточка под шапкой раскрывает статус, реестр оферты, дату принятия и решение совета.',
  );

  // 2. Если не принято — открыть диалог подтверждения принятия
  const acceptBtn = page.locator('button:has-text("Принять ЦПП Marketplace")');
  if (await acceptBtn.isVisible().catch(() => false)) {
    await acceptBtn.click();
    await page.waitForSelector('text=Принять ЦПП', { timeout: 10000 });
    await page.waitForTimeout(600);
    await shot(
      page,
      '02-confirm-dialog',
      'Диалог подтверждения принятия ЦПП «Стол заказов». В MVP — stub решения совета; полноценная повестка подключится в Эпике 8 (FR40).',
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
};
