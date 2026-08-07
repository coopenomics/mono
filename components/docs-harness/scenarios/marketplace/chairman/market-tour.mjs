// Сценарий: Стол председателя → экскурсия по разделам «Стола заказов» (marketplace).
// Авторизуется как chairman (ant) и перебирает все маршруты /market/* и /market-pvz/*,
// используя harness:noBranchOverlay чтобы обойти выбор кооп. участка.

import { cleanViteOverlays, env } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя: разделы Стола заказов',
  docPath: 'new/marketplace/chairman/market-tour.md',
  assetsDir: 'assets/new/marketplace/chairman/market-tour',
  role: 'chairman',
};

const ROUTES = [
  { name: '01-catalog',          path: '/market/catalog',           caption: 'Каталог Стола заказов: список предложений товаров и услуг' },
  { name: '02-create-offer',     path: '/market-supplier/create-offer',      caption: 'Форма «Создать предложение» — добавление товара/услуги в каталог' },
  { name: '03-my-orders',        path: '/market/my-orders',         caption: 'Мои заказы: лента заказов председателя как заказчика' },
  { name: '04-ready-to-receive', path: '/market/ready-to-receive',  caption: 'Готовые к выдаче: заказы со статусом READY_TO_RECEIVE на пункте выдачи' },
  { name: '05-returns',          path: '/market/returns',           caption: 'Возвраты: заявки на возврат товара от заказчиков' },
  { name: '06-writeoffs',        path: '/market-admin/writeoffs',         caption: 'Списания: запросы на списание со склада, ждущие одобрения совета' },
  { name: '07-warehouse-summary',path: '/market-admin/warehouse-summary', caption: 'Склад кооператива: сводный остаток товаров по всем ПВЗ' },
  { name: '08-ecosystem',        path: '/market-admin/ecosystem',         caption: 'Реестр экосистемы: участники marketplace (заказчики, поставщики, операторы)' },
  { name: '09-pvz-list',         path: '/market-pvz/list',          caption: 'Пункты выдачи: список ПВЗ кооператива' },
  { name: '10-pvz-issuance',     path: '/market-pvz/issuance',      caption: 'Выдача заказов на ПВЗ: реестр товаров, ждущих выдачи заказчику' },
  { name: '11-pvz-returns',      path: '/market-pvz/returns',       caption: 'Возвраты на ПВЗ: обработка возвратов оператором' },
  { name: '12-pvz-warehouse',    path: '/market-pvz/warehouse',     caption: 'Склад ПВЗ: текущий остаток у конкретного пункта выдачи' },
];

export default async ({ page, shot, context }) => {
  // Login
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
  await cleanViteOverlays(page);
  await page.locator('input[type="email"]').first().fill(env.CHAIRMAN_EMAIL);
  await page.locator('input[type="password"]').first().fill(env.CHAIRMAN_WIF);
  await cleanViteOverlays(page);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/chairman/, { timeout: 30000 });
  await page.waitForTimeout(4000);

  // Tour по marketplace разделам
  for (const route of ROUTES) {
    const url = `${env.APP_PREFIX}/${env.COOPNAME}${route.path}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4500);
    await cleanViteOverlays(page);
    await shot(page, route.name, `${route.caption} (URL: \`#/${env.COOPNAME}${route.path}\`)`);
  }
};
