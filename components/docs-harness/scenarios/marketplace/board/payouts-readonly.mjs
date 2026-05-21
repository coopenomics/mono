// Сценарий: Совет открывает informational placeholder для выплат
// поставщикам. Эпик 5 / Story 5.x — раздел в подготовке.
//
// Текущий backend marketplaceListOutgoingPaymentsAsSupplier отдаёт только
// выплаты текущего пайщика-supplier'а. Для совета нужна доп. policy
// Payment / read:all в marketplace-access-matrix + query
// marketplaceListOutgoingPayments с опц. supplier_account. До этого —
// placeholder со ссылками на нужные файлы.
//
// Фикстура: chairman кооператива (ant).

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Выплаты поставщикам — обзор совета (placeholder)',
  docPath: 'new/marketplace/board/payouts-readonly.md',
  assetsDir: 'assets/new/marketplace/board/payouts-readonly',
  role: 'chairman',
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market/payouts`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Выплаты поставщикам', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await dismissOnboardingDialogs(page);

  await shot(
    page,
    '01-placeholder',
    'Раздел в подготовке: информационный экран с пояснением, что для совета нужна доп. policy Payment/read:all и query marketplaceListOutgoingPayments. До этого совет видит выплаты через core cassir-стол кооператива. Ссылки на access-matrix и резолвер выплат.',
  );
};
