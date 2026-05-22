// Сценарий: orderer-стол «Оформление заказа», магистраль II «вход в каталог».
//
// Полный путь пайщика после фоллоуапа Эпика 1 (вариант A):
//   1. Логин ekaterina + подпись 4 системных agreements (Wallet ЦПП и т.п.).
//   2. Переход на L3 онбординг marketplace (/market/onboarding/member-cpp).
//   3. Канон-виджет OnboardingCPPGate показывает оферту 1101 + Положение ЦПП;
//      клик «Подписать оферту» → mutation `marketplaceSignOnboardingOffer` →
//      backend сам делает on-chain `wallet::signagree` (program_id=2,
//      draft_id из soviet::coagreements). После успеха —
//      requires_gate=false, source='agreement_signed', UI редиректит в catalog.
//   4. В каталоге кликаем «Заказать» на APPROVED Offer'е, заполняем
//      OrderCreateDialog (quantity + delivery_braname), submit вызывает
//      `marketplaceCreateOrder`. По успеху Notify «Заказ создан».
//
// Это закрытие magistral II: ekaterina впервые проходит весь L3 onboarding
// прямо со «Стола заказов», без редиректа в core Registrator-мастер.

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

  // === Шаг 1: L3 онбординг marketplace ===
  // Сначала идём на gate-страницу. Если пайщик ещё не подписал ЦПП —
  // увидит OnboardingCPPGate с двумя документами. Если уже подписал —
  // banner «Вы уже подключены». Сценарий поддерживает оба исхода:
  // на свежей цепочке первый прогон снимет полный flow; повторные
  // прогоны пропустят подпись (уже зафиксирована on-chain).
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/onboarding/member-cpp`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  // Vite optimizeDeps на холодном старте занимает >20s; ждём отрисовки страницы
  // (mp-onboarding-gate / banner / любая q-page) — иначе ловим пустой Quasar
  // bootstrap-спиннер и сценарий проваливается на gate.isVisible.
  await page.locator('.mp-onboarding-gate, text=Вы уже подключены к Marketplace, .q-page').first()
    .waitFor({ state: 'visible', timeout: 90000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  const gate = page.locator('.mp-onboarding-gate').first();
  const alreadyBanner = page.locator('text=Вы уже подключены к Marketplace').first();

  // Debug: всегда снимаем member-cpp страницу, чтобы понимать что
  // backend вернул в onboarding state, даже если ни gate, ни banner не показались.
  await cleanViteOverlays(page);
  await shot(
    page,
    '00-marketplace-onboarding-page',
    'Debug: страница `/market/onboarding/member-cpp` после загрузки backend `marketplaceOnboardingState`. Если ниже видим gate с двумя документами — пайщик ещё не подписал; banner «Вы уже подключены» — подписал; «возможен временный рассинхрон» — backend вернул что gate не нужен, но и agreement_signed не зафиксирован.',
  );

  if (await gate.isVisible().catch(() => false)) {
    await cleanViteOverlays(page);
    await shot(
      page,
      '01-marketplace-onboarding-gate',
      'L3 gate ЦПП «Стол заказов»: канон-виджет OnboardingCPPGate (UX-DR17) показывает два документа — Оферту на присоединение и Положение ЦПП. Пайщик отмечает обязательные чекбоксы и нажимает «Подписать оферту» — backend выполняет on-chain wallet::signagree (program_id=2) без редиректа в core Registrator-мастер.',
    );

    // Проставить обязательные чекбоксы (gate проверяет required+allRequiredAccepted).
    const checkboxes = gate.locator('.q-checkbox');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = checkboxes.nth(i);
      const aria = await cb.getAttribute('aria-checked').catch(() => null);
      if (aria !== 'true') {
        await cb.click();
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(300);

    const signBtn = gate.locator('button:has-text("Подписать оферту")').first();
    await signBtn.waitFor({ state: 'visible', timeout: 5000 });
    await signBtn.click();

    // Ждём либо Notify «Оферта подписана» + редирект на /market/catalog,
    // либо banner «уже подключены», либо отрисовку каталога (router push).
    await page.waitForFunction(
      () => {
        const u = window.location.href;
        if (u.includes('/market/catalog')) return true;
        const txt = document.body.innerText || '';
        return txt.includes('Оферта ЦПП') || txt.includes('Вы уже подключены');
      },
      { timeout: 30000 },
    ).catch(() => {});
    await page.waitForTimeout(1500);
    await cleanViteOverlays(page);
  } else if (await alreadyBanner.isVisible().catch(() => false)) {
    await cleanViteOverlays(page);
    await shot(
      page,
      '01-marketplace-onboarding-already',
      'Пайщик уже прошёл L3 онбординг ЦПП «Стол заказов» (повторный заход): banner «Вы уже подключены к Marketplace» с кнопкой «К каталогу». Backend `marketplaceOnboardingState` отдал requires_gate=false, source=\'agreement_signed\'.',
    );
  }

  // === Шаг 2: переход на каталог ===
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  // Ждём отрисовки каталога (offer-card ИЛИ empty-state) — пустой спиннер == Vite ещё грузит.
  await page.locator('button:has-text("Заказать"), .mp-catalog-empty, .q-page').first()
    .waitFor({ state: 'visible', timeout: 90000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  // === Шаг 3: открыть OrderCreateDialog ===
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
    '02-order-create-dialog',
    'Диалог оформления заказа: q-input «Количество», q-select «ПВЗ доставки», итоговая сумма (цена × количество), кнопки «Отмена» и «Подтвердить заказ». Открывается при клике «Заказать» на карточке APPROVED offer\'а в каталоге.',
  );

  const qty = dialog.locator('input[type="number"]').first();
  await qty.click({ clickCount: 3 });
  await qty.fill('2');
  await page.waitForTimeout(300);

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
    '03-order-create-filled',
    'Форма с количеством 2 и выбранным ПВЗ доставки. Итоговая сумма обновляется немедленно (price_per_unit × quantity). Кнопка «Подтвердить заказ» становится активной, когда оба поля валидны.',
  );

  // === Шаг 4: submit + Notify «Заказ создан» ===
  const confirmBtn = dialog.locator('button:has-text("Подтвердить заказ")').first();
  await confirmBtn.click();

  await page.locator('.q-notification').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot(
    page,
    '04-order-created',
    'Magistral II разблокирована: после подписи L3-оферты submit `marketplaceCreateOrder` проходит pipeline (createorder → o.mkt.assign → TRANSFER из w.wal.member в w.mkt.member). UI показывает Notify «Заказ создан». В Witkin/MyOrders появляется новый PENDING-заказ.',
    { preserveNotifications: true },
  );
};
