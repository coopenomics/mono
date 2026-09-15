import { currentTokens } from '@coopenomics/auth';
import { env } from 'src/shared/config';

/**
 * Cookie сессии для уже вошедшего пайщика.
 *
 * Серверный рендер узнаёт пайщика по httpOnly-cookie, которую бэкенд ставит при
 * входе и обновлении токенов. У сессий, начатых до её появления, cookie нет, а
 * access-токен живёт сотни дней — обновления можно не дождаться. Поэтому, когда
 * сервер не узнал пайщика, а сессия в браузере есть, клиент один раз просит
 * бэкенд поставить cookie по своему bearer-токену. Следующий заход уже
 * рендерится для пайщика.
 *
 * Токен без идентификатора сессии cookie дать не может — такой пайщик получит
 * её при следующем входе; это не ошибка, только заметка в консоли.
 */
export async function ensureSessionCookie(legacyAccessToken?: string | null): Promise<void> {
  const token = currentTokens()?.accessToken ?? legacyAccessToken ?? null;
  if (!token) return;
  try {
    const res = await fetch(`${env.BACKEND_URL}/coop/session/cookie`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[session-cookie] бэкенд ответил ${res.status} — cookie сессии не поставлена`);
      return;
    }
    const body = (await res.json()) as { status?: string };
    if (body.status === 'refresh_required') {
      console.warn('[session-cookie] токен без идентификатора сессии — cookie появится при следующем входе');
    }
  } catch (e) {
    console.warn('[session-cookie] не удалось поставить cookie сессии:', e instanceof Error ? e.message : e);
  }
}
