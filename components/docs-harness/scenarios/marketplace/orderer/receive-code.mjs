// Сценарий: «Показать QR» на столе заказчика.
//
// QR — пропуск на выдачу: заказчица показывает его оператору на ПВЗ, оператор
// сканирует и сразу видит, какие заказы готовы к выдаче этому пайщику.
// Снимается в группе «Выдача», когда заказ уже готов к получению.
//
// Кадры вспомогательные к странице receive.md (docPath не задан — страницу
// собирает основной сценарий ready-to-receive).
//
// Фикстура: ekaterina.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол заказчика — QR для получения',
  assetsDir: 'assets/new/marketplace/orderer/receive-code',
  role: 'user',
  mode: 'docs',
  feature: 'marketplace.issuance',
  cases: ['mkt.iss.ui.01'],
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
};

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ekaterina');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/receive-code`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-receive-code',
    'QR-код заказчицы для получения на пункте выдачи. Код показывается оператору у стойки: после сканирования оператор видит готовые к выдаче заказы пайщика и открывает выдачу — искать заказ по фамилии не нужно.',
    {
      expect: async (p) => {
        await expect(p.locator('canvas, svg, img[src*="data:"]').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
