// Сценарий: выдачу нельзя открыть без кода получателя.
//
// Открытие выдачи — это передача имущества конкретному пайщику, поэтому
// единственный вход в неё — код получения, который заказчик показывает на
// месте. Отдельной кнопки «выдать» на карточке нет: оператор не должен иметь
// возможности отдать заказ «на глаз», по совпадению фамилии.
//
// Проверяем обе стороны: действие на столе одно — общий сканер «Сканировать»
// в шапке (598-62), и произвольный код сервер не принимает, а объясняет, что
// именно он ждёт.
//
// Фикстура: chairkrg — председатель Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
import { openScanner, scanButton, submitCode } from '../../../lib/marketplace-scan.mjs';

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
        await expect(scanButton(p)).toBeVisible({ timeout: 20000 });
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

  const dialog = await openScanner(page);
  await page.waitForTimeout(800);

  await shot(
    page,
    '02-scan-dialog',
    'Окно общего сканера стола: оператор наводит камеру на код, который пайщик показывает с телефона, либо вводит код вручную. Без кода дальше пути нет.',
  );

  // Ручной ввод произвольного кода — то, чем оператор попытался бы обойти
  // требование. Сканер обязан отбить и назвать, какие коды принимает.
  await submitCode(page, dialog, BOGUS_CODE);

  // Отказ показывается всплывающим уведомлением и живёт секунды — ждём именно
  // его появления, а не фиксированную паузу, иначе кадр снимется уже пустым.
  const rejection = page.locator('.q-notification', { hasText: 'Код не распознан' }).first();
  await rejection.waitFor({ state: 'visible', timeout: 20000 });

  await shot(
    page,
    '03-code-rejected',
    'Произвольный код не принят: система просит отсканировать код из Стола заказов или ввести логин пайщика. Выдача не открыта.',
    {
      expect: async (p) => {
        await expect(p.locator('.q-notification', { hasText: 'Код не распознан' }).first())
          .toBeVisible({ timeout: 20000 });
      },
    },
  );
};
