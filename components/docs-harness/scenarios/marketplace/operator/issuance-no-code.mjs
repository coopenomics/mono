// Сценарий: выдачу нельзя открыть без кода получателя.
//
// Открытие выдачи — это передача имущества конкретному пайщику, поэтому
// единственный вход в неё — код получения, который заказчик показывает на
// месте. Отдельной кнопки «выдать» на карточке нет: оператор не должен иметь
// возможности отдать заказ «на глаз», по совпадению фамилии.
//
// Проверяем обе стороны: действие на столе одно — «Сканировать QR заказа», и
// произвольный код сканер не принимает, а объясняет, что именно он ждёт.
//
// Фикстура: chairkrg — председатель Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

// Код, которого нет ни у одного пайщика: не код получения, не код передачи и
// не ТТН — ровно тот случай, когда оператор ввёл что-то от руки.
const BOGUS_CODE = 'НЕТ-ТАКОГО-КОДА-123';

export const meta = {
  title: 'Стол ПВЗ — выдача не открывается без кода получателя',
  assetsDir: 'assets/new/marketplace/operator/issuance-no-code',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.issuance',
  cases: ['mkt.iss.side.01'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:05-sign-offer',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-issuance-desk',
    'Стол выдачи: карточки показывают, что кому причитается, но открыть выдачу с них нельзя — единственное действие вынесено в шапку и требует кода получателя.',
    {
      expect: async (p) => {
        await expect(p.locator('button:has-text("Сканировать QR заказа")').first())
          .toBeVisible({ timeout: 20000 });
      },
    },
  );

  // В сюите этот сценарий идёт после выдачи заказа, и на столе может висеть
  // открытый диалог или всплывающее уведомление от предыдущего шага. Кнопка
  // при этом находится, но клик по ней не проходит — перекрыта оверлеем.
  // Точечный прогон этого не показывает: там стол чистый.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await page.locator('.q-notification').first().waitFor({ state: 'detached', timeout: 8000 })
    .catch(() => {});
  await cleanViteOverlays(page);

  await page.locator('button:has-text("Сканировать QR заказа")').first().click({ timeout: 20000 });
  const dialog = page
    .locator('.q-dialog__inner:visible')
    .filter({ hasText: 'Сканирование QR' })
    .first();
  await dialog.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800);

  await shot(
    page,
    '02-scan-dialog',
    'Диалог сканирования: оператор наводит камеру на код получения, который заказчик показывает с телефона, либо вводит его вручную. Без кода дальше пути нет.',
  );

  // Ручной ввод произвольного кода — то, чем оператор попытался бы обойти
  // требование. Сканер обязан отбить и назвать, какие коды принимает.
  await dialog.locator('input').first().type(BOGUS_CODE, { delay: 30 });
  await dialog.locator('button:has-text("Применить")').first().click();

  // Отказ показывается всплывающим уведомлением и живёт секунды — ждём именно
  // его появления, а не фиксированную паузу, иначе кадр снимется уже пустым.
  const rejection = page.locator('.q-notification', { hasText: 'Нераспознанный код' }).first();
  await rejection.waitFor({ state: 'visible', timeout: 20000 });

  await shot(
    page,
    '03-code-rejected',
    'Произвольный код не принят: система называет, какие коды подходят — код получения заказчика, код поставщика, QR товарно-транспортной накладной или логин пайщика. Выдача не открыта.',
    {
      expect: async (p) => {
        await expect(p.locator('.q-notification', { hasText: 'Нераспознанный код' }).first())
          .toBeVisible({ timeout: 20000 });
      },
    },
  );
};
