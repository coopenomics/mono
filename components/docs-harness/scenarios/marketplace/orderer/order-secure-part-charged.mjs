// Сценарий: карточка заказа пайщицы Екатерины — блок обеспечительной части
// паевого взноса после списания первого числа (коэффициент экономического
// участия, 99D-23): «Списано в членский взнос участка», «Возвращено на
// свободный паевой Стола заказов», «Ставка списания участка за месяц».
//
// Снимок берёт первый заказ со списанной обеспечительной частью; если на
// стенде такого заказа ещё нет, снимается карточка первого заказа как есть —
// блок обеспечительной части тогда в состоянии до списания.
//
// Фикстура: ekaterina.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Карточка заказа — обеспечительная часть после списания',
  docPath: 'new/marketplace/orderer/order-secure-part-charged.md',
  assetsDir: 'assets/new/marketplace/orderer/order-secure-part-charged',
  role: 'user',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
  mode: 'docs',
  feature: 'marketplace.order',
  cases: ['mkt.order.keu.ui.04'],
};

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ekaterina');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  // Заказ со списанной обеспечительной частью — по бейджу «Списана» в списке;
  // иначе первый заказ.
  const charged = page.locator('.order-card:has-text("Списана")').first();
  const card = (await charged.count()) ? charged : page.locator('.order-card').first();
  if (!(await card.count())) return;
  await card.click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  const block = page.locator('.order-secure-part').first();
  await block.scrollIntoViewIfNeeded().catch(() => {});
  await shot(
    page,
    '01-secure-part',
    'Блок обеспечительной части паевого взноса в карточке заказа. После списания первого числа три строки: сколько стало членским взносом участка, сколько вернулось пайщику на свободный паевой Стола заказов и по какой ставке участок списал за месяц. До списания — сумма, состояние и дата списания.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Обеспечительная часть паевого взноса').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
