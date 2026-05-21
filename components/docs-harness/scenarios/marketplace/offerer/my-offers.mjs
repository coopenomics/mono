// Сценарий: Поставщик видит свои Offer'ы во всех 4 статусах.
// Эпик 3 / Story 3.4 — обзор Предложений поставщика.
//
// Канон CatalogOfferCard, client-side фильтр по статусу через q-btn-toggle,
// поиск по названию. Для REJECTED — reject_reason под карточкой.
//
// Фикстура: sidorov (Дмитрий Николаевич Сидоров), поставщик.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, env, cleanViteOverlays } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Мои предложения: каталог Offer\'ов поставщика',
  docPath: 'new/marketplace/offerer/my-offers.md',
  assetsDir: 'assets/new/marketplace/offerer/my-offers',
  role: 'user',
  fixture: 'sidorov',
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('sidorov');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market/my-offers`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Мои предложения', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-overview',
    'Стол поставщика «Мои предложения»: 4 stat-карточки в шапке (всего / активных / на модерации / отклонены), поиск по названию и фильтр по статусу. Карточки CatalogOfferCard со статусом-чипом (Опубликовано / На модерации / Отклонено / Снято).',
  );

  // Переключиться на «На модерации» — критичный статус для нового поставщика.
  const pendingBtn = page.locator('button:has-text("На модерации")').first();
  if (await pendingBtn.isVisible().catch(() => false)) {
    await pendingBtn.click();
    await page.waitForTimeout(700);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-pending-filter',
      'Фильтр «На модерации» — Offer\'ы в статусе PENDING_MODERATION ждут решения председателя на /market/moderation. После APPROVED попадают в публичный каталог Story 3.5.',
    );
  }
};
