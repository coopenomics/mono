// Сценарий: «Показать QR» на столе поставщика.
//
// QR партии — пропуск на сдачу поставки: поставщик привозит имущество на КУ
// и показывает код оператору; сканирование открывает приёмку именно этой
// партии. Снимается после подготовки отгрузки.
//
// Кадры вспомогательные к странице shipment.md (docPath не задан).
//
// Фикстура: ivanpetrov.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол поставщика — QR партии',
  assetsDir: 'assets/new/marketplace/offerer/ship-party',
  role: 'user',
  mode: 'docs',
  feature: 'marketplace.supply',
  cases: ['mkt.sup.ui.01'],
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
};

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/ship-party`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-ship-party',
    'QR партии на столе поставщика. Поставщик показывает его оператору при передаче имущества на кооперативный участок: сканирование открывает приёмку именно этой партии, без ручного поиска.',
    {
      expect: async (p) => {
        await expect(p.locator('canvas, svg, img[src*="data:"]').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
