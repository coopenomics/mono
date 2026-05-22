// Сценарий: orderer-стол «Оформление заказа».
// MVP-форма — q-dialog поверх каталога: при клике «Заказать» открывается
// OrderCreateDialog с полями quantity + delivery_braname; submit вызывает
// `marketplaceCreateOrder`. По успеху — Notify «Заказ создан», каталог
// перезагружается, остаток APPROVED Offer'а уменьшается.

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
  title: 'Стол заказчика — оформление заказа',
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

  const orderBtn = page.locator('button:has-text("Заказать")').first();
  if (!(await orderBtn.count())) {
    throw new Error('В каталоге нет CatalogOfferCard с действием «Заказать» — нужен хотя бы один APPROVED offer (chairman/offer-moderation).');
  }
  await orderBtn.click();

  const dialog = page.locator('.mp-order-create-dialog').first();
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);
  await shot(
    page,
    '01-order-create-dialog',
    'Диалог оформления заказа: q-input «Количество», q-select «ПВЗ доставки», итоговая сумма (цена × количество), кнопки «Отмена» и «Подтвердить заказ». Открывается при клике «Заказать» на карточке APPROVED offer\'а в каталоге.',
  );

  const qty = dialog.locator('input[type="number"]').first();
  await qty.click({ clickCount: 3 });
  await qty.fill('2');
  await page.waitForTimeout(300);

  // Открыть q-select «ПВЗ доставки» и выбрать первый option из выпадашки.
  const branchSelect = dialog.locator('.q-select').first();
  await branchSelect.click();
  await page.waitForTimeout(400);
  const firstOption = page.locator('.q-menu .q-item').first();
  await firstOption.waitFor({ state: 'visible', timeout: 5000 });
  await firstOption.click();
  await page.waitForTimeout(300);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-order-create-filled',
    'Форма с количеством 2 и выбранным ПВЗ доставки. Итоговая сумма обновляется немедленно (price_per_unit × quantity). Кнопка «Подтвердить заказ» становится активной, когда оба поля валидны.',
  );

  const confirmBtn = dialog.locator('button:has-text("Подтвердить заказ")').first();
  await confirmBtn.click();

  await page.locator('.q-notification').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(
    page,
    '03-order-create-no-agreement',
    'Текущий блокер магистрали II: у тестового пайщика не подписана ЦПП «Стол заказов» (program_id=2, draft_id=699 в `soviet::coagreements`). Backend проходит pipeline вплоть до on-chain `marketplace::createorder` → внутреннего `o.mkt.assign` (TRANSFER из `w.wal.member` в `w.mkt.member`), который требует записи в `wallet::users.programs[]` с program_id=2. Контракт корректно валит assertion «walletop: у пайщика X не подписано соглашение program_id=2 для кошелька w.mkt.member». UI показывает читаемое сообщение через `extractErrorMessage()`. Корректное разблокирование — реализовать factory adapter 1100.MarketplaceOfferTemplate в `components/factory/src/Actions` и L3 mutation `marketplaceSignOnboardingOffer` (фоллоуап Эпика 1, см. controller/extensions/marketplace/application/onboarding/README.md); после этого пайщик подпишет ЦПП через UI «Стол заказов — пакет ЦПП» (страница `onboarding/member-pick-cpp`), и submit отработает с Notify «Заказ создан».',
    { preserveNotifications: true },
  );
};
