// Сценарий: orderer-стол «Каталог витрины» (/market/catalog).
// На стенде после reboot:extra + одобрения председателем offer'а
// «Берёзовый сок ПК «Восход» (демо)» (Story 3.6) каталог содержит
// один CatalogOfferCard (UX-DR10) в статусе «Опубликовано».

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  mode: 'docs',
  feature: 'marketplace.offer',
  cases: ['mkt.offer.happy.03'],
  prepare: ['marketplace:01-l1-accept', 'marketplace:02-branches', 'marketplace:03-assign-branches', 'marketplace:04-supplier', 'marketplace:05-sign-offer'],
  title: 'Стол заказчика — каталог витрины',
  docPath: 'new/marketplace/orderer/catalog.md',
  assetsDir: 'assets/new/marketplace/orderer/catalog',
  role: 'user',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
};

async function signAllAgreements(page) {
  for (let i = 0; i < 8; i++) {
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      if (portals.length === 0) return false;
      const top = portals[portals.length - 1];
      const btn = Array.from(top.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(3500);
  }
}

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ekaterina');

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-catalog-with-offer',
    'Каталог витрины глазами заказчицы. Сверху — выбранный пункт выдачи, его можно сменить. Карточка предложения показывает категорию, цену для заказчика, доступный остаток и поставщика; кнопка «В корзину» начинает оформление заказа.',
    {
      expect: async (p) => {
        // Каталог обязан содержать одобренное предложение: пустая витрина
        // здесь означала бы, что модерация не довела товар до заказчика.
        await expect(p.locator('text=Опубликовано').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=В корзину').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
