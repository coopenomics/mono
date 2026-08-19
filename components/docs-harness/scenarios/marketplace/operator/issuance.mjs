// Сценарий: operator-стол выдачи заказов (Story 6.6).
// Председатель КУ открывает «Выдачу заказов» на ПВЗ: лента в статусах
// ACCEPTED_TO_COOP (ожидают открытия первой подписью signiss1) и
// READY_TO_RECEIVE (ожидают финальной подписи заказчика signiss2).

import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол ПВЗ — открытие выдачи',
  docPath: 'new/marketplace/operator/issuance.md',
  assetsDir: 'assets/new/marketplace/operator/issuance',
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
    '01-issuance-queue',
    'Стол «Выдача заказов»: очередь заказов, готовых к выдаче. По каждому видны заказчик, количество, сумма и статус «Готов к выдаче». Открыть выдачу с карточки нельзя — путь начинается со сканирования кода получателя в шапке.',
  );
};
