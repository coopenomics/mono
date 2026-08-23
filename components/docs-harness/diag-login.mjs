// Диагностика loginAs(chairkrg): почему сценарий после loginAs остаётся
// на /auth/signin. Снимаем подробный лог console+network+state.
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3041';
const COOP = 'voskhod';
const fixture = JSON.parse(
  fs.readFileSync('/home/admin/mono-ai-4/components/docs-harness/state/participants/chairkrg.json', 'utf8'),
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 800 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();

page.on('console', (msg) => {
  console.log(`[console.${msg.type()}]`, msg.text().slice(0, 500));
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('requestfailed', (req) => console.log('[reqfail]', req.url(), req.failure()?.errorText));
page.on('response', (resp) => {
  const url = resp.url();
  if (url.includes('/v1/graphql') || url.includes('/auth')) {
    console.log(`[resp ${resp.status()}]`, url);
  }
});

console.log('→ goto signin');
await page.goto(`${BASE}/${COOP}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
console.log('✓ signin form ready');

await page.locator('label:has-text("электронную почту")').locator('input').fill(fixture.email);
await page.locator('label:has-text("ключ доступа")').locator('input').fill(fixture.wif);
console.log('→ click Войти');
await page.locator('button:has-text("Войти")').click();

// Wait up to 15s and dump location periodically
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(500);
  const url = page.url();
  if (!/auth\/signin/.test(url)) {
    console.log(`✓ left signin → ${url} (after ${(i + 1) * 500}ms)`);
    break;
  }
  if (i === 29) console.log(`✗ still on signin after 15s: ${url}`);
}

// Dump localStorage relevant keys
const lsState = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = (localStorage.getItem(k) || '').slice(0, 200);
  }
  return out;
});
console.log('LOCAL STORAGE KEYS:', Object.keys(lsState));
for (const [k, v] of Object.entries(lsState)) {
  if (/(auth|jwt|session|hasCre|user|wif)/i.test(k)) console.log(` ${k}=${v}`);
}

await page.screenshot({ path: '/home/admin/.claude/jobs/5a9b0a35/diag-after-login.png', fullPage: false });

await browser.close();
