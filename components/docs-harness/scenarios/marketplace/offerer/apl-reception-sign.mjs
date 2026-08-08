// Сценарий: поставщик подписывает акт приёма-передачи.
//
// Когда партия принята на пункте выдачи, на её карточке в «Подготовке
// отгрузки» появляется «Подписать передачу»: этой подписью поставщик
// подтверждает факт приёмки. Дальше акт уходит на закрывающую подпись
// председателя участка, и только после неё имущество оприходуется на склад.
//
// Отдельного раздела «Акты приёмки» у поставщика больше нет — прежний
// сценарий ходил на /market/apl-receptions и получал 404.
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
  title: 'Стол поставщика — подпись акта приёмки',
  docPath: 'new/marketplace/offerer/apl-reception-sign.md',
  assetsDir: 'assets/new/marketplace/offerer/apl-reception-sign',
  role: 'user',
  mode: 'docs',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
  feature: 'marketplace.supply',
  cases: ['mkt.supply.happy.03'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
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
    '01-party-accepted',
    'Партия принята на пункте выдачи: на её карточке появилось действие «Подписать передачу». Пока подписи нет, имущество числится за поставщиком.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Подписать передачу').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.locator('text=Подписать передачу').first().click();
  await page.waitForTimeout(4000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-sign-dialog',
    'Акт приёма-передачи перед подписанием: состав партии, количество и сумма. Подпись поставщика подтверждает, что имущество передано участку.',
  );

  // Кнопка подписания живёт в диалоге; ищем её среди видимых, а не первую на
  // странице — «Подписать передачу» на карточке осталась в фоне.
  const signButton = page.locator('button:has-text("Подписать")').last();
  await signButton.click();
  await page.waitForTimeout(9000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-after-sign',
    'После подписи акт уходит председателю участка на закрывающую подпись. Действие «Подписать передачу» с карточки пропадает — повторно подписать тот же акт нельзя.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        await expect(p.locator('text=Подписать передачу')).toHaveCount(0, { timeout: 20000 });
      },
    },
  );
};
