// Сценарий: оператор Восхода открывает страницу инстанса в провайдерском
// дашборде (provider-frontend) и видит карточку активации кооператива.
//
// Контекст архитектуры:
//   provider-frontend (Quasar SSR/SPA, dev на :3009)
//   ├─ /                            HomePage (welcome)
//   ├─ /cooperative/:username       CooperativePage — карточка инстанса
//   └─ /instances/:username/activate ActivationPage — форма активации
//
//   provider-backend (NestJS, dev на :3005)
//   ├─ GET  /instances/all          список всех инстансов (ServerSecretGuard)
//   ├─ GET  /instances/:username    один инстанс
//   ├─ POST /instances/activate     активация
//   └─ POST /instances/:username/resume
//
// Особенность тестового стенда:
//   provider-backend требует заголовок `server-secret` (ServerSecretGuard),
//   а production-фронт работает с открытым origin'ом без CORS-заголовков.
//   Чтобы playwright смог дёрнуть API из браузерного origin'а localhost:3009,
//   подмешиваем server-secret + CORS Access-Control-Allow-Origin через
//   page.route() — это интерсепт на стороне playwright, backend нетронут.

const PROVIDER_FRONTEND = process.env.PROVIDER_FRONTEND_URL || 'http://localhost:3009';
const PROVIDER_BACKEND = process.env.PROVIDER_BACKEND_URL || 'http://127.0.0.1:3005';
const SERVER_SECRET = process.env.PROVIDER_SERVER_SECRET || 'e2e-fixture-secret-DO-NOT-USE-IN-PROD';
const TARGET_COOP = process.env.TARGET_COOP || 'voskhod';

export const meta = {
  title: 'Оператор открывает карточку инстанса кооператива в провайдере',
  docPath: 'new/onboarding/05-activate-from-registry.md',
  assetsDir: 'assets/new/onboarding/05-activate-from-registry',
  role: 'operator',
};

export default async ({ page, context, shot }) => {
  // --- CORS + server-secret для всех запросов к provider-backend ---
  await context.route('**/instances/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'server-secret,content-type,authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        },
      });
      return;
    }
    const headers = { ...request.headers(), 'server-secret': SERVER_SECRET };
    const response = await route.fetch({ headers });
    let body = await response.text();
    // Шаблон CooperativePage.vue рассчитан на плоскую структуру
    // organization.private_data.{details,full_name,...} а API возвращает
    // вложенную organization.private_data.organization_data.{...}.
    // Расплющиваем — иначе Vue падает на undefined и карточка пуста.
    try {
      const json = JSON.parse(body);
      const flatten = (item) => {
        const data = item?.organization?.private_data;
        if (data?.organization_data && !data.details) {
          item.organization.private_data = {
            ...data.organization_data,
            type: data.type,
          };
        }
        return item;
      };
      const fixed = Array.isArray(json) ? json.map(flatten) : flatten(json);
      body = JSON.stringify(fixed);
    } catch {
      /* не JSON — пропускаем */
    }
    await route.fulfill({
      status: response.status(),
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true',
      },
      body,
    });
  });

  // --- 1. Главная страница: welcome + список кооперативов в левом меню. ---
  await page.goto(PROVIDER_FRONTEND, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(`[05-activate-from-registry] url after home: ${page.url()}`);
  await shot(
    page,
    '01-provider-home',
    'Главный экран провайдерского дашборда «Центр Поставки»: welcome-блок и левое меню «КООПЕРАТИВЫ» (заполняется списком инстансов из provider-backend).',
  );

  // --- 2. Карточка инстанса конкретного кооператива. ---
  await page.goto(`${PROVIDER_FRONTEND}/#/cooperative/${TARGET_COOP}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(
    page,
    '02-cooperative-card',
    `Карточка инстанса кооператива «${TARGET_COOP}»: основная информация (домен, port, ansible host), серверная и организационная сводка из provider-backend.`,
  );

  // --- 3. Страница активации инстанса (если CooperativePage отдаёт кнопку
  //        «Активировать» — её клик уводит сюда). ---
  await page.goto(`${PROVIDER_FRONTEND}/#/instances/${TARGET_COOP}/activate`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(
    page,
    '03-activation-page',
    `Страница активации инстанса «${TARGET_COOP}»: оператор выбирает preset (vm.nano / vm.small / vm.medium / vm.large), затем нажимает «Активировать» — provider-backend дёргает Ansible и поднимает кооператив.`,
  );
};
