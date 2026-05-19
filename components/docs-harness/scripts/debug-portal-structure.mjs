// Dump full top-level DOM children of body to find where the dialog content lives.

import { openBrowser, env, dismissOnboardingDialogs } from '../lib/harness.mjs';

const { browser, page } = await openBrowser();
try {
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 30_000 });
  await page.locator('label:has-text("электронную почту")').first().locator('input').fill(env.CHAIRMAN_EMAIL);
  await page.locator('label:has-text("ключ доступа")').first().locator('input').fill(env.CHAIRMAN_WIF);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/(chairman|participant|soviet)/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(4000);

  console.log('\n=== DOM scan BEFORE blocker ===');
  let report = await page.evaluate(() => {
    const top = Array.from(document.body.children).map((el) => ({
      tag: el.tagName,
      id: el.id || null,
      class: el.className?.toString?.().slice(0, 80) || null,
      display: getComputedStyle(el).display,
      textPreview: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    }));
    return top;
  });
  console.log(JSON.stringify(report, null, 2));

  console.log('\n=== install blocker ===');
  await dismissOnboardingDialogs(page);
  await page.waitForTimeout(1500);

  console.log('\n=== DOM scan AFTER blocker ===');
  report = await page.evaluate(() => {
    const top = Array.from(document.body.children).map((el) => ({
      tag: el.tagName,
      id: el.id || null,
      class: el.className?.toString?.().slice(0, 80) || null,
      display: getComputedStyle(el).display,
      inlineStyle: el.getAttribute('style'),
      textPreview: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    }));
    return top;
  });
  console.log(JSON.stringify(report, null, 2));

  await page.screenshot({ path: '/tmp/debug-after-blocker.png' });
  console.log('screenshot saved to /tmp/debug-after-blocker.png');
} catch (e) {
  console.error('debug failed:', e.message);
} finally {
  await browser.close();
}
