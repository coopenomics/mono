// Сценарий: Стол председателя кооператива → обзорная экскурсия по marketplace URLs.
// Делает login как chairman (`ant`/`ivanov@example.com`), затем напрямую
// goto к каждому marketplace-маршруту и снимает что вышло.
//
// На текущем стенде session.loadComplete зависает на 5с (init-wallet падает),
// поэтому waitForURL после клика «Войти» бесполезен — используем waitForTimeout
// и goto. После клика «Войти» token успевает сохраниться в IndexedDB, что
// позволяет последующим goto'ам захватить authenticated layout (хедер).

import { cleanViteOverlays, env } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя ПК: экскурсия по marketplace',
  docPath: 'new/marketplace/chairman/dashboard.md',
  assetsDir: 'assets/new/marketplace/chairman/dashboard',
  role: 'chairman',
};

const ROUTES = [
  { name: '01-marketplace-main', path: '/marketplace', caption: 'Главная marketplace' },
  { name: '02-marketplace-catalog', path: '/marketplace/catalog', caption: 'Каталог витрины' },
  { name: '03-marketplace-orders', path: '/marketplace/orders', caption: 'Мои заказы' },
  { name: '04-chairman', path: '/chairman', caption: 'Стол председателя' },
  { name: '05-chairman-approvals', path: '/chairman/approval-requests', caption: 'Запросы одобрений' },
];

export default async ({ page, shot, context }) => {
  // --- Login (без ожидания редиректа — фронт не редиректит на этом стенде)
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
  await cleanViteOverlays(page);
  await page.locator('label:has-text("электронную почту")').locator('input').fill(env.CHAIRMAN_EMAIL);
  await page.locator('label:has-text("ключ доступа")').locator('input').fill(env.CHAIRMAN_WIF);
  await cleanViteOverlays(page);
  await page.locator('button:has-text("Войти")').click();

  // Подождать сохранения токенов в IndexedDB (login API + globalStore.setTokens)
  await page.waitForTimeout(4000);
  await shot(page, '00-after-login', 'Состояние сразу после клика «Войти» (фронт ещё не редиректит автоматически — баг с реактивностью info.coopname).');

  // --- Обзорная экскурсия по marketplace маршрутам
  for (const route of ROUTES) {
    const url = `${env.BASE_URL}/${env.COOPNAME}${route.path}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await cleanViteOverlays(page);
    await shot(page, route.name, `${route.caption}: ${url.replace(env.BASE_URL, '')}`);
  }
};
