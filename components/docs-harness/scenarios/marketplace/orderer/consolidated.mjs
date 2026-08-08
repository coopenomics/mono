// Сценарий: реестр заказов кооператива на столе администратора.
//
// Сводная картина по всем заказам с текущими статусами: от ожидания сборки
// партии до получения. Открыв заказ, председатель видит его состояние,
// документы, операции и проводки процесса.
//
// Отдельной страницы «Сводный заказ» у заказчика больше нет (маршрут отдавал
// 404): группировка заказов в партии — забота поставщика и участка, а сводную
// картину по кооперативу даёт этот реестр.
//
// Фикстура: председатель кооператива (ant, Иванов Иван Иванович).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, env, cleanViteOverlays , loginAsChairman } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол администратора — реестр заказов кооператива',
  docPath: 'new/marketplace/chairman/orders-registry.md',
  assetsDir: 'assets/new/marketplace/chairman/orders-registry',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.order',
  cases: ['mkt.order.happy.03'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect, context }) => {
  await loginAsChairman(page, context);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => document.body.innerText.includes('Реестр всех заказов кооператива'),
    { timeout: 90000 },
  );
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-orders-registry',
    'Реестр всех заказов кооператива с текущими статусами. Фильтры по стадиям повторяют жизненный цикл заказа: ожидает сборки партии, ждёт акцепта поставщика, в работе, получен. Открыв заказ, председатель видит документы, операции и проводки процесса.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Берёзовый сок').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
