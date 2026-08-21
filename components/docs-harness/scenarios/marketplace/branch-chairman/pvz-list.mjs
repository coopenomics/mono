// Сценарий: Стол ПВЗ — «ПВЗ кооператива».
// Список всех пунктов выдачи. Видно председателю КУ (operator/branch-chairman).
// Маршрут /<coopname>/market-admin/issuance-points (workspace market-pvz).

import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAsChairman } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя ПВЗ — список ПВЗ кооператива',
  assetsDir: 'assets/new/marketplace/chairman/branches',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAsChairman(page);
  await dismissOnboardingDialogs(page);

  // Навигация с ретраем: per-route guard /market-pvz/* асинхронно проверяет
  // роли (operator/admin) и может отбросить до загрузки marketplace-сессии;
  // плюс свежий онбординг председателя на пересозданном стенде. Повторяем,
  // пока URL не закрепится на market-pvz/list.
  const target = `${env.APP_PREFIX}/${env.COOPNAME}/market-admin/issuance-points`;
  for (let attempt = 0; attempt < 6; attempt++) {
    // Полный перезагруз документа (через about:blank) — иначе market-стор
    // держит loaded=true с пустыми ролями после первой гонки fetchRoles, и
    // hash-навигация роли не перезапрашивает → вечный permissionDenied.
    if (attempt > 0) await page.goto('about:blank');
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await dismissOnboardingDialogs(page);
    const url = page.url();
    if (url.includes('market-pvz/list') && !(await page.locator('text=Недостаточно прав доступа').count())) break;
    await page.waitForTimeout(2500);
  }
  // Дождаться, пока Yandex JS API инициализирует карту в контейнере
  // (ymaps вставляет свой DOM/canvas внутрь .ku-map-with-list__map), затем
  // дать тайлам прогрузиться. Без этого кадр ловит пустой белый контейнер.
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector('.ku-map-with-list__map');
        return !!el && el.children.length > 0;
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(6000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-pvz-list',
    `Список ПВЗ кооператива с картой Яндекса: на карте — плейсмарки кооперативных участков, справа/снизу — список ПВЗ с адресом и статусом. URL: \`${page.url()}\`.`,
  );
};
