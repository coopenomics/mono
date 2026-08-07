// Сценарий: Сводный обзор заказов пайщика-заказчика.
// Эпик 4 / Story 4.4 — заказы группируются по cycle_id (time_based /
// volume_based / open_subscription / individual) с суммарной стоимостью
// партии и общим этапом партии (минимальный активный по STAGE_RANK).
//
// Канон-виджет `OrderCard` для отдельных заказов в партии.
// Polling 15s — обновляет список без перезагрузки.
//
// Фикстура: ekaterina (Екатерина Смирнова), пайщица-заказчица.

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
  title: 'Сводный заказ: партии заказчика по cycle_id',
  docPath: 'new/marketplace/orderer/consolidated.md',
  assetsDir: 'assets/new/marketplace/orderer/consolidated',
  role: 'user',
  fixture: 'ekaterina',
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('ekaterina');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  // 1. Открыть страницу сводного заказа
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/consolidated`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Сводный заказ', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);
  await shot(
    page,
    '01-overview',
    'Сводный обзор партий заказов пайщика-заказчика. Партии с cycle_id выводятся первыми (заказы внутри партии обслуживаются совместно — на одном цикле, с одной поставкой), индивидуальные заказы — отдельной группой. Для каждой партии показан тип цикла, этап партии, суммарная стоимость и ПВЗ доставки.',
  );

  // 2. Развернуть первую партию (если есть заказы)
  const firstGroup = page.locator('.mp-consolidated__group').first();
  if (await firstGroup.isVisible().catch(() => false)) {
    await firstGroup.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(
      page,
      '02-group-detail',
      'Партия развёрнута: внутри — карточки отдельных заказов (канон OrderCard role=orderer). Этап партии = минимальный активный статус среди заказов (если хотя бы один ждёт цикл — вся партия «Активна»).',
    );
  }
};
