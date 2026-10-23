// Сценарий: Стол председателя → экскурсия по разделам «Стола заказов» (marketplace).
// Авторизуется как chairman (ant) и перебирает все маршруты /market/* и /market-pvz/*,
// используя harness:noBranchOverlay чтобы обойти выбор кооп. участка.

import { cleanViteOverlays, env, loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя: разделы Стола заказов',
  docPath: 'new/marketplace/chairman/market-tour.md',
  assetsDir: 'assets/new/marketplace/chairman/market-tour',
  role: 'chairman',
};

// Только разделы стола администратора: тур председателя по чужим столам
// (заказчика, поставщика, участка) упирался в отказ в правах и в маршруты,
// которых больше нет. Каждый из этих столов документируется своим сценарием.
const ROUTES = [
  { name: '01-orders',            path: '/market-admin/orders',             caption: 'Реестр заказов кооператива с текущими статусами' },
  { name: '02-suppliers',         path: '/market-admin/suppliers',          caption: 'Реестр поставщиков: кто допущен публиковать предложения' },
  { name: '03-offers',            path: '/market-admin/offers',             caption: 'Реестр предложений кооператива любого статуса' },
  { name: '04-moderation',        path: '/market-admin/moderation',         caption: 'Очередь модерации: предложения, ждущие решения председателя' },
  { name: '05-economy',           path: '/market-admin/economy',            caption: 'Экономика Стола заказов: ставка членского взноса и сводные показатели' },
  { name: '06-categories',        path: '/market-admin/category-whitelist', caption: 'Доступные категории: чем кооператив разрешает торговать' },
  { name: '07-issuance-points',   path: '/market-admin/issuance-points',    caption: 'Пункты выдачи заказов: участки, подключённые к Столу заказов' },
  { name: '08-writeoffs',         path: '/market-admin/writeoffs',          caption: 'Списания скоропорта: проекты, выносимые на совет' },
  { name: '09-warehouse-summary', path: '/market-admin/warehouse-summary',  caption: 'Сводный склад кооператива по всем участкам' },
  { name: '10-payouts',           path: '/market-admin/payouts',            caption: 'Выплаты поставщикам: обзор для совета' },
  { name: '11-ecosystem',         path: '/market-admin/ecosystem',          caption: 'Реестр экосистемы: участники Стола заказов' },
];

export default async ({ page, shot, context }) => {
  // Вход через harness: с 24.09.2026 форма по ключу требует задать пароль,
  // а второй фактор приходит письмом — loginAsChairman знает оба шага.
  await loginAsChairman(page, context);
  // Harness escape hatch: отключаем branch-overlay, чтобы снять все разделы
  // Стола председателя без процедуры выбора КУ.
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/chairman`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await cleanViteOverlays(page);

  // Tour по marketplace разделам
  for (const route of ROUTES) {
    const url = `${env.APP_PREFIX}/${env.COOPNAME}${route.path}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // networkidle перед кадром: без него страница успевает начать следующую
    // навигацию во время съёмки, и Playwright падает на «Unable to capture
    // screenshot» — выглядит как поломка сценария, а это гонка.
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await pickBranchIfAsked(page, { timeout: 3000 });
    await cleanViteOverlays(page);
    await shot(page, route.name, `${route.caption}.`);
  }
};
