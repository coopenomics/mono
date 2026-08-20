// Сценарий: председатель выносит проект списания скоропорта на совет.
//
// Механика: выделить имущество на складах к списанию, указать причину и одной
// кнопкой подписать Заявление — проект сразу выносится на повестку совета.
// Совет утверждает списание протоколом, после чего председатель проводит его.
//
// Прежняя версия искала кнопку «Новый черновик» — такого шага в интерфейсе
// больше нет.
//
// Фикстура: председатель кооператива (ant, Иванов Иван Иванович).

import { cleanViteOverlays, env, loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя — списание скоропорта',
  docPath: 'new/marketplace/admin/writeoffs.md',
  assetsDir: 'assets/new/marketplace/admin/writeoffs',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.writeoff',
  cases: ['mkt.wof.happy.01'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect, context }) => {
  await loginAsChairman(page, context);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/writeoffs`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => document.body.innerText.includes('списани') || document.body.innerText.includes('Списани'),
    { timeout: 90000 },
  );
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-writeoff-board',
    'Списания скоропорта: председатель выделяет имущество на складах участков, указывает причину и подписывает Заявление — проект сразу уходит на повестку совета. Совет утверждает списание протоколом, после чего оно проводится.',
    {
      expect: async (p) => {
        // Раздел обязан открыться председателю: отказ в правах здесь означал бы
        // расхождение маршрута с матрицей доступа.
        await expect(p.locator('text=Списания скоропорта').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
