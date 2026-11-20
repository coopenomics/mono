// Сценарий: карточка «Имущество на складе» на складе стола ПВЗ.
//
// С 19.11.2026 строка склада открывает карточку позиции, а не предложение:
// пункт выдачи и место, заказчик, кто и когда принял, основание, сроки,
// маркировка и раздел «История» — шаги позиции (приёмка, место, этикетка,
// резерв, выдача) с исполнителем и временем. В шапке склада — «Сканировать»:
// скан наклеенной этикетки открывает карточку её позиции.
//
// Идёт сразу после operator/inventory-label и operator/warehouse: позиция
// принята, размещена и промаркирована, и история показывает эти шаги.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs, signOnboardingAgreements } from '../../../lib/harness.mjs';
import { scanButton } from '../../../lib/marketplace-scan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол ПВЗ — карточка имущества на складе',
  docPath: 'new/marketplace/operator/warehouse.md',
  assetsDir: 'assets/new/marketplace/operator/warehouse-item',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

/** Окно, открытое поверх страницы: портал q-dialog нулевого размера не годится. */
const visibleDialog = (page) => page.locator('.q-dialog__inner:visible').first();

export default async ({ page, shot, expect }) => {
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, loadFixture('chairkrg'));
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse/warehouse`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  const firstRow = page.locator('tr.base-table__row--click').first();
  await shot(
    page,
    '01-property-tab',
    'Вкладка «Имущество»: позиции на складе участка — имущество с обложкой, заказчик, количество, место, состояние, срок годности и дата приёмки. В шапке склада — «Сканировать» и «Печать этикеток».',
    {
      expect: async () => {
        await expect(firstRow).toBeVisible({ timeout: 30000 });
      },
    },
  );

  // Карточка позиции — правая панель поверх склада.
  await firstRow.click();
  const card = page.locator('.inv-item').first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-item-card',
    'Карточка «Имущество на складе»: пункт выдачи и место, заказчик, кто и когда принял, основание, сроки, маркировка; кнопки «Заказ» и «Предложение», у оператора — «Привязать этикетку».',
  );

  // Раздел «История» стоит внизу карточки — прокручиваем к нему.
  const history = card.locator('.inv-item__section', { hasText: 'История' }).first();
  await history.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await shot(
    page,
    '03-item-history',
    'Раздел «История» карточки: шаги позиции по времени — приёмка на склад, размещение, маркировка — с исполнителем и местом.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Принято на склад').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.keyboard.press('Escape');
  await card.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  // «Сканировать» в шапке склада: этикетка открывает карточку своей позиции.
  await scanButton(page).click();
  await visibleDialog(page).waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-scan-dialog',
    'Окно «Сканировать» на складе: камера, USB-сканер или ввод кода вручную. Привязанная этикетка открывает карточку своей позиции, неизвестная — отказ с кодом этикетки.',
  );

  await page.keyboard.press('Escape');
};
