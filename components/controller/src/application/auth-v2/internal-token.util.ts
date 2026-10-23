import { timingSafeEqual } from 'node:crypto';

/**
 * Сверка shared-токена внутреннего контура CoopID (authentik → controller).
 *
 * Сравнение постоянного времени: внутренние маршруты (`/coop/internal/*`) не
 * маршрутизируются наружу, но токен всё равно нельзя сверять обычным `===` —
 * разница во времени отказа выдаёт длину и посимвольное совпадение тому, кто
 * уже оказался в docker-сети.
 *
 * Пустой ожидаемый токен означает несконфигурированный контур: в этом случае
 * не проходит никакой запрос, включая пустой (иначе отсутствие настройки
 * открывало бы внутренние маршруты всем).
 *
 * @param provided — значение заголовка `X-Authentik-Webhook-Token` запроса.
 * @param expected — ожидаемый токен из конфигурации контроллера.
 * @returns `true`, если токены совпали.
 */
export function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
