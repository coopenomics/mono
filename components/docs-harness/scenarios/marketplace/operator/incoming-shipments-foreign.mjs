// Сценарий: партия, собранная на один участок, не видна на чужом.
//
// Поставки разграничены по кооперативным участкам: председатель участка видит
// только то, что направлено к нему. Это не косметика ленты, а разграничение
// доступа — по чужой партии нельзя ни принять товар, ни подписать акт.
//
// Проверяем на том же стенде и в тот же момент, когда партия точно существует
// и видна Красногорску (предыдущий сценарий её показал): председатель
// Одинцова открывает свой стол приёмки и не находит там ничего.
//
// Фикстура: chairodn — председатель КУ Одинцово, участок odn.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanViteOverlays,
  dismissOnboardingDialogs,
  env,
  loginAs,
  signOnboardingAgreements,
} from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол ПВЗ — чужая партия не видна',
  docPath: 'new/marketplace/operator/incoming-shipments-foreign.md',
  assetsDir: 'assets/new/marketplace/operator/incoming-shipments-foreign',
  role: 'user',
  mode: 'docs',
  fixture: 'chairodn',
  fixtures: ['chairodn'],
  feature: 'marketplace.supply',
  cases: ['mkt.supply.side.07'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
  ],
};

export default async ({ page, shot, expect }) => {
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, loadFixture('chairodn'));
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/reception`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await signOnboardingAgreements(page);
  await dismissOnboardingDialogs(page);
  // Пока идёт загрузка, вместо пустого состояния висит скелетон — ждём именно
  // итоговый текст, иначе кадр снимется в промежуточном состоянии.
  await page.locator('text=Поставок пока нет').first().waitFor({ state: 'visible', timeout: 60000 });
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-no-foreign-shipments',
    'Стол приёмки председателя Одинцова: партия, собранная поставщиком на Красногорск, сюда не попадает. Виден только свой участок — принять чужую поставку или подписать акт по ней невозможно.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Поставок пока нет').first()).toBeVisible({ timeout: 20000 });
        // Стол именно открыт как свой, а не отбит отказом «вы не оператор»:
        // иначе пустота означала бы отсутствие прав, а не разграничение партий.
        await expect(p.locator('text=Вы не оператор кооперативного участка')).toHaveCount(0);
        // Товар из чужой партии в ленте не появляется.
        await expect(p.locator('text=Берёзовый сок')).toHaveCount(0);
      },
    },
  );
};
