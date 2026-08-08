// Сценарий: admin-стол «Модерация предложений» (Эпик 3 / Story 3.6).
// Председатель видит ленту offer'ов в статусе PENDING_MODERATION,
// поданных поставщиками через `marketplaceCreateOffer`. Одобрение через
// `marketplaceApproveOffer` переводит offer в APPROVED → виден в публичном
// каталоге Story 3.5. Канон UI — CatalogOfferCard (UX-DR10) с slot actions.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  mode: 'docs',
  feature: 'marketplace.offer',
  cases: ['mkt.offer.happy.02'],
  prepare: ['marketplace:01-l1-accept', 'marketplace:02-branches', 'marketplace:03-assign-branches', 'marketplace:04-supplier'],
  title: 'Стол председателя — модерация предложений',
  docPath: 'new/marketplace/chairman/offer-moderation.md',
  assetsDir: 'assets/new/marketplace/chairman/offer-moderation',
  role: 'chairman',
};

export default async ({ page, shot, expect }) => {
  // Network probe регистрируем ДО любого navigate — иначе можем пропустить
  // mutation на startup. Считаем ВСЕ POST на /v1/graphql.
  let approveSent = false;
  let approveStatus = null;
  let allGraphqlPosts = 0;
  page.on('request', (req) => {
    if (req.url().includes('/v1/graphql') && req.method() === 'POST') {
      allGraphqlPosts += 1;
      try {
        const body = req.postData() || '';
        if (/approveOffer|ApproveOffer/.test(body)) approveSent = true;
      } catch {}
    }
  });
  page.on('response', async (res) => {
    if (approveSent && approveStatus === null && res.url().includes('/v1/graphql')) {
      try {
        const body = await res.text();
        if (body.includes('approveOffer')) approveStatus = res.status();
      } catch {}
    }
  });
  page.on('pageerror', (err) => console.log(`[page-error] ${err.message}`));

  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/moderation`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  // Ждём заголовок страницы — надёжнее timeout'а на холодный Vite optimizeDeps.
  await page.locator('text="Модерация предложений"').first()
    .waitFor({ state: 'visible', timeout: 90000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-moderation-list',
    `Лента offer'ов в статусе PENDING_MODERATION, ожидающих одобрения председателем. URL: \`${page.url()}\`. Каждая карточка — CatalogOfferCard (UX-DR10) со статус-чипом «На модерации» и per-card action «Одобрить».`,
  );

  // Если в ленте есть хотя бы один offer — открыть диалог подтверждения и снять.
  const firstApprove = page.locator('.q-card button:has-text("Одобрить")').first();
  if (await firstApprove.count()) {
    await firstApprove.click();
    // Quasar Dialog имеет анимацию ~300ms; до конца transition её inner
    // получает actual visibility. Раньше ждали 700ms — мало для слабой машины.
    await page.locator('.q-dialog__inner').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(800);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-moderation-confirm-dialog',
      'Диалог подтверждения одобрения. По «Одобрить» offer переходит в статус APPROVED и сразу появляется в публичном каталоге Story 3.5. По «Отмена» статус остаётся PENDING_MODERATION.',
    );

    // OK-кнопка Quasar Dialog. Теперь когда SDK содержит Mutations.Marketplace.ApproveOffer,
    // onOk callback в ChairmanModerationPage реально дойдёт до approveOffer и
    // mutation пойдёт в /v1/graphql. Это force-click чтобы обойти возможные
    // pointer-events overlay'и.
    const okBtn = page.locator('.q-dialog__inner button:has-text("Одобрить")').first();
    await okBtn.waitFor({ state: 'visible', timeout: 5000 });
    await okBtn.click({ force: true });

    // Ждём пока mutation реально отправится — Apollo может холодно стартануть.
    let waited = 0;
    while (!approveSent && waited < 10000) {
      await page.waitForTimeout(200);
      waited += 200;
    }
    console.log(`[offer-moderation] approve mutation sent=${approveSent} status=${approveStatus} waitedMs=${waited} totalGraphqlPosts=${allGraphqlPosts}`);

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await cleanViteOverlays(page);
    await shot(
      page,
      '03-moderation-after-approve',
      'Лента модерации после одобрения: предложение пропадает из очереди и становится доступным в публичном каталоге кооператива.',
      {
        expect: async (p) => {
          // Проверяем результат модерации, а не факт клика: очередь обязана
          // опустеть, иначе одобрение не доехало до сервера.
          await expect(p.locator('text=Очередь модерации пуста').first()).toBeVisible({ timeout: 20000 });
        },
      },
    );
  }
};
