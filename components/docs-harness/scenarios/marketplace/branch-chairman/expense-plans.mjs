// Сценарий: Стол ПВЗ → «Экономика участка» → «Плановые расходы» глазами
// председателя участка krg (задачи 99D-34, 99D-35). Плитки «Резерв плановых
// расходов» и «Доступно для расходов»; окно нового планового расхода —
// повторяемость, способ оплаты по реквизитам организации из реестра
// контрагентов, план платежей с резервом в месяц.
//
// Расход сценарий не добавляет: запись плана держит резерв участка и мешала
// бы соседним сценариям распределения.
//
// Фикстура: chairkrg (председатель участка krg).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Плановые расходы участка — способ оплаты и план платежей',
  docPath: 'new/marketplace/branch-chairman/expense-plans.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/expense-plans',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  mode: 'docs',
  feature: 'expenses.plans',
  cases: ['exp.plan.ui.01', 'mkt.economy.expense-funds.02'],
};

/** Дата через 40 дней, `ГГГГ-ММ-ДД` — срок первого платежа. */
function dueIn40Days() {
  return new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
}

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  const target = `${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/economy?tab=expenses`;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await page.goto('about:blank');
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pickBranchIfAsked(page);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await dismissOnboardingDialogs(page);
    if (page.url().includes('market-pvz/economy') && !(await page.locator('text=Недостаточно прав доступа').count())) break;
  }
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-tiles',
    'Вкладка «Плановые расходы»: «Резерв плановых расходов» — неоплаченные расходы до конца месяца и накопленные доли квартальных и годовых платежей; «Доступно для расходов» — кошелёк участка и свободные средства инициаторов. «Оплатить» горит у записи, на которую хватает денег; иначе под кнопкой — «Недостаточно средств».',
    {
      expect: async (p) => {
        await expect(p.locator('text=Доступно для расходов').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.locator('button:has-text("Добавить расход")').first().click();
  const dialog = page.locator('.q-dialog').last();
  await expect(dialog.locator('text=Новый плановый расход').first()).toBeVisible({ timeout: 20000 });
  await dialog.getByLabel('Назначение расхода', { exact: true }).fill('Электроэнергия пункта выдачи');
  await dialog.getByLabel('Сумма платежа', { exact: true }).fill('3000');
  await dialog.getByLabel('Оплатить к дате', { exact: true }).fill(dueIn40Days());
  await dialog.locator('button[role="radio"]:has-text("Раз в квартал")').first().click();
  await dialog.locator('button[role="radio"]:has-text("По реквизитам организации")').first().click();
  await page.waitForTimeout(1500);
  await shot(
    page,
    '02-dialog',
    'Новый плановый расход: назначение, сумма и срок; повторяемость — раз в квартал; способ оплаты — по реквизитам организации из реестра контрагентов, контрагента можно добавить прямо из поля. Справа — план платежей: ближайшие сроки, резерв в месяц и как он формируется.',
    {
      expect: async () => {
        await expect(dialog.locator('text=План платежей').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  await dialog.locator('button[role="radio"]:has-text("Аванс под отчёт")').first().click();
  await page.waitForTimeout(800);
  await shot(page, '03-advance', 'Способ оплаты — аванс под отчёт: себе или другому пайщику, на выбранный способ получения средств. Пайщик отчитывается чеками.');

  await page.keyboard.press('Escape');
};
