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
import { loginAs, env, cleanViteOverlays, pickBranchIfAsked } from '../../../lib/harness.mjs';

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
  mode: 'docs',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
  feature: 'marketplace.order',
  cases: ['mkt.order.happy.02'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/incoming-orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Входящие заказы', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-overview',
    'Входящие заказы поставщика. Заказы пайщиков сгруппированы в партии по кооперативному участку: партия копится до минимального объёма поставки, но принять её можно в любой момент и меньшего объёма. Итог показан по себестоимости — членский взнос кооператива в него не входит.',
    {
      expect: async (p) => {
        // Заказ, оформленный заказчицей, обязан быть виден поставщику:
        // пустой список здесь означал бы разрыв в цепочке.
        await expect(p.locator('text=Берёзовый сок').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('button:has-text("Принять заказ")').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.locator('button:has-text("Принять заказ")').first().click();
  await page.waitForTimeout(7000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-after-accept',
    'После приёма заказ уходит из очереди ожидания и переходит в работу: следующий шаг поставщика — «Подготовка отгрузки». Средства заказчика остаются заблокированными до выдачи имущества на пункте выдачи.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Кнопка приёма обязана исчезнуть: её наличие означало бы, что
        // действие не доехало до сервера, а мы сняли «успех» вслепую.
        await expect(p.locator('button:has-text("Принять заказ")')).toHaveCount(0, { timeout: 20000 });
      },
    },
  );
};
