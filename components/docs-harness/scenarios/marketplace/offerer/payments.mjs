// Сценарий: стол поставщика «Выплаты» — пакеты выплаты за сутки.
//
// С 19.11.2026 заказы поставщика, принятые за сутки, объединяются в один
// пакет выплаты: обход узла собирает пакет в начале суток и отправляет кассиру
// один платёж. В настоящем времени пакета не дождаться до полуночи, поэтому
// сценарий идёт в сюите сжатого времени (bin/run-marketplace-keu-all.mjs):
// заказ засева mktkeu:01-common принят на участке, сутки стенда короче минуты,
// и к началу сценария пакет поставщика уже отправлен кассиру.
//
// Фикстура: sidorov — поставщик засева (ROLES.supplier в api-tests).

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
  fixture: 'sidorov',
  fixtures: ['sidorov'],
};

export default async ({ page, shot, expect }) => {
  // История выплат — перспектива поставщика засева, не председателя.
  const fixture = loadFixture('sidorov');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/payments`, {
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
    'Стол поставщика «Выплаты»: реквизиты для выплат и пакеты выплаты. Пакет объединяет заказы поставщика, принятые за сутки: сумма, состояние, дата, число заказов, реквизиты и назначение по договору.',
    {
      expect: async (p) => {
        // Пустой список означал бы, что обход выплат не собрал пакет.
        await expect(p.locator('.payout-card').first()).toBeVisible({ timeout: 120000 });
      },
    },
  );
};
