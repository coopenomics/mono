// Сценарий: история выдач участка после завершённой выдачи.
//
// Финальная подпись при выдаче ставится оператором на пункте («Подписать и
// отправить пайщику»), после чего заказ у заказчика сразу переходит в
// «Получен» — отдельного подтверждения в его кабинете не требуется. Поэтому
// здесь документируется результат: поток выдач опустел, а заказ виден в
// истории участка.
//
// Прежняя версия требовала ручного ввода «ID кооперативного участка выдачи» —
// такого шага больше нет, участок берётся из контекста стола.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель Красногорск.

import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол ПВЗ — история выдач участка',
  assetsDir: 'assets/new/marketplace/operator/issuance-finalize',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.issuance',
  cases: ['mkt.iss.happy.03'],
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
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => document.body.innerText.length > 500, { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-orders-history',
    'История заказов участка: что прошло через пункт выдачи. Выданный заказ остаётся здесь с итоговым составом и суммой — по нему видно, что именно получил пайщик.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Яблочный сок').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => document.body.innerText.length > 500, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-issuance-empty',
    'Поток выдач после завершения: заказ выдан и из очереди ушёл. Новые появятся здесь, когда имущество примут на участок и заказчики придут за ним.',
  );
};
