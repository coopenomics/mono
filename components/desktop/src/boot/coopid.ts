import { boot } from 'quasar/wrappers';
import { configureCoopId, configureOidc, getAccessToken } from '@coopenomics/auth';
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
  client.setAccessTokenProvider(() => getAccessToken());

  // OIDC-клиент authentik (фактор-1 входа по паролю) — только когда заданы публичный
  // OAuth2-клиент и issuer. Без них desktop остаётся на легаси-входе по ключу (инфра
  // Эпика 5: публичный SPA+PKCE-клиент + same-origin раздача desktop с доменом authentik).
  // redirect_uri callback'а и скрытого silent-iframe — от origin desktop (same-origin).
  if (env.COOPID_ISSUER && env.COOPID_CLIENT_ID) {
    const origin = window.location.origin;
    configureOidc({
      clientId: env.COOPID_CLIENT_ID,
      redirectUri: `${origin}/auth/callback`,
      silentRedirectUri: `${origin}/auth/silent-callback`,
      scope: 'openid profile',
    });
  }
});
