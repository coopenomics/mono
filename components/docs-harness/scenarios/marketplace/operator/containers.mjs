// Сценарий: боксы и типы боксов на складе участка (Эпик 19).
//
// Бокс — тара со своим QR-кодом. Тип задаёт габариты и объём (тару закупают
// партиями), боксы заводятся партиями одного типа и получают сквозные коды
// BX-0001, BX-0002… Требует включённого containers_enabled (фаза 07).
//
// Повторный прогон терпим: тип и партия не пересоздаются, кадры снимаются
// с уже заведённых.
//
// Фикстура: председатель КУ Красногорск (chairkrg) — грант Container:manage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Боксы и типы боксов',
  docPath: 'new/marketplace/operator/containers.md',
  assetsDir: 'assets/new/marketplace/operator/containers',
  role: 'user',
  mode: 'docs',
  feature: 'marketplace.stock',
  cases: ['mkt.stock.ui.01'],
  prepare: ['marketplace:07-warehouse-config'],
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot, expect }) => {
  // Печатный лист QR-этикеток вызывает win.print() — в headless он не рисует
  // диалога, но глушим на всякий случай во всех фреймах.
  await page.addInitScript(() => { window.print = () => {}; });

  const fixture = loadFixture('chairkrg');
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);

  // ── Типы боксов ──
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse/types`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  const hasType = await page.locator('text=Ящик 60×40×30').count();
  if (!hasType) {
    await shot(
      page,
      '01-types-empty',
      'Вкладка «Типы боксов» до заведения первого типа. Тип задаёт габариты и объём тары, а не отдельный бокс: коробки закупают одинаковыми партиями, а объём нужен агрегатом — по нему считается перевозка боксов между участками.',
    );

    await page.locator('button:has-text("Тип боксов")').first().click();
    await page.waitForSelector('.q-dialog', { timeout: 10000 });
    await page.locator('.q-dialog .q-field:has-text("Название") input').first().fill('Ящик 60×40×30');
    await page.locator('.q-dialog .q-field:has-text("Длина") input').first().fill('60');
    await page.locator('.q-dialog .q-field:has-text("Ширина") input').first().fill('40');
    await page.locator('.q-dialog .q-field:has-text("Высота") input').first().fill('30');
    await page.locator('.q-dialog .q-field:has-text("Предельный вес") input').first().fill('25');
    await page.waitForTimeout(600);

    await shot(
      page,
      '02-type-dialog',
      'Заведение типа боксов: название и габариты в сантиметрах — так тару меряют на месте. Полезный объём в кубометрах считается сам; предельный вес — необязательное ограничение.',
    );

    await page.locator('.q-dialog button:has-text("Завести")').last().click();
    await page.waitForTimeout(2500);
  }

  await shot(
    page,
    '03-types-list',
    'Реестр типов боксов участка: габариты, объём и предельный вес. Дальше боксы заводятся партиями выбранного типа.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Ящик 60×40×30').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  // ── Боксы ──
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse/containers`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  const hasBoxes = await page.locator('text=BX-0001').count();
  if (!hasBoxes) {
    await page.locator('button:has-text("Завести боксы")').first().click();
    await page.waitForSelector('.q-dialog', { timeout: 10000 });
    await page.locator('.q-dialog .q-field:has-text("Сколько завести") input').first().fill('6');
    await page.locator('.q-dialog .q-field:has-text("Подпись партии") input').first().fill('Молочная тара');
    await page.waitForTimeout(600);

    await shot(
      page,
      '04-batch-dialog',
      'Партия боксов: тип, количество и подпись. Коды выдаются подряд (BX-0001, BX-0002…); сразу после заведения открывается лист QR-этикеток на печать — этикетки клеятся на тару.',
    );

    await page.locator('.q-dialog button:has-text("Завести")').last().click();
    await page.waitForTimeout(3000);
  }

  await shot(
    page,
    '05-containers-list',
    'Реестр боксов участка: код, тип, подпись партии и текущее место. Отмеченные боксы можно отправить на печать QR-этикеток повторно. При закрывающей подписи приёмки достаточно отсканировать бокс, чтобы принятое имущество легло на своё место.',
    {
      expect: async (p) => {
        await expect(p.locator('text=BX-0001').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );
};
