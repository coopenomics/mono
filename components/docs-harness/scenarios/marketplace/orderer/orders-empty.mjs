// Сценарий: «Мои заказы» у пайщика, который ещё ничего не заказывал.
//
// Пустой экран — тоже состояние продукта, и оно должно объяснять, что делать
// дальше, а не выглядеть поломкой. Проверяем, что раздел открывается, показан
// пояснительный текст и приглашение в каталог, а не пустая страница и не
// отказ в правах.
//
// Фикстура отдельная (`orderer2`): через рабочую `ekaterina` проходит вся
// цепочка заказа, и к моменту этого сценария у неё заказы уже есть — пустое
// состояние на ней не воспроизвести. Оферту ЦПП и участок получения
// `orderer2` проставляет фаза `marketplace:05-sign-offer`; без них стол
// отдал бы «Недостаточно прав доступа» вместо пустого списка.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол заказчика — «Мои заказы» без единого заказа',
  docPath: 'new/marketplace/orderer/orders-empty.md',
  assetsDir: 'assets/new/marketplace/orderer/orders-empty',
  role: 'user',
  mode: 'docs',
  fixture: 'orderer2',
  fixtures: ['orderer2'],
  feature: 'marketplace.order',
  cases: ['mkt.order.side.19'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:05-sign-offer',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('orderer2'));
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Мои заказы', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-no-orders',
    'Раздел «Мои заказы» у пайщика, который ещё ничего не заказывал: вместо таблицы — пояснение и переход в каталог. Фильтр-табы по стадиям заказа на месте, но все они пусты.',
    {
      expect: async (p) => {
        // Раздел обязан открыться: пустой список — не повод для отказа в
        // правах. Если бы гейт заказчика не был пройден, здесь была бы
        // страница «Недостаточно прав доступа», и кадр это поймает.
        await expect(p.locator('text=Мои заказы').first()).toBeVisible({ timeout: 20000 });
        // Пустое состояние объясняет, что делать дальше, а не просто пустует.
        await expect(p.locator('text=У вас пока нет заказов').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Перейдите в каталог').first()).toBeVisible({ timeout: 20000 });
        // Карточек заказа нет. Проверяем по подписи суммы в карточке, а не по
        // слову «Получен»: оно есть в названии таба «Получены» и совпало бы
        // даже на пустом списке.
        await expect(p.locator('text=СУММА')).toHaveCount(0);
      },
    },
  );
};
