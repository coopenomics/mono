// Сценарий: operator-стол «Приёмка партии» (Эпик 5 / Story 5.6).
// Председатель КУ открывает акт приёмки (registry_id=1102) против
// ожидаемой поставки. На пустом стенде после reboot:extra — empty state,
// ожидающих партий нет; страница показывает заглушку.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол ПВЗ — приёмка партии',
  docPath: 'new/marketplace/operator/apl-reception-create.md',
  assetsDir: 'assets/new/marketplace/operator/apl-reception-create',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market-pvz/reception`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-reception-empty',
    `Стол «Приёмка партии» председателя КУ. URL: \`${page.url()}\`. На пустом стенде ожидающих приёмки партий нет — карточек CONFIRMED-поставок ещё не сформировано (требуется цикл orderer→offerer→consolidated).`,
  );
};
