// Сценарий: реестр общих собраний пайщиков и созыв собрания.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'soviet.meets',
  title: 'Реестр собраний',
  docPath: 'new/council/meetings.md',
  assetsDir: 'assets/new/council/meetings',
  role: 'chairman',
};

const SOVIET = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/${p}`;

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, SOVIET('meets'), null);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '01-registry', 'Реестр общих собраний пайщиков: собрания с датой, состоянием и повесткой. Кнопка в шапке созывает новое собрание.');

  const create = page.locator('button').filter({ hasText: /Созвать|Создать|Новое собрание|Предложить/ }).first();
  if (await create.isVisible().catch(() => false)) {
    await create.click();
    await page.waitForTimeout(1500);
    await shot(page, '02-create', 'Созыв общего собрания: даты, председатель и секретарь собрания, повестка с проектами решений.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
};
