// Сценарий: история заказов кооперативного участка (стол ПВЗ).
//
// Оператор и председатель КУ видят все заказы своего участка со статусами —
// от оформления до выдачи. На стенде после сюиты в списке заказы Екатерины.
//
// Фикстура: председатель КУ Красногорск (chairkrg) — операционные права
// оператора и председателя КУ на столе ПВЗ идентичны.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'История заказов участка',
  docPath: 'new/marketplace/operator/orders-history.md',
  assetsDir: 'assets/new/marketplace/operator/orders-history',
  role: 'user',
  mode: 'docs',
  feature: 'marketplace.order',
  cases: ['mkt.order.ui.01'],
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('chairkrg');
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-orders-history',
    'История заказов участка на столе ПВЗ: все заказы, привязанные к этому кооперативному участку, со статусами. Карточка заказа открывается по клику — оператор видит состав, суммы и путь заказа.',
    {
      expect: async (p) => {
        await expect(p.locator('text=/[Зз]аказ/').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
