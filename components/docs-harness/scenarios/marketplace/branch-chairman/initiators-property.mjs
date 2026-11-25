// Сценарий: Стол ПВЗ → «Инициаторы участка» → «Имущество» глазами
// председателя участка krg (задача 99D-31). Председатель вносит имущество
// сам: заявление, одобрение председателем участка, решение совета (на стенде
// его принимает робот совета, если он включён), акт двумя подписями.
//
// Фикстура: chairkrg. Нужен подписанный договор участия — его подписывает
// сценарий initiators-money; без договора сценарий подписывает его сам.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Инициаторы участка — паевой взнос имуществом, одобрение и акт',
  docPath: 'new/marketplace/branch-chairman/initiators-property.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/initiators-property',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  mode: 'docs',
  feature: 'marketplace.order',
  cases: ['mkt.order.invest.ui.04', 'mkt.order.invest.ui.05'],
};

async function openTab(page, label) {
  await page.locator(`.page-tabs button:has-text("${label}"), [role="tab"]:has-text("${label}"), button:has-text("${label}")`).first().click();
  await page.waitForTimeout(800);
}

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

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

  const sign = page.locator('.doc-sign__foot button:has-text("Подписать договор")').first();
  if (await sign.count()) {
    await page.locator('.doc-sign__text').first().waitFor({ state: 'visible', timeout: 60000 });
    await sign.click();
    await page.locator('text=Мои взносы').first().waitFor({ state: 'visible', timeout: 120000 });
  }

  await openTab(page, 'Имущество');
  await page.locator('button:has-text("Внести имуществом")').first().click();
  const dialog = page.locator('.q-dialog').last();
  // Поля — по подписи, не по порядку: форма заявления о взносе имуществом
  // выросла до десяти полей (категория, ссылки на материалы, гарантийные
  // условия, срок гарантии), и порядковые номера разъехались. Подпись — точно:
  // «Описание» входит в «Прочие характеристики и описание».
  const field = (label) =>
    dialog
      .locator('label.q-field')
      .filter({ has: page.locator('.q-field__label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) })
      .locator('input, textarea')
      .first();
  const name = `Холодильная витрина ${Date.now().toString(36)}`;
  await field('Наименование').fill(name);
  await field('Категория Имущества').fill('Торговое оборудование');
  await field('Описание').fill('Двухметровая, исправна, проверена при приёме');
  await field('Гарантийные условия и предлагаемый срок действия').fill('Исправная работа компрессора 12 месяцев');
  await field('Количество').fill('1');
  await field('Единица измерения').fill('шт.');
  await field('Цена приёма').fill('25000');
  await field('Срок Гарантийных обязательств, дней').fill('365');
  await page.waitForTimeout(500);
  await shot(
    page,
    '01-property-dialog',
    'Окно паевого взноса имуществом: наименование, категория, описание, гарантийные условия, количество, единица, цена приёма и срок гарантийных обязательств. Заявление одобряет председатель участка, решение о приёме принимает совет, затем акт подписывают вносящий и председатель участка.',
  );
  await dialog.locator('button[type="submit"]').last().click();

  const row = page.locator(`tbody tr:has-text("${name}")`).first();
  await row.waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-property-created',
    'Заявление в разделе «Имущество»: наименование, инициатор, цена приёма и этап «Заявление подано». Председатель участка одобряет или отклоняет его кнопками в строке; отказ требует причины.',
    {
      expect: async (p) => {
        await expect(p.locator(`tbody tr:has-text("${name}")`).first()).toContainText('Заявление подано');
      },
    },
  );

  await row.locator('button:has-text("Одобрить")').first().click();
  const confirm = page.locator('.q-dialog').last();
  await confirm.locator('button:has-text("Одобрить")').last().click();
  await row.locator('text=На решении совета').or(row.locator('text=Совет принял решение')).first()
    .waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(1000);
  await shot(
    page,
    '03-property-approved',
    'Председатель участка одобрил заявление: вопрос о приёме имущества вынесен на совет. После решения совета вносящий подписывает акт приёма-передачи.',
  );

  // Решение совета на стенде принимает робот, если он включён; иначе вопрос
  // ждёт людей в повестке, и сценарий на этом заканчивается.
  const act = row.locator('button:has-text("Подписать акт")').first();
  const decided = await act.waitFor({ state: 'visible', timeout: 90000 }).then(() => true).catch(() => false);
  if (!decided) return;

  await act.click();
  // Вторую подпись ставит председатель совета в «Запросах одобрения» или на
  // этой же странице (решение владельца 08.11.2026); председатель участка
  // видит, что акт ждёт его подписи, — сценарий на этом заканчивается.
  await row.locator('text=Акт на подписи председателя совета').first().waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(1000);
  await shot(
    page,
    '04-property-act1',
    'Совет принял решение, вносящий подписал акт приёма-передачи: этап «Акт на подписи председателя совета». Председатель совета подписывает тот же акт второй подписью в «Запросах одобрения» или кнопкой «Подписать» в этой строке — имущество принимается в участок.',
  );
};
