// Сценарий: гарантийные возвраты на пункте выдачи.
//
// Оператор рассматривает заявления пайщиков: сначала удалённое решение по
// заявке, затем очный осмотр и приём возврата. Пайщик, пришедший на осмотр,
// показывает QR из своей заявки — оператор читает его сканером сверху.
//
// Прежняя версия требовала ручного ввода «ID кооперативного участка» —
// такого шага больше нет, участок берётся из контекста стола.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель КУ Красногорск.

import { cleanViteOverlays, env, loginAs, dismissOnboardingDialogs , pickBranchIfAsked } from '../../../lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол ПВЗ — гарантийные возвраты',
  docPath: 'new/marketplace/operator/returns.md',
  assetsDir: 'assets/new/marketplace/operator/returns',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.return',
  cases: ['mkt.ret.side.07'],
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

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/returns`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => document.body.innerText.includes('заявлени'), { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-return-claims',
    'Гарантийные возвраты участка. Порядок такой: сначала удалённое решение по заявлению пайщика, затем очный осмотр имущества и приём возврата на пункте выдачи. Пайщик показывает QR из своей заявки — оператор читает его сканером в шапке.',
    {
      expect: async (p) => {
        // Экран обязан открыться именно как раздел возвратов, а не отказом.
        await expect(p.locator('text=Сканировать').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
