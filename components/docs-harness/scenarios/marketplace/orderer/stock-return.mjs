// Сценарий: второй пайщик возвращает по гарантии имущество, купленное из
// остатка кооператива.
//
// Проверяется главное отличие такого возврата: имущество возвращается
// КООПЕРАТИВУ, а не первому заказчику, чей заказ когда-то породил остаток.
// Деньги возвращаются самому второму пайщику, а членский взнос снимается
// обратно из пула участка.
//
// Срок гарантии здесь свой — тот, что председатель назначил при публикации
// остатка, а не срок исходного предложения поставщика.
//
// Фикстура: orderer2 / Зайцева Анна — заказчица, купившая остаток.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
import { makeSolidPng } from '../../../lib/png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

/** Фото «дефекта», которое пайщик прикладывает к заявлению. */
const RETURN_PHOTO = makeSolidPng(480, 360, [96, 120, 168]);

const RETURN_REASON =
  'Товар со склада кооператива оказался с повреждённой упаковкой — прошу принять гарантийный возврат.';

export const meta = {
  title: 'Стол заказчика — возврат имущества, купленного из остатка',
  assetsDir: 'assets/new/marketplace/orderer/stock-return',
  role: 'user',
  mode: 'docs',
  fixture: 'orderer2',
  fixtures: ['orderer2'],
  feature: 'marketplace.stock',
  cases: ['mkt.stock.happy.04'],
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
  await loginAs(page, loadFixture('orderer2'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Мои заказы', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await page.getByText('Берёзовый сок').first().click({ force: true });
  await page.waitForSelector('text=Факт выдачи', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-order-detail',
    'Карточка полученного заказа второго пайщика: имущество куплено из остатка кооператива, поэтому цена и срок гарантийного возврата — те, что назначил председатель при публикации.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Факт выдачи').first()).toBeVisible({ timeout: 15000 });
        // Срок гарантии назначен при публикации остатка и ещё не истёк.
        await expect(p.locator('text=Гарантийный возврат доступен').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  await page.locator('button:has-text("Подать заявление на возврат")').first().click({ timeout: 20000 });

  const dialog = page.locator('.mp-takeover').first();
  await dialog.waitFor({ state: 'visible', timeout: 20000 });
  const confirmBtn = dialog.locator('.mp-takeover__confirm');

  await dialog.locator('textarea').first().fill(RETURN_REASON);
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-claim-reason',
    'Шаг «Описание»: второй пайщик объясняет причину возврата. Количество можно не указывать — тогда возвращается всё выданное.',
    { preserveNotifications: true },
  );

  await confirmBtn.click();

  await dialog.locator('input.file-uploader__native').first().setInputFiles({
    name: 'stock-defect.png',
    mimeType: 'image/png',
    buffer: RETURN_PHOTO,
  });
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await confirmBtn.click();

  await dialog.locator('.mp-return-submit__preview').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(600);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-claim-preview',
    'Заявление на возврат по заказу из остатка: сумма к возврату считается от цены перепредложения, по которой пайщик купил имущество, а не от исходной цены поставщика.',
    { preserveNotifications: true },
  );

  await confirmBtn.click();

  await page.locator('text=Заявление на возврат').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-claim-submitted',
    'Заявление подано и ждёт решения председателя участка. Принятое, оно вернёт имущество кооперативу — обратно в тот же обезличенный остаток, откуда оно и было продано.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        await expect(p.locator('text=Заявление на возврат').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Гарантийный возврат доступен')).toHaveCount(0);
      },
    },
  );
};
