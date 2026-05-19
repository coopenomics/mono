// Сценарий: реальное наблюдение за инстансом voskhod от старта до ACTIVE
// БЕЗ playwright-override. Опрашивает provider-backend напрямую через
// context.request (APIRequest из node, без CORS), parallel браузер
// показывает Vue-страницу провайдера; делает шот на каждой смене status
// и финальный шот когда status=active.
//
// Реальные стадии (см. provider-backend/StartupWorkflowService):
//   PENDING (Hostkey order_instance + getServerDetails polling)
//     → RENT (server полу­чен у Hostkey, идёт wait until ssh-ready)
//     → INSTALL (Ansible: setup → coopos → certbot → coopback)
//     → ACTIVE (инстанс доступен на домене testnet300.coopenomics.world)
//
// Таймаут: 60 минут.

const PROVIDER_FRONTEND = process.env.PROVIDER_FRONTEND_URL || 'http://localhost:3009';
const PROVIDER_BACKEND = process.env.PROVIDER_BACKEND_URL || 'http://127.0.0.1:3005';
const SERVER_SECRET = process.env.PROVIDER_SERVER_SECRET || 'e2e-fixture-secret-DO-NOT-USE-IN-PROD';
const TARGET_COOP = process.env.TARGET_COOP || 'voskhod';
const POLL_INTERVAL_MS = 30_000;
const TIMEOUT_MS = Number(process.env.WATCH_TIMEOUT_MS) || 60 * 60_000;

export const meta = {
  title: 'Реальное наблюдение за активацией voskhod до ACTIVE',
  docPath: 'new/onboarding/07-real-active-watch.md',
  assetsDir: 'assets/new/onboarding/07-real-active-watch',
  role: 'operator',
};

const PROVIDER_BACKEND_PATTERN = '**/instances/**';

// Брошируем CORS+server-secret для браузера, чтобы Vue-страница тоже видела
// данные (CooperativePage.vue делает свои запросы из browser-origin).
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

async function installRoute(context) {
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
  await installRoute(context);
  const url = `${PROVIDER_FRONTEND}/#/cooperative/${TARGET_COOP}`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const fetchInstance = async () => {
    try {
      const r = await context.request.get(`${PROVIDER_BACKEND}/instances/${TARGET_COOP}`, {
        headers: { 'server-secret': SERVER_SECRET },
        timeout: 10_000,
      });
      if (!r.ok()) {
        console.log(`[07-real-active-watch] backend returned status=${r.status()}`);
        return null;
      }
      const j = await r.json();
      return j.instance || null;
    } catch (e) {
      console.log(`[07-real-active-watch] fetchInstance error: ${e.message}`);
      return null;
    }
  };

  let lastStatus = null;
  let lastBucket = -1;
  let shotIdx = 0;
  const started = Date.now();

  while (Date.now() - started < TIMEOUT_MS) {
    const inst = await fetchInstance();
    const status = inst?.status || 'unknown';
    const progress = inst?.progress ?? 0;
    const bucket = Math.floor(progress / 25) * 25;
    const errMsg = inst?.error_message || '';
    const ip = inst?.ansible_host || '';

    const statusChanged = status !== lastStatus;
    const bucketChanged = bucket !== lastBucket;

    if (statusChanged || bucketChanged) {
      shotIdx += 1;
      const safeStatus = status.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const slug = String(shotIdx).padStart(2, '0') + '-' + safeStatus + '-' + bucket;
      const caption = 'Инстанс «' + TARGET_COOP + '»: status=' + status
        + ', progress=' + progress + '%'
        + (ip ? ', ansible_host=' + ip : '')
        + (errMsg ? ', сообщение: ' + errMsg : '');
      console.log('[07-real-active-watch] ' + slug + ' :: ' + caption);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, slug, caption);
      lastStatus = status;
      lastBucket = bucket;
    }

    if (status === 'active') {
      console.log('[07-real-active-watch] reached ACTIVE — stopping');
      try {
        await page.goto(`${PROVIDER_FRONTEND}/#/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await shot(page, '99-provider-home-with-active', 'Главная провайдера: инстанс voskhod уже ACTIVE и доступен в левом меню.');
      } catch {}
      return;
    }
    if (status === 'error') {
      console.log('[07-real-active-watch] reached ERROR — stopping');
      return;
    }

    await page.waitForTimeout(POLL_INTERVAL_MS);
  }

  console.log('[07-real-active-watch] TIMEOUT — финальный шот того, что есть');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await shot(page, '99-timeout', 'Таймаут наблюдения, инстанс ещё не достиг ACTIVE.');
};
