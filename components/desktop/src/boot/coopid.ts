import { boot } from 'quasar/wrappers';
import { AuthV2Error, AuthV2ErrorCode, configureCoopId, configureOidc, getAccessToken } from '@coopenomics/auth';
import { client } from 'src/shared/api/client';
import { env } from 'src/shared/config';

/**
 * Boot контура CoopID (Эпик 11, Story 11.7) — конфигурация SDK `@coopenomics/auth`
 * и привязка источника access-токена к GraphQL-клиенту. Только на клиенте: vault,
 * oidc-client-ts и keystore — браузерные, на SSR контур CoopID не используется.
 *
 * Жёсткий инвариант Эпика 11: уже выданные легаси-токены продолжают работать до
 * логаута. `setAccessTokenProvider` безопасен для легаси-сессий конструктивно —
 * `getAccessToken()` бросает при отсутствии CoopID-сессии, и SDK молча откатывается
 * на bearer из `client.setToken` (его ставит легаси `globalStore.init`). См. D1/Эпик 7.
 */
export default boot(() => {
  // SSR: контур CoopID браузерный; на сервере глобальный provider/токен у singleton-
  // клиента ещё и протекал бы между запросами — поэтому конфигурируем только на клиенте.
  if (typeof window === 'undefined') return;

  // База controller'а кооператива для coop/* (vault, migration, recovery, refresh,
  // certificate). Ставим всегда: миграция «ключ→пароль» (Story 11.4) и vault работают
  // без OIDC-клиента. coop/*-эндпоинты живут на том же контроллере, что и GraphQL.
  configureCoopId({ apiUrl: env.BACKEND_URL });

  // Источник access-токена контура CoopID. Ставим безусловно: при легаси-сессии
  // провайдер бросает и SDK использует уже выставленный legacy-bearer (инвариант выше).
  client.setAccessTokenProvider(async () => {
    try {
      return await getAccessToken();
    } catch (error) {
      // Токен есть, но обновить его по сети не вышло (вкладка вернулась из фона
      // раньше связи). Запрос со старым токеном не упал бы, а получил бы гостевой
      // ответ — так рабочий стол приезжал без прав и уводил на «Недостаточно прав
      // доступа». Помечаем ошибку: SDK не отправит запрос, вызывающий код увидит
      // сетевую ошибку и оставит прежние данные. Остальные отказы провайдера
      // (нет CoopID-сессии, истёкшая сессия) — как раньше, решает сервер.
      if (error instanceof AuthV2Error && error.code === AuthV2ErrorCode.NetworkError) {
        Object.assign(error, { abortRequest: true });
      }
      throw error;
    }
  });

  // OIDC-клиент authentik (фактор-1 входа по паролю) — только когда заданы публичный
  // OAuth2-клиент и issuer. Без них desktop остаётся на легаси-входе по ключу (инфра
  // Эпика 5: публичный SPA+PKCE-клиент + same-origin раздача desktop с доменом authentik).
  // redirect_uri callback'а и скрытого silent-iframe — от origin desktop (same-origin).
  if (env.COOPID_ISSUER && env.COOPID_CLIENT_ID) {
    const origin = window.location.origin;
    configureOidc({
      clientId: env.COOPID_CLIENT_ID,
      // ОДИН адрес возврата на оба случая — и на обычный, и на тихий вход в
      // скрытом кадре. Раньше у тихого был свой `/auth/silent-callback`, которого
      // не существовало ни как страницы, ни в списке разрешённых адресов
      // authentik: тот отвечал `redirect_uri_no_match` (400), кадр молчал, и вход
      // валился по таймауту с невнятным «IFrame timed out without a response».
      //
      // Страница статическая (public/auth/callback.html) и делает ровно одно —
      // передаёт адрес родительскому окну. Маршрут приложения тут не годится: в
      // скрытый кадр тянулся весь рабочий стол, и это само по себе не укладывалось
      // в десятисекундный таймаут библиотеки.
      //
      // Адрес обязан совпадать с разрешённым в authentik символ в символ — он
      // задан там через COOPID_REDIRECT_URI.
      redirectUri: `${origin}/auth/callback.html`,
      silentRedirectUri: `${origin}/auth/callback.html`,
      scope: 'openid profile',
    });
  }
});
