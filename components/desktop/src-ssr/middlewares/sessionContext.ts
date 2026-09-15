import { ssrMiddleware } from 'quasar/wrappers';

/**
 * Кто запросил документ — узнаём до рендера.
 *
 * Ключи и токены CoopID живут в браузере, в документ-запросе их нет, поэтому
 * раньше каждый серверный рендер был гостевым, а клиент «входил заново» уже
 * после гидрации. С cookie сессии (`coop_session`, ставит бэкенд при входе)
 * сервер спрашивает у контроллера аккаунт и рабочий стол пайщика и рендерит
 * страницу сразу его. Ответ кладётся в `res.locals.coopSession`, boot-файл
 * инициализации раскладывает его по сторам.
 *
 * Обращение идёт по внутреннему адресу (SSR_BACKEND_URL) с server-secret:
 * браузеру эта точка недоступна, cookie без секрета ничего не открывает.
 * Любой сбой — `unknown`: страница рендерится как для гостя, а личность
 * восстановит клиент, как и прежде. Ложного «войдите» из-за сети не бывает.
 */
export interface CoopSessionContext {
  status: 'guest' | 'active' | 'expired' | 'unknown';
  username?: string;
  account?: unknown;
  desktop?: unknown;
}

const SESSION_COOKIE = 'coop_session=';
const TIMEOUT_MS = 5000;

export default ssrMiddleware(({ app }) => {
  app.use(async (req, res, next) => {
    const accept = String(req.headers.accept ?? '');
    if (req.method !== 'GET' || !accept.includes('text/html')) return next();

    const cookie = req.headers.cookie;
    if (!cookie || !cookie.includes(SESSION_COOKIE)) {
      res.locals.coopSession = { status: 'guest' } satisfies CoopSessionContext;
      return next();
    }

    const base = process.env.SSR_BACKEND_URL || process.env.BACKEND_URL;
    const secret = process.env.SERVER_SECRET;
    if (!base || !secret) {
      console.warn('[ssr-session] нет SSR_BACKEND_URL/BACKEND_URL или SERVER_SECRET — рендерим гостя');
      res.locals.coopSession = { status: 'unknown' } satisfies CoopSessionContext;
      return next();
    }

    try {
      const r = await fetch(`${base}/coop/ssr-context`, {
        headers: { cookie, 'server-secret': secret },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      res.locals.coopSession = r.ok
        ? ((await r.json()) as CoopSessionContext)
        : ({ status: 'unknown' } satisfies CoopSessionContext);
      if (!r.ok) console.warn(`[ssr-session] контроллер ответил ${r.status} — рендерим гостя`);
    } catch (e) {
      console.warn('[ssr-session] контроллер недоступен — рендерим гостя:', e instanceof Error ? e.message : e);
      res.locals.coopSession = { status: 'unknown' } satisfies CoopSessionContext;
    }
    next();
  });
});
