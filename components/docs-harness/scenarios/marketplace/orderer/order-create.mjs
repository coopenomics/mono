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
  // Pre-flight pre-fund Main Wallet: marketplaceCreateOrder требует положительный
  // баланс program_id=1 у пайщика, иначе backend тихо отказывает (см. task #176).
  // Идемпотентно для смысла «есть деньги» — каждый запуск добавляет ещё одну
  // эмиссию (баланс растёт), что безопасно для dev-стенда.
  prepare: ['marketplace-deposits:fund'],
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

  // Сетевая телеметрия — Quasar Notify положительный живёт 2.5с и Playwright
  // может его пропустить (см. offer-create.mjs). Реальный success-сигнал —
  // mutation вернула 200 OK без GraphQL errors.
  let createOrderSent = false;
  let createOrderStatus = null;
  let createOrderBody = null;
  page.on('request', (req) => {
    if (req.url().includes('/v1/graphql') && req.method() === 'POST') {
      try {
        const body = req.postData() || '';
        if (/marketplaceCreateOrder|MarketplaceCreateOrder/.test(body)) {
          createOrderSent = true;
        }
      } catch {}
    }
  });
  page.on('response', async (res) => {
    if (createOrderSent && createOrderStatus === null && res.url().includes('/v1/graphql')) {
      try {
        const body = await res.text();
        if (body.includes('marketplaceCreateOrder')) {
          createOrderStatus = res.status();
          createOrderBody = body.slice(0, 1200);
        }
      } catch {}
    }
  });

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
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/onboarding/member-cpp`, {
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
    // q-item tag="label" обернул и q-checkbox, и текст документа — Quasar
    // распознает клик по label и обновляет v-model. Раньше кликали по
    // `.q-checkbox` корню, но Playwright не всегда триггерит v-model на
    // корневом div (зависит от Quasar версии) — клик по label-родителю
    // работает надёжнее.
    const items = gate.locator('.q-list > .q-item');
    const itemCount = await items.count();
    for (let i = 0; i < itemCount; i++) {
      await items.nth(i).click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(400);

    const signBtn = gate.locator('button:has-text("Подписать оферту")').first();
    await signBtn.waitFor({ state: 'visible', timeout: 5000 });
    // Sanity: если кнопка disabled — значит чекбоксы не сработали; кидаем
    // понятную ошибку вместо silent click no-op.
    const disabled = await signBtn.isDisabled();
    if (disabled) {
      const checkedDump = await page.evaluate(() => {
        const cbs = Array.from(document.querySelectorAll('.mp-onboarding-gate .q-checkbox'));
        return cbs.map((c) => ({
          aria: c.getAttribute('aria-checked'),
          truthy: c.classList.contains('q-checkbox--true') || !!c.querySelector('.q-checkbox__inner--truthy'),
        }));
      });
      throw new Error(
        `[order-create] кнопка «Подписать оферту» disabled после кликов по чекбоксам. State: ${JSON.stringify(checkedDump)}`,
      );
    }
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
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
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
  // MP_ORDER_OFFER (подстрока названия) выбирает конкретную карточку — иначе
  // берём первую. Нужно чтобы детерминированно заказывать offer нужного
  // cycle_type (individual/volume_based/open_subscription), а не первый в ленте.
  const offerNeedle = process.env.MP_ORDER_OFFER;
  let orderBtn;
  if (offerNeedle) {
    const card = page
      .locator('.mp-catalog-offer-card', { hasText: offerNeedle })
      .filter({ has: page.locator('button:has-text("Заказать")') })
      .first();
    if (!(await card.count())) {
      throw new Error(`[order-create] карточка offer'а с «${offerNeedle}» и кнопкой «Заказать» не найдена в каталоге`);
    }
    await card.scrollIntoViewIfNeeded();
    orderBtn = card.locator('button:has-text("Заказать")').first();
  } else {
    orderBtn = page.locator('button:has-text("Заказать")').first();
  }
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

  const orderQty = process.env.MP_ORDER_QTY || '2';
  const qty = dialog.locator('input[type="number"]').first();
  await qty.click({ clickCount: 3 });
  await qty.fill(orderQty);
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

  // === Шаг 4: submit + assert через network telemetry ===
  // Quasar Notify положительный живёт 2.5с (default) — Playwright опрашивает
  // ~80ms и обычно ловит, но при тормозящем dev-сервере успевает пропустить.
  // Source-of-truth = GraphQL mutation response: 200 без `errors` ⇒ Order создан
  // в БД (см. backend log MarketplaceOrderCreateService Order ... создан).
  const confirmBtn = dialog.locator('button:has-text("Подтвердить заказ")').first();
  await confirmBtn.click();

  let waited = 0;
  while (!createOrderSent && waited < 10000) {
    await page.waitForTimeout(200);
    waited += 200;
  }
  if (!createOrderSent) {
    throw new Error('[order-create] submit нажат, но мутация marketplaceCreateOrder НЕ ушла');
  }
  let waitedRes = 0;
  while (createOrderStatus === null && waitedRes < 30000) {
    await page.waitForTimeout(200);
    waitedRes += 200;
  }
  console.log(
    `[order-create] marketplaceCreateOrder sent=${createOrderSent} status=${createOrderStatus} waitedMs=${waited}+${waitedRes}`,
  );
  if (createOrderStatus !== 200) {
    console.log(`[order-create] response body: ${createOrderBody}`);
    throw new Error(`[order-create] mutation вернула статус ${createOrderStatus}`);
  }
  if (createOrderBody && /"errors":\s*\[/.test(createOrderBody)) {
    throw new Error(`[order-create] mutation вернула GraphQL errors: ${createOrderBody}`);
  }

  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);
  await shot(
    page,
    '04-order-created',
    'Magistral II разблокирована: после подписи L3-оферты submit `marketplaceCreateOrder` проходит pipeline (createorder → o.mkt.assign → TRANSFER из w.wal.member в w.mkt.member). Диалог закрыт, в карточке offer\'а счётчик «Доступно» уменьшился на quantity. В Witkin/MyOrders появится новый PENDING-заказ после parser sync.',
    { preserveNotifications: true },
  );
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
};
