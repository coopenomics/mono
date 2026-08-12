// Сценарий: operator-стол «Склад моего КУ» (Story 9.1).
// Таблица marketplace_inventory отфильтрована по braname; per-row статусы
// (LABELED / ISSUED / RETURNED / WRITTEN_OFF), фильтры по статусу/orderer,
// summary count by status. Backend: Warehouse: ['read:own-KU'].

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
  mode: 'docs',
  feature: 'marketplace.supply',
  cases: ['mkt.supply.happy.04'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
  title: 'Стол ПВЗ — склад моего кооперативного участка',
  docPath: 'new/marketplace/operator/inventory-list.md',
  assetsDir: 'assets/new/marketplace/operator/inventory-list',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot }) => {
  // Склад scoped `read:own-KU` — логинимся председателем КУ Красногорск (chairkrg),
  // владельцем КУ `krg`, иначе таблица наклеек пуста.
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  // chairkrg при первом входе подписывает онбординг-соглашения (on-chain),
  // иначе их takeover-диалог перекрывает страницу склада.
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-operator-warehouse',
    `«Склад моего КУ» председателя КУ: фильтры (код КУ, состояние наклейки, заказчик) и пустая таблица до запроса. URL: \`${page.url()}\`.`,
  );

  // Ввести код КУ и обновить — показать промаркированные наклейки магистрали II
  const filled = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const target = inputs.find((i) => {
      const field = i.closest('.q-field');
      return field && /код кооперативного участка/i.test(field.textContent || '');
    });
    if (!target) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(target, 'krg');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  if (filled) {
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.q-btn'));
      const b = btns.find((x) => /обновить/i.test((x.textContent || '').trim()));
      if (b) b.click();
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-warehouse-loaded',
      `Склад КУ «krg» после запроса: таблица наклеек с штрих-кодом, товаром, заказчиком, единицами, состоянием и датой маркировки.`,
    );
  }
};
