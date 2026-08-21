// Сценарий: страница подключения на столе поставщика.
//
// Пайщик без допуска в реестр поставщиков видит вместо разделов стола
// страницу подключения (gate) — с неё уходит заявка администратору.
// Кадр read-only: заявка не подаётся, состояние не меняется.
//
// Фикстура: ekaterina — подключённая заказчица без роли поставщика.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол поставщика — подключение',
  assetsDir: 'assets/new/marketplace/offerer/connect',
  role: 'user',
  mode: 'docs',
  feature: 'marketplace.onboarding',
  cases: ['mkt.onb.ui.01'],
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
};

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ekaterina');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/onboarding`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-supplier-onboarding',
    'Страница подключения на столе поставщика: её видит пайщик, ещё не допущенный в реестр поставщиков. Отсюда уходит заявка администратору; после одобрения открываются все разделы стола.',
    {
      expect: async (p) => {
        await expect(p.locator('text=/[Пп]оставщик/').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
