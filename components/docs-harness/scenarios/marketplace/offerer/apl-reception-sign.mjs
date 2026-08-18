// Сценарий: партия поставщика во время приёмки на участке.
//
// Подпись поставщика на акте ставится ОЧНО, в момент передачи имущества: она
// оформляется на столе пункта выдачи вместе с приёмкой, и на карточке партии
// потом видно «Поставщик подписал <время>». Своей кнопки подписи у поставщика
// нет — пока идёт приёмка, он видит статус и ждёт подписей акта.
//
// Отдельного раздела «Акты приёмки» у поставщика тоже нет — прежний сценарий
// ходил на /market/apl-receptions и получал 404.
//
// Фикстура: ivanpetrov / Петров Иван Сергеевич.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол поставщика — партия на приёмке',
  docPath: 'new/marketplace/offerer/reception-sign.md',
  assetsDir: 'assets/new/marketplace/offerer/reception-sign',
  role: 'user',
  mode: 'docs',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
  feature: 'marketplace.supply',
  cases: ['mkt.supply.side.08'],
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
  await loginAs(page, loadFixture('ivanpetrov'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/supply-prep`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Сформированные партии', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-party-in-reception',
    'Партия глазами поставщика, пока идёт приёмка на участке: показан цикл, участок, способ доставки и статус. Собственных действий на этом шаге нет — подпись поставщик ставит очно при передаче имущества, дальше акт закрывает председатель участка.',
    {
      expect: async (p) => {
        // Партия обязана быть в таблице: её пропажа здесь означала бы, что
        // поставщик теряет след отгруженного имущества.
        await expect(p.locator('text=КУ Красногорск').first()).toBeVisible({ timeout: 20000 });
        // Проверяем состояние партии, а не сумму: колонки с суммой в этой
        // таблице нет — показаны цикл, участок, вариант доставки и статус.
        await expect(p.locator('text=Идёт приёмка').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
