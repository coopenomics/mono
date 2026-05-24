// Сценарий: offerer-стол «История выплат» (Эпик 5 / Story 5.9).
// Поставщик видит список MarketplaceOutgoingPaymentRequest по своим
// закрытым актам приёмки — статусы INITIATED / CONFIRMED / FAILED, дата,
// сумма, валюта, банковский референс и назначение. На пустом стенде
// выплат ещё нет, страница показывает empty-state.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол поставщика — история выплат',
  docPath: 'new/marketplace/offerer/payments.md',
  assetsDir: 'assets/new/marketplace/offerer/payments',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market/payments`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-payments-empty',
    `Стол «История выплат» поставщика. URL: \`${page.url()}\`. Empty state: на стенде ещё нет закрытых актов приёмки, поэтому платёжных запросов от кооператива не сформировано.`,
  );
};
