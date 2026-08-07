// Сценарий: Стол заказчика → обзорный тур по разделам marketplace глазами
// обычного пайщика (НЕ председателя). Авторизуется как ivanpetrov, проходит
// онбординг подписания соглашений (если не подписан), затем перебирает
// маршруты marketplace, используя harness:noBranchOverlay.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол заказчика: разделы Стола заказов глазами пайщика',
  docPath: 'new/marketplace/orderer/marketplace-tour.md',
  assetsDir: 'assets/new/marketplace/orderer/marketplace-tour',
  role: 'user',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
};

const ROUTES = [
  { name: '01-catalog',          path: '/market/catalog',           caption: 'Каталог Стола заказов глазами пайщика-заказчика — список доступных предложений товаров и услуг' },
  { name: '02-my-orders',        path: '/market/my-orders',         caption: 'Мои заказы: лента активных и завершённых заказов пайщика' },
  { name: '03-ready-to-receive', path: '/market/ready-to-receive',  caption: 'Готовые к выдаче: товары, доставленные на ПВЗ и ждущие получения' },
  { name: '04-returns',          path: '/market/returns',           caption: 'Возвраты: заявки на возврат, оформленные пайщиком после получения товара' },
];

// Подписать все онбординг-диалоги пайщика, если они появляются после логина.
// Логика повторяет scenarios/auth/signin.mjs: 4 q-dialog'а со stacked z-index,
// в каждом кнопка «Подписать» внизу скроллящегося контента. Click через DOM,
// потому что Playwright actionability падает на pointer-events внутри документа.
async function signAllAgreements(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(500);

  for (let i = 0; i < 8; i++) {
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      if (portals.length === 0) return false;
      const top = portals[portals.length - 1];
      const btn = Array.from(top.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(3500);
  }
}

export default async ({ page, shot }) => {
  const fixture = loadFixture('ivanpetrov');

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await signAllAgreements(page);

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
  });
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  for (const route of ROUTES) {
    const url = `${env.APP_PREFIX}/${env.COOPNAME}${route.path}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Ждём пока SPA-подгрузки прекратятся (GraphQL/REST + chain-rpc).
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    // Дополнительный буфер на анимации/спиннеры.
    await page.waitForTimeout(2500);
    await cleanViteOverlays(page);
    await shot(page, route.name, `${route.caption} (URL: \`/${env.COOPNAME}${route.path}\`)`);
  }
};
