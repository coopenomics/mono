// Сценарий: orderer-стол «Мои заказы» (/:coopname/market/my-orders).
// Снимает раздел «Мои заказы» пайщицы Екатерины (Story 4.6): список её заказов
// карточками с номером, датой, кол-вом, суммой, ПВЗ и статусом, а также
// строку фильтр-табов по статусам (Все / Активные / Ждут поставщика / Приняты /
// Готовы к выдаче / Получены / Отменены). Цель — задокументировать orderer-таблицу
// на стенде с реальными заказами магистрали II.
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
  title: 'Стол заказчика — «Мои заказы»',
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
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, { waitUntil: 'domcontentloaded', timeout: 45000 });
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
    '01-my-orders',
    `Раздел «Мои заказы» пайщицы Екатерины. URL: \`${page.url()}\`. Список её заказов карточками: номер, дата, кол-во, сумма, ПВЗ и статус.`,
  );

  // --- 02. Фильтр «Получены»: переключаем кнопку q-btn-toggle ---
  const tabSwitched = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.q-btn-toggle .q-btn'));
    const target = btns.find((b) => /^получены$/i.test((b.textContent || '').trim()));
    if (!target) return false;
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    target.click();
    return true;
  });
  if (tabSwitched) {
    await page.waitForTimeout(1200);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-filter-received',
      `Фильтр-табы по статусу заказа. Выбран таб «Получены» — список сужается до завершённых заказов (статус «Выдан»).`,
    );
  }
};
