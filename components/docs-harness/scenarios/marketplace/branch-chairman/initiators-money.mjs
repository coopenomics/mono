// Сценарий: Стол ПВЗ → «Инициаторы участка» глазами председателя участка krg
// (задача 99D-31). Договор участия в хозяйственной деятельности, вложение
// деньгами, история вложений с документом в панели справа и раздел
// «Инициаторы участка» с итогами участка.
//
// Фикстура: chairkrg (председатель участка krg). Договор на стенде может быть
// уже подписан прежним прогоном — тогда кадр договора пропускается.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Инициаторы участка — договор участия и вложение деньгами',
  docPath: 'new/marketplace/branch-chairman/initiators-money.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/initiators-money',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  mode: 'docs',
  feature: 'marketplace.order',
  cases: ['mkt.order.invest.ui.01', 'mkt.order.invest.ui.02', 'mkt.order.invest.ui.03'],
};

async function openTab(page, label) {
  await page.locator(`.page-tabs button:has-text("${label}"), [role="tab"]:has-text("${label}"), button:has-text("${label}")`).first().click();
  await page.waitForTimeout(800);
}

async function openPage(page) {
  const target = `${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/initiators`;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await page.goto('about:blank');
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pickBranchIfAsked(page);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await dismissOnboardingDialogs(page);
    if (page.url().includes('market-pvz/initiators') && !(await page.locator('text=Недостаточно прав доступа').count())) break;
  }
  await cleanViteOverlays(page);
}

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);
  await openPage(page);

  // Договор участия: без него страница показывает только договор — текст на
  // странице, кнопка подписи в прилипшем подвале.
  const sign = page.locator('.initiators__foot button:has-text("Подписать договор")').first();
  if (await sign.count()) {
    await page.locator('.initiators__doc').first().waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1000);
    await shot(
      page,
      '01-agreement',
      'Без договора участия страница показывает сам договор: текст сформирован заранее и читается на странице, кнопка «Подписать договор» прилипла к низу экрана. Договор подписывается один раз и действует для всех кооперативных участков.',
    );
    await sign.click();
    await page.locator('text=Мои вложения').first().waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(1500);
  }

  await shot(
    page,
    '03-mine',
    'Раздел «Мои вложения»: фаза участка одним бейджем, плитки по пути денег — внесено деньгами и имуществом, использовано участком, возвращено, доступно к возврату и не израсходовано. Действия — в строке разделов: внести деньгами, внести имуществом, получить возврат.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Доступно к возврату').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.locator('button:has-text("Внести деньгами")').first().click();
  const moneyDialog = page.locator('.q-dialog').last();
  await moneyDialog.locator('input').first().fill('100');
  await page.waitForTimeout(500);
  await shot(
    page,
    '04-money-dialog',
    'Окно вложения деньгами: сумма паевого взноса переводится с главного паевого кошелька на кошелёк договора участия по выбранному участку. Заявление формируется и подписывается при нажатии «Внести деньгами».',
  );
  await moneyDialog.locator('button[type="submit"]').last().click();
  // Вложение проходит, если на главном паевом кошельке хватает средств; иначе
  // кооператив отказывает текстом — история тогда остаётся прежней.
  await page.locator('text=Вложение внесено').or(page.locator('text=Не удалось внести вложение')).first()
    .waitFor({ state: 'visible', timeout: 120000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  const row = page.locator('.initiators__section:has-text("История вложений") tbody tr').first();
  if (await row.count()) {
    await shot(
      page,
      '05-history',
      'История вложений: по строке на вложение деньгами, принятое имущество и возврат на главный паевой кошелёк — дата, операция, сумма. Строка открывает запись справа.',
    );
    await row.click();
    await page.waitForTimeout(1500);
    await shot(
      page,
      '06-history-drawer',
      'Запись истории в панели справа: сумма крупно, дата, номер операции учёта и документ процесса из реестра документов — заявление о трансляции паевого взноса в договор участия.',
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  await openTab(page, 'Инициаторы участка');
  await shot(
    page,
    '07-initiators',
    'Раздел «Инициаторы участка» у председателя участка: итоги участка — внесено деньгами и имуществом, оплачено из средств инициаторов, не израсходовано, возмещено и осталось вернуть — и строки инициаторов с состоянием возврата. Строка открывает инициатора справа.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Осталось вернуть').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
