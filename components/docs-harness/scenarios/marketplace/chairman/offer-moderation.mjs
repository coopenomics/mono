// Сценарий: admin-стол «Модерация предложений» (Эпик 3 / Story 3.6).
// Председатель видит ленту offer'ов в статусе PENDING_MODERATION,
// поданных поставщиками через `marketplaceCreateOffer`. Одобрение через
// `marketplaceApproveOffer` переводит offer в APPROVED → виден в публичном
// каталоге Story 3.5. Канон UI — CatalogOfferCard (UX-DR10) с slot actions.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя — модерация предложений',
  docPath: 'new/marketplace/board/offer-moderation.md',
  assetsDir: 'assets/new/marketplace/board/offer-moderation',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/moderation`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-moderation-list',
    `Лента offer'ов в статусе PENDING_MODERATION, ожидающих одобрения председателем. URL: \`${page.url()}\`. Каждая карточка — CatalogOfferCard (UX-DR10) со статус-чипом «На модерации» и per-card action «Одобрить».`,
  );

  // Если в ленте есть хотя бы один offer — открыть диалог подтверждения и снять.
  const firstApprove = page.locator('button:has-text("Одобрить")').first();
  if (await firstApprove.count()) {
    await firstApprove.click();
    await page.waitForTimeout(700);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-moderation-confirm-dialog',
      'Диалог подтверждения одобрения. По «Одобрить» offer переходит в статус APPROVED и сразу появляется в публичном каталоге Story 3.5. По «Отмена» статус остаётся PENDING_MODERATION.',
    );

    // Подтвердить одобрение и снять обновлённую ленту.
    const okBtn = page.locator('.q-dialog button:has-text("Одобрить")').last();
    await okBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await cleanViteOverlays(page);
    await shot(
      page,
      '03-moderation-after-approve',
      'Лента модерации после одобрения. Одобренный offer пропадает из очереди и сразу доступен в публичном каталоге кооператива.',
    );
  }
};
