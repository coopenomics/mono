// Сценарий: оператор ждёт пока инстанс кооператива перейдёт в статус ACTIVE.
//
// Жизненный цикл инстанса (provider-backend → instance.status):
//   PENDING  → инстанс зарегистрирован, идут Ansible-шаги (progress 0-100%)
//   INSTALL  → выполняется установка
//   ACTIVE   → кооператив поднят и доступен на своём домене
//   ERROR    → шаг провалился, требуется resume
//   BLOCKED  → инстанс остановлен оператором
//   RENT     → инстанс на платном хостинге
//
// UI-механика: ConnectionAgreementPage.startInstanceAutoRefresh(30000) делает
// polling каждые 30 секунд, провайдерский дашборд тоже периодически
// обновляет данные. Сценарий снимает реальное состояние из provider-backend
// (без override). После 2026-05-16 voskhod реально доехал до ACTIVE через
// полный E2E, поэтому override status='active' больше не нужен — снимаем
// то, что приходит из API.

const PROVIDER_FRONTEND = process.env.PROVIDER_FRONTEND_URL || 'http://localhost:3009';
const PROVIDER_BACKEND = process.env.PROVIDER_BACKEND_URL || 'http://127.0.0.1:3005';
const SERVER_SECRET = process.env.PROVIDER_SERVER_SECRET || 'e2e-fixture-secret-DO-NOT-USE-IN-PROD';
const TARGET_COOP = process.env.TARGET_COOP || 'voskhod';

export const meta = {
  title: 'Оператор наблюдает за активацией инстанса до статуса ACTIVE',
  docPath: 'new/onboarding/06-wait-instance-active.md',
  assetsDir: 'assets/new/onboarding/06-wait-instance-active',
  role: 'operator',
};

const PROVIDER_BACKEND_PATTERN = '**/instances/**';

// Мутатор JSON-ответа: расплющивает organization_data → private_data
// (CooperativePage.vue ожидает плоскую структуру). Это не override
// состояния — UI просто требует плоский формат private_data.
function rewriteResponse(body) {
  try {
    const json = JSON.parse(body);
    const flatten = (item) => {
      const data = item?.organization?.private_data;
      if (data?.organization_data && !data.details) {
        item.organization.private_data = { ...data.organization_data, type: data.type };
      }
      return item;
    };
    const fixed = Array.isArray(json) ? json.map(flatten) : flatten(json);
    return JSON.stringify(fixed);
  } catch {
    return body;
  }
}

async function withRoute(context) {
  await context.unrouteAll().catch(() => {});
  await context.route(PROVIDER_BACKEND_PATTERN, async (route) => {
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
    const body = rewriteResponse(await response.text());
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
}

export default async ({ page, context, shot }) => {
  // Снимаем реальное состояние инстанса (что provider-backend сейчас отдаёт).
  // Если voskhod дошёл до ACTIVE — на скриншоте будет финальный экран; если
  // активация ещё идёт — будет PENDING/INSTALL с реальным progress. Никаких
  // status-override'ов: что есть, то и фиксируем в документации.
  await withRoute(context);
  await page.goto(`${PROVIDER_FRONTEND}/#/cooperative/${TARGET_COOP}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(
    page,
    '01-active',
    `Инстанс «${TARGET_COOP}» — реальный статус, отданный provider-backend (без override). После полного E2E ожидается ACTIVE/100, blockchain активен, кооператив доступен на своём домене. Пайщики Партнёр-1 в это время получают ConnectionDashboard вместо ConnectionAgreementStepper.`,
  );
};
