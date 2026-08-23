// Сценарий: подпись акта приёма-передачи поставщиком.
//
// После того как оператор сверил партию и «Сформировал акты», у поставщика
// всплывает persistent-оверлей подписи на месте: акт с фактом приёмки —
// количество и цена после корректировок оператора — и кнопка «Подписать
// поставку». Прежде этот оверлей молча подписывал каскад passFirstLoginAgreements
// внутри loginAs, и процесс в документацию не попадал; теперь автоподпись
// выключена и подпись снимается кадрами.
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
  // Автоподпись выключена: соглашения первого входа ivanpetrov уже подписаны
  // раньше по цепочке, а оверлей акта обязан попасть в кадр, а не в каскад.
  await loginAs(page, loadFixture('ivanpetrov'), { signAgreements: false });
  await pickBranchIfAsked(page);

  // Оверлей подписи на месте — persistent: пока акт не подписан (или приёмка
  // не отменена), увести окно нельзя.
  const signBtn = page.locator('button:has-text("Подписать поставку")').first();
  const gateShown = await signBtn.waitFor({ state: 'visible', timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  if (gateShown) {
    await page.waitForTimeout(1000);
    await shot(
      page,
      '01-onsite-act',
      'Акт приёма-передачи на подписи у поставщика: состав по факту приёмки — количество и цена уже с корректировками оператора (недовес, уценка). Поставщик видит, что именно принимает кооператив, до своей подписи; несогласие означает возврат акта оператору на пересборку.',
    );

    await signBtn.click();
    await page.waitForTimeout(1500);
    // ЭЦП-диалог документа: жмём «Подписать», пока он предлагается.
    for (let i = 0; i < 4; i++) {
      const dlgSign = page.locator('.q-dialog button:has-text("Подписать")').last();
      if (!(await dlgSign.count())) break;
      await dlgSign.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
    }
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await cleanViteOverlays(page);

    await shot(
      page,
      '02-signed',
      'Подпись поставлена: оверлей закрылся, акт ушёл к председателю участка за закрывающей подписью. Только после неё имущество встаёт на баланс кооператива.',
    );
  }

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
    '03-party-in-reception',
    'Партия глазами поставщика, пока идёт приёмка на участке: показан цикл, участок, способ доставки и статус. Собственных действий на этом шаге нет — подпись поставщик ставит очно при передаче имущества, дальше акт закрывает председатель участка.',
    {
      expect: async (p) => {
        // Партия обязана быть в таблице: её пропажа здесь означала бы, что
        // поставщик теряет след отгруженного имущества.
        await expect(p.locator('text=Красногорск').first()).toBeVisible({ timeout: 20000 });
        // Проверяем состояние партии, а не сумму: колонки с суммой в этой
        // таблице нет — показаны цикл, участок, вариант доставки и статус.
        await expect(p.locator('text=Идёт приёмка').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
