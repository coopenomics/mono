// Сценарий: Председатель устанавливает расширение «market» (Эпик 1 / Story 1.1).
// Без install миграции marketplace не отрабатывают (baseline-категории не
// сидируются, marketplaceCppStatus возвращает NotFoundException), и весь
// magistral II не проходит pre-flight. Этот сценарий — обязательный pre-step
// перед coop-accept-cpp.
//
// Использует мутацию installExtension через UI «Магазин приложений» →
// `extension/market/install`. После install парсер обработает delta и
// bootstrap-миграция засеит 9 baseline-категорий.

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'L1 онбординг — установка расширения «market»',
  docPath: 'new/marketplace/onboarding/install-market.md',
  assetsDir: 'assets/new/marketplace/onboarding/install-market',
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

  // 1. Открыть страницу установки конкретного расширения. Маршрут зашит
  // в chairman/install.ts: `extension/:name/install`.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/chairman/extensions/extension/market/install`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await dismissOnboardingDialogs(page);
  // Ждём появления кнопки «включить» (label из InstallButton.vue).
  await page.locator('button:has-text("включить")').first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {});
  await shot(
    page,
    '01-install-form',
    'Страница установки расширения «market»: форма настроек + кнопка «включить» для активации расширения.',
  );

  // 2. Нажать «включить» — installExtension mutation. После backend save
  // парсер срабатывает на extension event, bootstrap-миграция засеивает
  // 9 baseline-категорий. Ждём подольше, пока расширение реально применится.
  const installBtn = page.locator('button:has-text("включить")').first();
  if (await installBtn.count()) {
    await installBtn.click();
    // Backend install: write to PG → load desktop → load extension routes → notify.
    await page.waitForTimeout(8000);
    await dismissOnboardingDialogs(page);
    await shot(
      page,
      '02-after-install',
      'Состояние после установки: уведомление об успехе + desktop перестроен с новыми extension routes (включая /market/onboarding/coop-cpp).',
    );
  }
};
