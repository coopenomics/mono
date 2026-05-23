// Сценарий: chairman-стол списаний (Story 8.7).
// Председатель собирает черновик проекта списания (вручную или из крон-предложения),
// подписывает Заявление 1106 и отправляет проект в совет через propwroff +
// soviet::createagenda(type=mktwroff). Backend проводит per-item списания
// через execwroff (пары o.mkt.wroff + o.mkt.wroff2).

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя — списания скоропорта',
  docPath: 'new/marketplace/chairman/writeoff-propose.md',
  assetsDir: 'assets/new/marketplace/chairman/writeoff-propose',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/writeoffs`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-writeoffs-empty',
    `Раздел «Списания скоропорта» председателя. URL: \`${page.url()}\`.`,
  );
};
