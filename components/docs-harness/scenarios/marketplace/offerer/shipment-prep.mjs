// Сценарий: offerer-стол «Подготовка отгрузки» (Эпик 5 / Story 5.5).
// Поставщик видит сводные заказы в статусах CONFIRMED → SHIPPING и
// подтверждает готовность отгрузки. На пустом стенде после reboot:extra
// сводных заказов ещё нет, показывается заглушка.
//
// Логин — за председателем кооператива (ant), как и в других marketplace
// сценариях harness'а: chairman имеет доступ ко всем рабочим столам пайщика
// для целей документации; полная фикстура `sidorov` для multi-account
// прогона потока II будет в магистрали II PLAN.md §9.4.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол поставщика — подготовка отгрузки',
  docPath: 'new/marketplace/offerer/shipment.md',
  assetsDir: 'assets/new/marketplace/offerer/shipment',
  role: 'user',
  mode: 'docs',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
  feature: 'marketplace.supply',
  cases: ['mkt.supply.happy.02'],
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
  // Стол поставщика: председателю он недоступен — прежняя версия логинилась
  // председателем и упиралась в отказ в правах.
  await loginAs(page, loadFixture('ivanpetrov'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/supply-prep`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('button:has-text("Сформировать партию")', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-no-parties',
    'Подготовка отгрузки до формирования партии. Принятые заказы уже готовы к отгрузке; партия собирается кнопкой «Сформировать партию» в шапке — там выбирается способ доставки и кооперативный участок.',
  );

  await page.locator('button:has-text("Сформировать партию")').first().click();
  await page.waitForSelector('text=Что грузим в партию', { timeout: 20000 });
  await page.waitForTimeout(1200);

  await shot(
    page,
    '02-party-dialog',
    'Диалог сборки партии: способ доставки (самовывоз без ТТН или через экспедитора по товарно-транспортной накладной), кооперативный участок и перенос заказов в партию. Невыбранное останется акцептованным для следующей партии.',
  );

  // Переносим весь доступный объём: партия без заказов не формируется.
  await page.locator('text=Переместить всё').first().click();
  await page.waitForTimeout(1200);
  await expect(page.locator('text=В партии (1)').first()).toBeVisible({ timeout: 10000 });

  await shot(
    page,
    '03-party-filled',
    'Заказ перенесён в партию: слева осталось пусто, справа — то, что реально едет на участок. Количество в заказе не дробится.',
  );

  // Кнопка в подвале диалога — не та, что открывала диалог в шапке.
  await page.locator('button:has-text("Сформировать партию")').last().click();
  await page.waitForTimeout(7000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-party-created',
    'Сформированная партия и её следующий шаг. С этого момента партию ждут на пункте выдачи: оператор примет её и оформит акт приёмки.',
    {
      expect: async (p) => {
        // Пустое состояние обязано исчезнуть — иначе партия не создалась.
        await expect(p.locator('text=Партии ещё не сформированы')).toHaveCount(0, { timeout: 20000 });
      },
    },
  );
};
