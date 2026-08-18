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

  // Карточка предложения: полное описание, фотографии, цена и остаток.
  await page.locator("text=Мёд цветочный").first().click();
  await page.waitForURL(/\/market\/offer\//, { timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    "02-offer-detail",
    "Карточка предложения открывается по клику из каталога: фотографии, полное описание, цена за единицу с учётом наценки кооператива, поставщик и условия поставки на выбранный пункт выдачи.",
    {
      expect: async (p) => {
        await p.locator("text=Мёд цветочный").first().waitFor({ state: "visible", timeout: 20000 });
      },
    },
  );

  // Диалог количества: показываем, но в корзину НЕ кладём — состояние корзины
  // принадлежит сценарию order-create, лишняя позиция сломала бы его суммы.
  await page.locator('button:has-text("В корзину")').first().click();
  await page.waitForTimeout(1500);

  await shot(
    page,
    "03-quantity-dialog",
    "Кнопка «В корзину» открывает выбор количества. Количество указывается в единицах товара (кг, литры, штуки); итоговая сумма пересчитывается сразу. «Добавить» кладёт позицию в корзину.",
    {
      expect: async (p) => {
        await p.locator(".q-dialog").first().waitFor({ state: "visible", timeout: 10000 });
      },
    },
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
};
