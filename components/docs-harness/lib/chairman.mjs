// Помощники сценариев стола председателя.

import { env, loginAsChairman } from './harness.mjs';
import { openPage, settleAfterLogin } from './edu.mjs';

export const CHAIR = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/chairman/${p}`;

/** Вход председателя и переход на страницу его стола. */
export async function openChairman(page, context, p, waitText = null) {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, CHAIR(p), waitText);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/** Сценарий одной страницы: вход, переход, один кадр. */
export function onePage({ feature, title, doc, p, shotName = '01-page', description }) {
  return {
    meta: {
      mode: 'docs',
      feature,
      title,
      docPath: `new/chairman/${doc}.md`,
      assetsDir: `assets/new/chairman/${doc}`,
      role: 'chairman',
    },
    run: async ({ page, context, shot }) => {
      await openChairman(page, context, p);
      await shot(page, shotName, description);
    },
  };
}
