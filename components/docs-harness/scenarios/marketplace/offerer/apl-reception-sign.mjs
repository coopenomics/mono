// Сценарий: offerer-стол «Подпись приёмки» (Эпик 5 / Story 5.7).
// Поставщик ставит первую подпись signapl1 на акте приёмки партии ПВЗ.
// После этого ПВЗ закрывает акт signapl2. На пустом стенде ожидающих
// подписи актов нет — показывается заглушка.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол поставщика — подпись приёмки',
  docPath: 'new/marketplace/offerer/apl-reception-sign.md',
  assetsDir: 'assets/new/marketplace/offerer/apl-reception-sign',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/apl-receptions`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-apl-receptions-empty',
    `Стол «Подпись приёмки» поставщика. URL: \`${page.url()}\`. Empty state: ожидающих первой подписи signapl1 актов приёмки на стенде нет.`,
  );
};
