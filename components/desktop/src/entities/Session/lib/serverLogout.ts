import { env } from 'src/shared/config';

/**
 * Серверный выход: отзыв токенов и снятие cookie сессии (`POST /coop/logout`,
 * без guard и идемпотентен — годится и для мёртвых токенов, и без них).
 *
 * Без него выход чистил только браузер: cookie сессии оставалась, и серверный
 * рендер при следующем заходе снова подставлял прежнего пайщика. 16.10.2026 на
 * стенде 5 так в регистрацию нового пайщика подмешивался аккаунт принятого:
 * после создания учётки на секунду появлялось меню кабинета.
 *
 * Сбой сети выход не останавливает — браузер чистится всё равно.
 */
export async function serverLogout(tokens: { accessToken?: string | null; refreshToken?: string | null } = {}): Promise<void> {
  try {
    await fetch(`${env.BACKEND_URL}/coop/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refresh_token: tokens.refreshToken ?? undefined,
        access_token: tokens.accessToken ?? undefined,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.warn('[logout] сервер не ответил — браузер очищен без него:', e instanceof Error ? e.message : e);
  }
}
