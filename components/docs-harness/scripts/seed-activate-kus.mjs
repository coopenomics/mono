// Pre-flight для всех orderer/* сценариев Стола заказов.
//
// После `chairman/branches.mjs` в core registry появляются 3 КУ
// (krg/odn/myt), но Marketplace ПВЗ-расширение требует отдельной
// детализации каждого участка (`marketplaceDetailKU`) и активации
// (`marketplaceSetKUStatus(status='ACTIVE')`). Без этого
// `fetchBranchOptions` в OrderCreateDialog (использует
// `MarketplaceListKUDetails` с `onlyActive:true`) возвращает пустой
// список и заказ создать нельзя.
//
// Сценарий ходит chairman'ом в /market-pvz, для каждого braname
// дёргает SDK API напрямую через dynamic import — 7-дневный режим
// работы в 3 диалога через UI был бы хрупким и медленным.
//
// Идемпотентен: detailKU с уже-существующим coreBraname обновляет
// запись (upsert), setKUStatus в ACTIVE на уже-ACTIVE — no-op.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Pre-flight: активация ПВЗ Стола заказов',
  docPath: 'new/marketplace/chairman/activate-kus.md',
  assetsDir: 'assets/new/marketplace/chairman/activate-kus',
  role: 'chairman',
};

const BRANCHES = [
  {
    braname: 'krg',
    addressFull: 'Московская область, г. Красногорск, ул. Заводская, д. 1',
    contactPhone: '+7 (999) 123-01-01',
    contactEmail: 'krg@voskhod.coop',
    description: 'КУ Красногорск — пилотный ПВЗ Стола заказов',
  },
  {
    braname: 'odn',
    addressFull: 'Московская область, г. Одинцово, ул. Центральная, д. 12',
    contactPhone: '+7 (999) 123-02-02',
    contactEmail: 'odn@voskhod.coop',
    description: 'КУ Одинцово',
  },
  {
    braname: 'myt',
    addressFull: 'Московская область, г. Мытищи, Олимпийский проспект, д. 5',
    contactPhone: '+7 (999) 123-03-03',
    contactEmail: 'myt@voskhod.coop',
    description: 'КУ Мытищи',
  },
];

// 7-дневный режим работы (9:00–18:00 кроме воскресенья).
const WORKING_HOURS = {
  mon: { open: '09:00', close: '18:00', breaks: [] },
  tue: { open: '09:00', close: '18:00', breaks: [] },
  wed: { open: '09:00', close: '18:00', breaks: [] },
  thu: { open: '09:00', close: '18:00', breaks: [] },
  fri: { open: '09:00', close: '18:00', breaks: [] },
  sat: { open: '10:00', close: '16:00', breaks: [] },
};

export default async ({ page, context, shot }) => {
  // Сетевой пробник на mutations — чтобы видеть из stdout, что произошло.
  let detailCalls = 0;
  let setStatusCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('/v1/graphql') && req.method() === 'POST') {
      const body = req.postData() || '';
      if (/marketplaceDetailKU|DetailKU/.test(body)) detailCalls += 1;
      if (/marketplaceSetKUStatus|SetKUStatus/.test(body)) setStatusCalls += 1;
    }
  });

  await loginAsChairman(page, context);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.locator('text="ПВЗ Стола заказов"').first()
    .waitFor({ state: 'visible', timeout: 90000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-before-activation',
    `Страница ПВЗ Стола заказов до активации. URL: \`${page.url()}\`. Admin (председатель) видит сводку по всем КУ кооператива; деталей и активаций ещё нет — `+
    'после `chairman/branches.mjs` существуют только записи core registry.',
  );

  // Дёргаем SDK API напрямую — детализация и активация трёх ПВЗ.
  const result = await page.evaluate(async ({ branches, workingHours, coopname }) => {
    const out = [];
    // Vite dev в SPA-mode даёт нам публично доступный модуль API
    // через путь, относительно которого resolves.
    const apiMod = await import('/src/entities/MarketplaceKUDetails/api/index.ts');
    for (const b of branches) {
      const branchResult = { braname: b.braname };
      try {
        const detail = await apiMod.api.detailKU({
          coopname,
          coreBraname: b.braname,
          addressFull: b.addressFull,
          contactPhone: b.contactPhone,
          contactEmail: b.contactEmail,
          description: b.description,
          workingHours,
        });
        branchResult.detailOk = true;
        branchResult.detailId = detail?.id ?? null;
      } catch (e) {
        branchResult.detailOk = false;
        branchResult.detailError = String(e?.message ?? e);
      }
      try {
        const activated = await apiMod.api.setKUStatus({
          coopname,
          coreBraname: b.braname,
          status: 'ACTIVE',
        });
        branchResult.activateOk = true;
        branchResult.status = activated?.status ?? null;
      } catch (e) {
        branchResult.activateOk = false;
        branchResult.activateError = String(e?.message ?? e);
      }
      out.push(branchResult);
    }
    return out;
  }, { branches: BRANCHES, workingHours: WORKING_HOURS, coopname: env.COOPNAME });

  console.log('[activate-kus] result:', JSON.stringify(result, null, 2));
  console.log(`[activate-kus] detailCalls=${detailCalls} setStatusCalls=${setStatusCalls}`);

  // Перезагружаем страницу, чтобы store.load увидел свежие записи.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('text="ПВЗ Стола заказов"').first()
    .waitFor({ state: 'visible', timeout: 60000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-after-activation',
    'Страница ПВЗ после активации: три КУ (Красногорск, Одинцово, Мытищи) детализированы и переведены в статус «Активен», что разблокирует выбор ПВЗ в OrderCreateDialog.',
  );

  // Истинный success-сигнал — backend response (statusOk + status='ACTIVE' для всех 3),
  // а не UI-бэйджи: страница /market-pvz в текущей сборке стенда выдаёт
  // `Workspace not found for setting routes: market-pvz` (extension не подгрузился),
  // из-за чего store.load не запускается и любые UI-проверки врут.
  const allOk = result.every((r) => r.detailOk && r.activateOk && r.status === 'ACTIVE');
  if (!allOk) {
    throw new Error(
      `Активация неполная: ${JSON.stringify(result)}. ` +
      `detailCalls=${detailCalls} setStatusCalls=${setStatusCalls}`,
    );
  }
  const activeBadges = await page.locator('.q-badge:has-text("Активен")').count();
  console.log(`[activate-kus] backend OK; visible Активен badges (informational): ${activeBadges}`);
};
