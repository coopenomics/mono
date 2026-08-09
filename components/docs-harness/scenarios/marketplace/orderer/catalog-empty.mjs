// Сценарий: витрина кооператива, в которой ещё нет ни одного одобренного
// предложения.
//
// Предложение поставщика попадает в каталог не сразу: сначала председатель его
// модерирует. До одобрения витрина пуста — и это штатное состояние, а не
// поломка: раздел обязан открыться, объяснить, что предложений пока нет, и не
// показать ни ошибок, ни битой разметки.
//
// Место в цепочке: строго между созданием предложения и его модерацией. Раньше
// нет смысла (поставщик ещё ничего не подал), позже невозможно — одобренное
// предложение уже в каталоге.
//
// Фикстура: ekaterina — заказчица с пройденным гейтом стола.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Витрина — каталог без одобренных предложений',
  docPath: 'new/marketplace/orderer/catalog-empty.md',
  assetsDir: 'assets/new/marketplace/orderer/catalog-empty',
  role: 'user',
  mode: 'docs',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
  feature: 'marketplace.offer',
  cases: ['mkt.offer.side.24'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('ekaterina'));
  await pickBranchIfAsked(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  // Пока идёт загрузка, вместо пустого состояния показывается скелетон-сетка —
  // ждём именно текст пустого состояния, иначе снимем кадр не того состояния.
  await page.locator('text=Ничего не найдено').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-empty-catalog',
    'Витрина кооператива до модерации первого предложения: раздел открыт, фильтры по категориям на месте, вместо карточек — пояснение, что активных предложений пока нет.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Ничего не найдено').first()).toBeVisible({ timeout: 20000 });
        // Пояснение именно про пустой каталог, а не про неудачный фильтр:
        // категория не выбрана, значит показывать нечего вообще.
        await expect(p.locator('text=В каталоге пока нет активных предложений').first())
          .toBeVisible({ timeout: 20000 });
        // Раздел открылся заказчику: если бы гейт стола не был пройден, здесь
        // была бы страница отказа в правах, а не пустое состояние.
        await expect(p.locator('text=Недостаточно прав доступа')).toHaveCount(0);
      },
    },
  );
};
