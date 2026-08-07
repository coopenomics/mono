// Сценарий: Поставщик видит входящие заказы по своим Offer'ам.
// Эпик 4 / Story 4.5 — read-обзор заказов где supplier = текущий пайщик.
//
// Канон OrderCard с role='offerer'. Фильтр по статусу через q-tabs.
// Действия по акцепту партии — на отдельной странице «Подготовка отгрузки».
//
// Фикстура: ivanpetrov (как и offer-create.mjs — единая модель пайщика
// для marketplace MVP scenarios).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, env, cleanViteOverlays } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

async function signAllAgreements(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(500);

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

export const meta = {
  title: 'Входящие заказы поставщика',
  docPath: 'new/marketplace/offerer/incoming-orders.md',
  assetsDir: 'assets/new/marketplace/offerer/incoming-orders',
  role: 'user',
  fixture: 'ivanpetrov',
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('ivanpetrov');
  // Флаг harness:noBranchOverlay читается в watch-branch-overlay при mount'е
  // процесса (на первом auth-tick), а не реактивно на изменение localStorage.
  // Поэтому ставим его через addInitScript ДО loginAs — иначе оверлей «Выберите
  // КУ» рендерится первым и перекрывает страницу incoming-orders.
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await signAllAgreements(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/incoming-orders`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Входящие заказы', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-overview',
    'Стол поставщика: лента входящих заказов от пайщиков. Фильтр по статусу через табы — «Все», «Ждут моего акцепта», «Индивидуальные ожидающие», «Приняты», «Поставка готова», «Приняты кооперативом», «Получены», «Отменены». Polling 15s.',
  );

  const pendingTab = page.locator('[role="tab"]:has-text("Ждут моего акцепта"), button:has-text("Ждут моего акцепта")').first();
  if (await pendingTab.isVisible().catch(() => false)) {
    await pendingTab.click().catch(() => {});
    await page.waitForTimeout(900);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-pending-filter',
      'Фильтр «Ждут моего акцепта» — заказы в статусе ACCEPTED_PENDING_SUPPLIER, которые поставщику нужно принять или отказаться через TakeoverDialog Эпика 5 на /market-supplier/supply-prep.',
    );
  }

  // Шаг 4 magistral II: поставщик акцептует индивидуальный заказ кликом
  // «Принять» на карточке. Backend выполняет mutation
  // marketplaceAcceptIndividualOrder → on-chain acceptorder → Order
  // переходит в ACCEPTED.
  const individualTab = page.locator('[role="tab"]:has-text("Индивидуальные ожидающие"), button:has-text("Индивидуальные ожидающие")').first();
  if (await individualTab.isVisible().catch(() => false)) {
    await individualTab.click().catch(() => {});
    // Ждём конкретно карточку заказа или empty-state — спиннер q-inner-loading
    // отображается пока fetchSupplierOrders в полёте.
    await page.locator('.mp-order-card, .mp-incoming-orders__empty').first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(800);
    await cleanViteOverlays(page);
    await shot(
      page,
      '03-individual-pending',
      'Фильтр «Индивидуальные ожидающие» — заказы со cycle_type=individual в статусе ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL. Поставщик решает по каждому отдельно: «Принять» (mutation marketplaceAcceptIndividualOrder) или «Отказать» с указанием причины.',
    );

    const acceptBtn = page.locator('button:has-text("Принять")').first();
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      // Ждём Notify «Заказ принят» (positive). Был false-positive на `Принят`,
      // т.к. это часть названия вкладки «Приняты» — её текст уже в DOM до клика.
      await page.waitForFunction(
        () => {
          const notifs = document.querySelectorAll('.q-notification__message');
          for (const n of notifs) {
            if ((n.textContent || '').includes('Заказ принят')) return true;
          }
          return false;
        },
        { timeout: 25000 },
      ).catch(() => {});
      await page.waitForTimeout(1500);
      await cleanViteOverlays(page);
      await shot(
        page,
        '04-after-accept',
        'После клика «Принять»: Notify «Заказ принят» (positive), Order переходит в статус ACCEPTED, исчезает из таба «Индивидуальные ожидающие» и появляется в табе «Приняты». Заблокированные средства пайщика остаются под BLOCK до выдачи имущества.',
        { preserveNotifications: true },
      );
    }
  }
};
