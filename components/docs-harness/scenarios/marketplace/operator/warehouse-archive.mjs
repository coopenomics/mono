// Сценарий: вкладка «Архив» склада стола ПВЗ.
//
// С 19.11.2026 стол показывает выданное заказчикам и списанное имущество
// участка на вкладке склада «Архив»: та же таблица с датой выбытия, свежее сверху,
// кнопка «Показать ещё». Строка открывает карточку «Имущество на складе» —
// её «История» заканчивается выдачей (кто выдал и кому) либо списанием.
//
// Идёт в обзорной группе, после выдачи, возвратов и списаний: в архиве есть
// выданные позиции Красногорска.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs, signOnboardingAgreements } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол ПВЗ — архив склада',
  docPath: 'new/marketplace/operator/warehouse.md',
  assetsDir: 'assets/new/marketplace/operator/warehouse-archive',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot, expect }) => {
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, loadFixture('chairkrg'));
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse/archive`, {
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
    '01-archive',
    'Вкладка «Архив»: имущество участка, выданное заказчикам или списанное, — свежее сверху, с датой выбытия. Кнопка «Показать ещё» дочитывает следующую страницу.',
    {
      expect: async () => {
        await expect(firstRow).toBeVisible({ timeout: 30000 });
      },
    },
  );

  await firstRow.click();
  const card = page.locator('.inv-item').first();
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const history = card.locator('.inv-item__section', { hasText: 'История' }).first();
  await history.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-archived-item-history',
    'Карточка выбывшей позиции: «История» от приёмки до выдачи — кто выдал и кому — либо до списания.',
    {
      expect: async (p) => {
        await expect(card.locator('text=/Выдано|Списано/').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.keyboard.press('Escape');
};
