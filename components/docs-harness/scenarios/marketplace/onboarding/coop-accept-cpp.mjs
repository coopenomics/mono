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

async function signAllAgreements(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(500);
  for (let i = 0; i < 8; i++) {
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      if (portals.length === 0) return false;
      const top = portals[portals.length - 1];
      const btn = Array.from(top.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(3500);
  }
}

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await signAllAgreements(page);
  await dismissOnboardingDialogs(page);

  // 1. Открыть страницу подключения ЦПП
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/onboarding/coop-cpp`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Подключение ЦПП', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Карточка статуса монтируется по `v-if="status"` — ждём кнопку accept или
  // chip «Подключено» (любой из двух финальных состояний компонента).
  await page.locator('button:has-text("Принять ЦПП Marketplace"), .q-chip:has-text("Подключено")').first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {});
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
    // 3. Подтверждаем accept — внутри диалога ищем кнопку «Принять» (не «Отмена»).
    const confirmBtn = page.locator('.q-dialog button:has-text("Принять")').last();
    if (await confirmBtn.count()) {
      await confirmBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(8000); // ждём parser обработает delta и migration отработает
      await shot(
        page,
        '03-after-accept',
        'Страница после принятия ЦПП «Стол заказов» — chip обновился в «Подключено», baseline-категории засеяны через bootstrap-миграцию.',
      );
    }
  }
};
