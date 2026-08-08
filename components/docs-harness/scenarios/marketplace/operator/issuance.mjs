// Сценарий: operator-стол выдачи заказов (Story 6.6).
// Председатель КУ открывает «Выдачу заказов» на ПВЗ: лента в статусах
// ACCEPTED_TO_COOP (ожидают открытия первой подписью signiss1) и
// READY_TO_RECEIVE (ожидают финальной подписи заказчика signiss2).

import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол ПВЗ — открытие выдачи',
  docPath: 'new/marketplace/branch-chairman/issuance-open.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/issuance-open',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAsChairman(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/issuance`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-issuance-empty',
    'Стол «Выдача заказов» председателя КУ: лента заказов, готовых к выдаче. По каждому заказу видны заказчик, количество, сумма и статус («Готов к выдаче»), кнопка «Завершить выдачу» накладывает финальную подпись заказчика (signiss2) и переводит заказ в «Получен».',
  );
};
