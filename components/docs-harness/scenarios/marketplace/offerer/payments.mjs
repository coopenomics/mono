// Сценарий: offerer-стол «История выплат» (Эпик 5 / Story 5.9).
// Поставщик видит список MarketplaceOutgoingPaymentRequest по своим
// закрытым актам приёмки — статусы INITIATED / CONFIRMED / FAILED, дата,
// сумма, валюта, банковский референс и назначение. На пустом стенде
// выплат ещё нет, страница показывает empty-state.

import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs, signOnboardingAgreements } from '../../../lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол поставщика — история выплат',
  docPath: 'new/marketplace/offerer/payments.md',
  assetsDir: 'assets/new/marketplace/offerer/payments',
  role: 'user',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
};

export default async ({ page, shot }) => {
  // История выплат — перспектива поставщика (ivanpetrov), не председателя.
  const fixture = loadFixture('ivanpetrov');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/payments`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-payments',
    `Стол «История выплат» поставщика: дата, сумма, валюта, статус, банковский референс и назначение платежа. URL: \`${page.url()}\`. По каждому закрытому акту приёмки кооператив формирует платёжный запрос поставщику; здесь — список запросов в статусе «Ожидает» с суммой по заказу.`,
  );
};
