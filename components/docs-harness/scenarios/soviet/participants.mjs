// Сценарий: реестр пайщиков и страница пайщика.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin, loadFixture } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'soviet.participants',
  title: 'Реестр пайщиков',
  docPath: 'new/council/participants.md',
  assetsDir: 'assets/new/council/participants',
  role: 'chairman',
  fixtures: ['ivanpetrov'],
};

const SOVIET = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/${p}`;

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, SOVIET('participants'), 'Пайщики');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-registry', 'Реестр пайщиков: имя, тип, участок, состояние и дата вступления. Вкладка «Верификации» отбирает пайщиков по проверке паспорта.');

  const verifications = page.locator('text=Верификации').first();
  if (await verifications.isVisible().catch(() => false)) {
    await verifications.click();
    await page.waitForTimeout(1500);
    await shot(page, '02-verifications', 'Вкладка «Верификации»: пайщики по состоянию проверки паспорта. Отбор «Без базовой — нужен паспорт» показывает тех, кому нужен паспорт.');
    await page.locator('text=Пайщики').first().click();
    await page.waitForTimeout(1200);
  }

  const who = loadFixture('ivanpetrov');
  const row = page.locator('tbody tr').filter({ hasText: 'Петров' }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(1500);
    await shot(page, '03-panel', 'Правая панель пайщика: удостоверение, контакты, участок и документы. Ссылка ведёт на страницу пайщика целиком.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await openPage(page, SOVIET(`participants/${who.username}`), null);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await expect(page.locator('text=Петров').first()).toBeVisible({ timeout: 30000 });
  await shot(page, '04-participant', 'Страница пайщика: анкета, участок, кошельки, документы и платежи пайщика в одном месте.');
};
