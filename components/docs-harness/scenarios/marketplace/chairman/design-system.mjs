// Сценарий: Стол председателя → Дизайн-система marketplace (Эпик 10).
// Витрина 13 custom-компонентов для утверждения председателем/советом
// до их применения в эпиках 1-9. Не выходит в production-меню пайщикам.

import { cleanViteOverlays, env } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Дизайн-система Стола заказов',
  docPath: 'new/marketplace/chairman/design-system.md',
  assetsDir: 'assets/new/marketplace/chairman/design-system',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  // Login as chairman через стандартный pattern.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
  await cleanViteOverlays(page);
  await page.locator('input[type="email"]').first().fill(env.CHAIRMAN_EMAIL);
  await page.locator('input[type="password"]').first().fill(env.CHAIRMAN_WIF);
  await cleanViteOverlays(page);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForFunction(
    () => !/auth\/signin/.test(window.location.href),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Дизайн-система — длинная скроллящаяся страница; снимем 3 проекта
  // через window.scrollTo, чтобы пройтись по верху, середине и низу.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/design-system`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-top',
    'Дизайн-система Стола заказов — верхняя часть витрины компонентов',
  );

  // Прокрутить вниз на 1 viewport
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: 'instant' }));
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-middle',
    'Дизайн-система: средняя часть витрины (после первой прокрутки)',
  );

  // Прокрутить ещё ниже
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.5, behavior: 'instant' }));
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);
  await shot(
    page,
    '03-bottom',
    'Дизайн-система: нижняя часть витрины',
  );
};
