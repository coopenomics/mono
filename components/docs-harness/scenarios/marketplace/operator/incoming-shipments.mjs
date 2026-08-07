// Сценарий: operator-стол «Ожидаемые поставки» (Поток IV шаг 1).
// Лента партий поставщиков, направленных на КУ оператора. Own-KU scoping
// через marketplaceListShipmentsByBraname + isMemberOfBranch — оператор
// видит только партии своего участка. braname автоподставляется из
// marketplaceWhoAmI.branches.

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
  title: 'Стол ПВЗ — ожидаемые поставки',
  docPath: 'new/marketplace/operator/incoming-shipments.md',
  assetsDir: 'assets/new/marketplace/operator/incoming-shipments',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot }) => {
  // Поставки scoped `read:own-KU` — логинимся председателем/оператором КУ
  // Красногорск (chairkrg), владельцем КУ `krg`, иначе лента пуста.
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/reception`, {
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
    '01-incoming-shipments',
    `«Ожидаемые поставки» оператора ПВЗ: код КУ \`krg\` подставлен автоматически, лента партий с поставщиком, вариантом доставки, суммой и состоянием. URL: \`${page.url()}\`.`,
  );
};
