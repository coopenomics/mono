// Сценарий: оператор выдаёт второму пайщику заказ из остатка кооператива.
//
// Отличие от обычной выдачи: цикла поставки не было — имущество лежало на
// складе участка обезличенным остатком и было зарезервировано под заказ в
// момент оформления. Выдаётся оно сразу, а разница между ценой прибытия и
// ценой перепредложения выбывает прочим расходом (уценка).
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

const RECEIVER_CODE = `blago:receive:${process.env.COOPNAME || 'voskhod'}:orderer2`;

export const meta = {
  title: 'Стол ПВЗ — выдача заказа из остатка второму пайщику',
  docPath: 'new/marketplace/operator/stock.md',
  assetsDir: 'assets/new/marketplace/operator/stock',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.stock',
  cases: ['mkt.stock.happy.03'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Сканировать QR', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-issuance-board',
    'Поток выдач участка: заказ из остатка стоит в очереди наравне с обычными — для оператора разницы нет, имущество уже на складе.',
  );

  await page.getByText('Сканировать QR').first().click({ force: true });
  await page.waitForSelector('text=Или введите код вручную', { timeout: 20000 });
  const scanDialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Сканирование QR' }).first();
  const codeInput = scanDialog.locator('input').first();
  await codeInput.click();
  await codeInput.type(RECEIVER_CODE, { delay: 20 });
  await page.waitForTimeout(400);
  await scanDialog.locator('button:has-text("Применить")').first().click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  const dialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Открытие выдачи пайщику' }).first();

  await shot(
    page,
    '02-issuance-opened',
    'Выдача открыта по коду второго пайщика: имущество то же самое, но заказ его, и сумма считается по цене перепредложения.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        await expect(p.locator('text=Нераспознанный код')).toHaveCount(0, { timeout: 15000 });
        await expect(dialog.locator('text=Открытие выдачи пайщику').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await dialog.locator('button:has-text("Подписать и отправить пайщику")').first().click();
  await page.waitForTimeout(12000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-issued',
    'Акт выдачи подписан: имущество ушло второму пайщику, а остаток кооператива на складе уменьшился на выданное.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Диалог обязан закрыться — иначе подпись не ушла на сервер.
        await expect(p.locator('text=Открытие выдачи пайщику')).toHaveCount(0, { timeout: 20000 });
      },
    },
  );
};
