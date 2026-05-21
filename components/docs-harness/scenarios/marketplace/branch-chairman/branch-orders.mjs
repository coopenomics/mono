// Сценарий: Председатель КУ видит сводный стол участка с 3 табами.
// Эпик 6 / Story 6.x — Приёмки, Выдачи, Возвраты для одного braname.
//
// Объединяет существующие 3 query (ListAplReceptionsByBraname,
// ListIssuancesByBraname, ListReturnClaimsByBraname) через Promise.all.
// braname вводится вручную; auto-detect через marketplaceWhoAmI — следующий
// шаг Story 6.x+1.
//
// Фикстура: chairkrg (Пётр Сергеевич Иванов), председатель КУ Красногорск.

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
  title: 'Сводный стол КУ: приёмки, выдачи, возвраты',
  docPath: 'new/marketplace/branch-chairman/branch-orders.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/branch-orders',
  role: 'chairman',
  fixture: 'chairkrg',
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('chairkrg');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/market-pvz/branch-orders`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Сводный стол кооперативного участка', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-empty-input',
    'Сводный стол КУ до ввода braname: подсказка «Введите ID вашего КУ» + поле ввода. Auto-detect через marketplace_whoami появится на следующем шаге Story 6.x+1 — председатель КУ привязан к одному branch через trustee.',
  );

  // Ввести braname для КУ Красногорск
  const branameInput = page.locator('input[aria-label*="braname"], label:has-text("braname") input, label:has-text("ID кооперативного участка") input').first();
  if (await branameInput.isVisible().catch(() => false)) {
    await branameInput.fill('krg');
    await page.locator('button:has-text("Загрузить")').click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-loaded-tabs',
      'После ввода braname КУ Красногорск (krg) — карта с 3 табами и счётчиками: Приёмки (Эпик 5), Выдачи (Эпик 6), Возвраты (Эпик 7). Polling 20s — обновляет все 3 ленты параллельно через Promise.all.',
    );
  }
};
