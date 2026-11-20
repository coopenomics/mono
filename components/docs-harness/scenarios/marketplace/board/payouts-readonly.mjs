// Сценарий: совет открывает ленту выплат поставщикам по всему кооперативу
// (только чтение) и окно пакета выплаты с заказами пакета. Подтверждение и
// отказ выплат делает кассир кооператива.
//
// С 19.11.2026 выплата — пакет заказов поставщика за сутки; пакет собирает
// обход узла в начале суток. Сценарий идёт в сюите сжатого времени
// (bin/run-marketplace-keu-all.mjs), где к его началу пакет уже отправлен.
//
// Фикстура: chairman кооператива (ant) — роли admin/board/board_readonly.

import { loginAsChairman, dismissOnboardingDialogs, cleanViteOverlays, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Выплаты поставщикам — обзор совета',
  docPath: 'new/marketplace/board/payouts-readonly.md',
  assetsDir: 'assets/new/marketplace/board/payouts-readonly',
  role: 'chairman',
};

export default async ({ page, context, shot, env, expect }) => {
  await loginAsChairman(page, context);
  // При трёх участках кооператив на системе участков, и стол просит
  // председателя выбрать участок: окно закрывает страницу и перехватывает клики.
  await pickBranchIfAsked(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/payouts`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Выплаты', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await pickBranchIfAsked(page);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-board-payouts',
    'Лента выплат поставщикам по всему кооперативу для совета: поиск, фильтр и таблица пакетов выплаты (дата, поставщик, сумма, состояние, назначение). Только чтение — выплаты подтверждает кассир кооператива.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Сидоров').first()).toBeVisible({ timeout: 120000 });
      },
    },
  );

  // Окно пакета: поставщик, назначение, заказы пакета и платёж кооператива.
  await page.locator('tr:has-text("Сидоров")').first().click();
  await page.waitForSelector('text=Заказы в выплате', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-payout-detail',
    'Окно пакета выплаты: поставщик, назначение по договору, дата, заказы пакета с состоянием и платёж кооператива у кассира.',
  );
};
