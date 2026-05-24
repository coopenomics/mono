// Сценарий: orderer-стол «Мои заказы» (/:coopname/market/my-orders).
// Снимает раздел «Мои заказы» пайщицы Екатерины (Story 4.6): пустой список,
// строку фильтров по статусам, состояние «нет заказов». Цель — задокументировать
// orderer-таблицу на старте стенда, до того как пайщик впервые оформил заказ.
//
// Фикстура: ekaterina (создана сценарием extension-gate; в её state уже
// подписаны общие соглашения, повторного онбординга на стенде не будет).

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
  title: 'Стол заказчика — «Мои заказы» (пустой список)',
  docPath: 'new/marketplace/orderer/orders.md',
  assetsDir: 'assets/new/marketplace/orderer/orders',
  role: 'user',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
};

// Пройти онбординг общих соглашений (4 диалога ЦПП Кошелька + базовые)
async function signAllAgreements(page) {
  let dialogsSigned = 0;
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
    dialogsSigned += 1;
    await page.waitForTimeout(3500);
  }
  return dialogsSigned;
}

export default async ({ page, shot }) => {
  const fixture = loadFixture('ekaterina');

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  // Дать платформе собрать первый онбординг-документ (если стенд считает
  // ekaterina впервые залогиненной)
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);

  // Если онбординг ещё активен — подписываем все 4 общих соглашения
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // --- 01. Заходим в /market/my-orders ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/my-orders`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  // Если каталог встретил гейтом — пробуем подписать ещё раз
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-my-orders-empty',
    `Раздел «Мои заказы» пайщицы Екатерины. URL: \`${page.url()}\`. Заказов ещё нет.`,
  );

  // --- 02. Раскрытие фильтра по статусу (если есть селект) ---
  const filterOpened = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label, .q-field__label'));
    const statusLabel = labels.find((l) => /статус/i.test(l.textContent || ''));
    if (!statusLabel) return false;
    const field = statusLabel.closest('.q-field, .q-select');
    if (!field) return false;
    field.scrollIntoView({ block: 'center', behavior: 'instant' });
    field.click();
    return true;
  });
  if (filterOpened) {
    await page.waitForTimeout(800);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-status-filter-open',
      `Раскрытый селектор фильтра по статусу заказа: какие статусы доступны orderer'у.`,
    );
  }
};
