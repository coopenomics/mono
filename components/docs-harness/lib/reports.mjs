// Помощники сценариев стола бухгалтера (приложение reports).

import { env, loginAsChairman } from './harness.mjs';
import { openPage, settleAfterLogin } from './edu.mjs';

export const REP = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/reports/${p}`;

/** Сценарий страницы стола: вход председателя, переход, кадр, раскрытие первой строки. */
export function reportPage({ doc, p, title, description, rowDescription }) {
  return {
    meta: {
      mode: 'docs',
      feature: `reports.${doc}`,
      title,
      docPath: `new/buh/${doc}.md`,
      assetsDir: `assets/new/buh/${doc}`,
      role: 'chairman',
      fixtures: ['ivanpetrov'],
      prepare: ['soviet:03-payment'],
    },
    run: async ({ page, context, shot }) => {
      await loginAsChairman(page, context);
      await settleAfterLogin(page);
      await openPage(page, REP(p), null);
      await page.waitForTimeout(2000);
      await shot(page, '01-page', description);
      if (!rowDescription) return;
      const row = page.locator('tbody tr').first();
      if (await row.isVisible().catch(() => false)) {
        await row.click();
        await page.waitForTimeout(1800);
        await shot(page, '02-row', rowDescription);
      }
    },
  };
}
