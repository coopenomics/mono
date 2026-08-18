// Сценарий: координатная сетка склада и раскладка имущества (Эпик 19).
//
// Склад участка — адресная сетка: секции по горизонтали, ярусы по вертикали,
// на пересечении ячейка с адресом (A-01). В ячейке стоят боксы; негабарит
// кладётся в ячейку напрямую. Перекладка — перетаскиванием карточки позиции
// на ячейку или бокс.
//
// Требует включённых ячеек и боксов (фаза 07). Повторный прогон терпим:
// сетка не пересоздаётся.
//
// Фикстура: председатель КУ Красногорск (chairkrg).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Склад участка — сетка и раскладка',
  assetsDir: 'assets/new/marketplace/operator/warehouse-cells',
  role: 'user',
  mode: 'docs',
  feature: 'marketplace.stock',
  cases: ['mkt.stock.ui.02'],
  prepare: ['marketplace:07-warehouse-config'],
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot, expect }) => {
  await page.addInitScript(() => { window.print = () => {}; });

  const fixture = loadFixture('chairkrg');
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  // ── Сетка ──
  const emptyGrid = await page.locator('text=Сетка склада не заведена').count();
  if (emptyGrid) {
    await shot(
      page,
      '01-labeling-overview',
      'Раскладка и маркировка: слева поступившее имущество (колонка «Поступило»), справа — место под координатную сетку склада. Пока сетка не заведена, имущество просто числится на складе без адреса.',
    );
    await page.locator('button:has-text("Завести ячейку A-01")').first().click();
    await page.waitForTimeout(2500);
  }

  // Достраиваем сетку плюсами по краям, чтобы карта была не 1×1:
  // ещё одна секция и ещё один ярус (если карта совсем свежая).
  const addSection = page.locator('button[aria-label="Добавить секцию"]').first();
  if (await addSection.count()) {
    const cells = await page.locator('.place__grid-wrap [class*="cell"]').count();
    if (cells <= 2) {
      await addSection.click();
      await page.waitForTimeout(1500);
      const addLevel = page.locator('button[aria-label*="Добавить ярус"]').first();
      if (await addLevel.count()) {
        await addLevel.click();
        await page.waitForTimeout(1500);
      }
    }
  }

  await shot(
    page,
    '02-grid',
    'Координатная сетка склада: секции по горизонтали (A, B…), ярусы по вертикали, у каждой ячейки адрес вида A-01. Сетка достраивается плюсами по краям карты — под реальную геометрию помещения.',
    {
      expect: async (p) => {
        await expect(p.locator('text=A-01').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  // ── Перекладка позиции в ячейку (перетаскиванием) ──
  const card = page.locator('[draggable="true"]').first();
  if (await card.count()) {
    const cellTarget = page.locator('.place__grid-wrap :text("A-01")').first();
    try {
      await card.dragTo(cellTarget, { timeout: 10000 });
      await page.waitForTimeout(2000);
      await shot(
        page,
        '03-placed-in-cell',
        'Позиция перенесена на ячейку A-01 перетаскиванием: имущество получает адрес, и место потом находится по нему, а не перебором полок. Если в ячейке стоит бокс, позицию можно положить прямо в бокс — тогда при перевозке она поедет вместе с тарой.',
      );
    } catch {
      await shot(
        page,
        '03-placement',
        'Перекладка имущества: карточка позиции перетаскивается на ячейку сетки или на бокс в ячейке. Снятие с места возвращает позицию в колонку «Поступило».',
      );
    }
  }
};
