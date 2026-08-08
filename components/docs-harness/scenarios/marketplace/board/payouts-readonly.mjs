// Сценарий: совет открывает read-only ленту выплат поставщикам по всему
// кооперативу. Backend marketplaceListOutgoingPayments под capability
// Payment:read:all (board/board_readonly/admin), опциональный фильтр по
// поставщику. Подтверждение/отказ выплат делает кассир кооператива.
//
// Фикстура: chairman кооператива (ant) — роли admin/board/board_readonly.

import { loginAsChairman, dismissOnboardingDialogs, cleanViteOverlays } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Выплаты поставщикам — обзор совета',
  docPath: 'new/marketplace/board/payouts-readonly.md',
  assetsDir: 'assets/new/marketplace/board/payouts-readonly',
  role: 'chairman',
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/payouts`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Выплаты', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-board-payouts',
    'Лента выплат поставщикам по всему кооперативу для совета: фильтры по поставщику и статусу, сводка-счётчики по статусам и таблица выплат (дата, поставщик, сумма, валюта, статус, назначение). Read-only — подтверждает выплаты кассир кооператива.',
  );
};
