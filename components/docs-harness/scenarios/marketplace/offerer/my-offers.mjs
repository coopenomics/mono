// Сценарий: Поставщик видит свои Offer'ы во всех 4 статусах.
// Эпик 3 / Story 3.4 — обзор Предложений поставщика.
//
// Канон CatalogOfferCard, client-side фильтр через q-btn-toggle, поиск
// по названию. Для REJECTED — reject_reason под карточкой.
//
// Фикстура: ivanpetrov (единая модель пайщика для marketplace MVP).

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
  // docPath/assetsDir выровнены на existing offers.md (Vue-page = OffererMyOffers,
  // но MD-файл уже создан под именем offers.md с прозой из PRD; имя сценария
  // оставлено my-offers.mjs для совместимости с command line).
  title: 'Мои предложения: каталог Offer\'ов поставщика',
  docPath: 'new/marketplace/offerer/offers.md',
  assetsDir: 'assets/new/marketplace/offerer/offers',
  role: 'user',
  fixture: 'ivanpetrov',
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await signAllAgreements(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-offers`, {
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

  const pendingBtn = page.locator('button:has-text("На модерации")').first();
  if (await pendingBtn.isVisible().catch(() => false)) {
    await pendingBtn.click().catch(() => {});
    await page.waitForTimeout(700);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-pending-filter',
      'Фильтр «На модерации» — Offer\'ы в статусе PENDING_MODERATION ждут решения председателя на /market/moderation. После APPROVED попадают в публичный каталог Story 3.5.',
    );
  }
};
