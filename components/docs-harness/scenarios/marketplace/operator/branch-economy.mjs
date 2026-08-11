// Сценарий: председатель участка смотрит накопленные членские взносы и
// распределяет их между участниками по сетке весов.
//
// С каждого исполненного заказа членский взнос оседает в общем кошельке
// участка. Часть кошелька заморожена плановым резервом расходов ближайших
// 30 дней; остальное председатель распределяет вручную — доля каждого
// участника считается по его весу.
//
// Сценарий идёт ПОСЛЕ выдачи, возврата и списания: до выдачи взносов в
// кошельке нет, а принятый возврат снимает взнос обратно из того же пула —
// распределив всё заранее, мы бы обрушили возврат на пустом кошельке.
// Распределяется поэтому не весь остаток, а половина доступного.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель КУ Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол ПВЗ — экономика участка: взносы и распределение',
  docPath: 'new/marketplace/operator/branch-economy.md',
  assetsDir: 'assets/new/marketplace/operator/branch-economy',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.economy',
  cases: ['mkt.eco.ui.01', 'mkt.eco.ui.02'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

/** «1 234,56 ₽» / «1 234.56 RUB» → 1234.56. Пробелы бывают неразрывными. */
const parseMoney = (text) =>
  Number.parseFloat(
    String(text)
      .replace(/[^\d,.-]/g, '')
      .replace(/\s/g, '')
      .replace(',', '.')
  );

/** Баланс карточки кошелька по её заголовку. */
async function walletBalance(page, title) {
  const card = page.locator('.wallet').filter({ hasText: title }).first();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  return parseMoney(await card.locator('.wallet__metric-val').first().innerText());
}

/** Значение колонки «На кошельке» строки участника распределения. */
async function personalInRow(page, username) {
  const row = page.locator('table.table tbody tr').filter({ hasText: username }).first();
  if ((await row.count()) === 0) return null;
  return parseMoney(await row.locator('td').nth(3).innerText());
}

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/economy`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Общий кошелёк участка', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  const commonBefore = await walletBalance(page, 'Общий кошелёк участка');

  await shot(
    page,
    '01-branch-wallet',
    'Кошелёк участка: сюда приходит членский взнос с каждого исполненного заказа. Ниже — движения по кошельку со ссылкой на заказ-источник.',
    {
      expect: async (p) => {
        // Заказы к этому моменту исполнены — взносы обязаны быть на кошельке.
        // Ноль означал бы, что взнос не дошёл до участка.
        expect(commonBefore).toBeGreaterThan(0);
        await expect(p.locator('text=Движения по кошельку').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  // ── Сетка распределения ──────────────────────────────────────────────────
  await page.getByText('Распределение', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  // Пока веса не заданы, распределять нечего и некому — форма добавления
  // участника видна, кнопка «Распределить» заблокирована.
  const gridEmpty = (await page.locator('text=Веса распределения не настроены').count()) > 0;
  if (gridEmpty) {
    const select = page.locator('.economy__add-select').first();
    await select.click();
    await page.waitForTimeout(800);
    await page.locator('.q-menu .q-item').first().click();
    await page.waitForTimeout(500);
    const weightInput = page.locator('.economy__add-weight input').first();
    await weightInput.click();
    await weightInput.fill('3');
    await weightInput.blur();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Добавить в распределение")').first().click();
    await page.waitForTimeout(6000);
    await cleanViteOverlays(page);
  }

  const shares = await page.locator('table.table tbody tr').count();

  await shot(
    page,
    '02-distribution-grid',
    'Сетка распределения: у каждого участника свой вес, доля считается как вес к сумме весов. Рядом видно, сколько уже лежит на его персональном кошельке.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Сетка обязана быть непустой: без неё распределение недоступно.
        expect(shares).toBeGreaterThan(0);
        await expect(p.locator('text=Доля').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  // ── Распределение ────────────────────────────────────────────────────────
  const firstUser = (await page.locator('table.table tbody tr td').first().innerText()).trim();
  const personalBefore = (await personalInRow(page, firstUser)) ?? 0;

  await page.locator('button:has-text("Распределить")').first().click();
  await page.waitForSelector('text=Распределить из общего кошелька', { timeout: 20000 });
  await page.waitForTimeout(1000);

  // Распределяем половину доступного: остаток нужен возврату (он снимает
  // членский взнос обратно из того же пула) и плановым расходам.
  const dialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Распределить из общего кошелька' }).first();
  const amountInput = dialog.locator('input').first();
  const half = Math.max(1, Math.floor(commonBefore / 2));
  await amountInput.click();
  await amountInput.fill(String(half));
  await amountInput.blur();
  await page.waitForTimeout(600);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-distribute-dialog',
    'Диалог распределения: сумма разойдётся по весам участников. Резерв плановых расходов остаётся в общем кошельке — распределить его нельзя.',
    { preserveNotifications: true },
  );

  await dialog.locator('button:has-text("Распределить")').last().click();
  await page.waitForTimeout(10000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  const personalAfter = (await personalInRow(page, firstUser)) ?? 0;

  await shot(
    page,
    '04-distributed',
    'После распределения: сумма ушла с общего кошелька на персональные кошельки участников по их долям. Дальше каждый распоряжается своей долей сам — переводом в Стол заказов или материальной помощью.',
    {
      preserveNotifications: true,
      expect: async () => {
        // Деньги обязаны появиться у участника: распределение без движения по
        // персональному кошельку означало бы, что взносы растворились.
        expect(personalAfter).toBeGreaterThan(personalBefore);
      },
    },
  );

  await page.getByText('Кошелёк участка', { exact: true }).first().click();
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  const commonAfter = await walletBalance(page, 'Общий кошелёк участка');

  await shot(
    page,
    '05-wallet-after',
    'Общий кошелёк участка после распределения: остаток уменьшился ровно на распределённую сумму, а само распределение видно отдельной строкой в движениях.',
    {
      preserveNotifications: true,
      expect: async () => {
        expect(commonAfter).toBeLessThan(commonBefore);
      },
    },
  );
};
