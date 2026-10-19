// Помощники сценариев стола пайщика: вход пайщика Ивана Петрова через форму.

import { env, loginAs, clickMenu } from './harness.mjs';
import { openPage, settleAfterLogin, loadFixture } from './edu.mjs';

export const USER = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/user/${p}`;
export const COOP_PAGE = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/${p}`;

export function participantMeta(doc, title) {
  return {
    mode: 'docs',
    feature: `participant.${doc}`,
    title,
    docPath: `new/participant/${doc}.md`,
    assetsDir: `assets/new/participant/${doc}`,
    role: 'member',
    fixtures: ['ivanpetrov'],
  };
}

export async function loginMember(page) {
  await loginAs(page, loadFixture('ivanpetrov'));
  await settleAfterLogin(page);
}

/** Страница стола пайщика: по адресу либо по пункту меню. */
export async function openMember(page, { url, menu }) {
  if (url) await openPage(page, url, null);
  else await clickMenu(page, menu);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1800);
}

/** Сценарий одной страницы: вход, переход, кадр, раскрытие первой строки. */
export function memberPage({ doc, title, url, menu, description, rowDescription }) {
  return {
    meta: participantMeta(doc, title),
    run: async ({ page, shot }) => {
      await loginMember(page);
      await openMember(page, { url, menu });
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
