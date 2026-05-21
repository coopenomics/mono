// Сценарий: orderer-стол «Оформление заказа» (Эпик 4 / Story 4.1).
// На текущей реализации `onSelectOffer` в MarketplaceCatalogPage — это
// заглушка: клик по «Заказать» вызывает Quasar Notify с сообщением
// «Создание заказа на Offer X — будет доступно после Эпика 4». Полный
// диалог формы заказа (количество + ПВЗ доставки + подпись Membership)
// подключается следующим UI-PR'ом Эпика 4.

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
  title: 'Стол заказчика — оформление заказа (в разработке)',
  docPath: 'new/marketplace/orderer/order-create.md',
  assetsDir: 'assets/new/marketplace/orderer/order-create',
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

export default async ({ page, shot }) => {
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

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  // Клик «Заказать» на первой карточке — текущая реализация показывает Notify.
  const orderBtn = page.locator('button:has-text("Заказать")').first();
  const hasOrderBtn = await orderBtn.count();
  if (!hasOrderBtn) {
    throw new Error('В каталоге нет CatalogOfferCard с действием «Заказать» — нужен хотя бы один APPROVED offer (chairman/offer-moderation).');
  }
  await orderBtn.click();

  // Ждём появления Quasar Notify (.q-notification) с info-сообщением.
  // cleanViteOverlays удаляет .q-notification (см. harness.mjs:320) — поэтому
  // НЕ вызываем его перед shot, иначе тост уйдёт за миг до снимка.
  await page.locator('.q-notification').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);

  await shot(
    page,
    '01-order-create-stub-notify',
    `Текущая реализация «Заказать» — заглушка Story 4.1: при клике на карточку offer'а появляется уведомление «Создание заказа на Offer X — будет доступно после Эпика 4». URL: \`${page.url()}\`. Полный диалог формы заказа (количество, ПВЗ доставки, подпись Membership-заявки) подключается следующим UI-PR'ом Эпика 4.`,
    { preserveNotifications: true },
  );
};
