// Демо shotElement: логин пайщика → снимок .micro-wallet с CSS-zoom ×2.5.
// Смысл: элемент ре-лейаутится в 2.5× перед screenshot'ом, шрифты и иконки
// растеризуются нативно в этом размере — получаем чёткий PNG без ресэмплинга
// битмапа (lanczos3 поверх уже сжатой картинки упирается в разрешение исходника).
//
// Usage: node scripts/demo-element-shot.mjs
// Результат: ~/tmp/wallet-mini-native-25x.png

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser, makeShotContext, env } from '../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../state/participants/ivanpetrov.json'), 'utf8')
);

const outDir = path.join(process.env.HOME, 'tmp');
fs.mkdirSync(outDir, { recursive: true });

const { browser, page } = await openBrowser();
const { shotElement } = makeShotContext({ scenarioName: '_demo/micro-wallet', outDir });

try {
  // --- Логин пайщика (повтор логики auth/signin.mjs без скриншотов) ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 120000 });
  await page.locator('label:has-text("электронную почту")').locator('input').fill(FIXTURE.email);
  await page.locator('label:has-text("ключ доступа")').locator('input').fill(FIXTURE.wif);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/voskhod\/user\//, { timeout: 30000 });

  // --- Если onboarding — подписываем все 4 соглашения ---
  const signBtn = page.locator('button:has-text("ПОДПИСАТЬ")').first();
  const walletMarker = page.locator('text=Стол пайщика').first();
  await Promise.race([
    signBtn.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {}),
    walletMarker.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {}),
  ]);
  if (await signBtn.isVisible().catch(() => false)) {
    await page.waitForFunction(
      () => !document.body.innerText.includes('Формируем документ'),
      { timeout: 60000 }
    );
    await page.waitForTimeout(500);
    for (let i = 0; i < 8; i++) {
      const clicked = await page.evaluate(() => {
        const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
          .filter(p => getComputedStyle(p).display !== 'none');
        if (portals.length === 0) return false;
        const top = portals[portals.length - 1];
        const btn = Array.from(top.querySelectorAll('button'))
          .find(b => b.textContent?.trim() === 'Подписать' && !b.disabled);
        if (!btn) return false;
        btn.scrollIntoView({ block: 'center', behavior: 'instant' });
        btn.click();
        return true;
      });
      if (!clicked) break;
      await page.waitForTimeout(3500);
    }
  }

  await page.waitForURL(/\/voskhod\/user\/wallet/, { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach(n => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach(n => n.remove());
  });
  await page.waitForTimeout(1500);

  // --- 1) Нативный снимок мини-кошелька без zoom (baseline) ---
  await shotElement(page, 'wallet-mini-native-1x', 'Мини-кошелёк, нативный рендер 1×', '.micro-wallet');

  // --- 2) Снимок с CSS-zoom ×2.5 — шрифты и иконки ре-растеризуются в целевом размере ---
  await shotElement(page, 'wallet-mini-native-25x', 'Мини-кошелёк, CSS zoom ×2.5 (нативный рендер в крупном размере)', '.micro-wallet', { zoom: 2.5 });

  console.log(`\n✓ ${path.join(outDir, 'wallet-mini-native-1x.png')}`);
  console.log(`✓ ${path.join(outDir, 'wallet-mini-native-25x.png')}`);
} finally {
  await browser.close();
}
