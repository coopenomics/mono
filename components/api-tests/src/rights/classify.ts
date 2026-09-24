/**
 * Исход вызова для матрицы прав. Коды — из GraphQLExceptionFilter контроллера
 * и гвардов extension-kit / Стола заказов (extensions.code).
 *
 *  - deny-auth    — не вошёл: нет токена, токен плохой, сессия закрыта;
 *  - deny-role    — вошёл, но роль или статус не пускают (гвард);
 *  - deny-service — проверка прав внутри сервиса («чужой объект», «не
 *                   председатель участка»);
 *  - pass         — проверки прав пройдены: ответ или деловая ошибка
 *                   (объекта нет, неверные данные — после гвардов);
 *  - invalid      — вызов не прошёл проверку схемы (дефект генератора);
 *  - throttled    — ограничение частоты, решение гварда неизвестно.
 */
import type { GqlError } from '../core/client'

export type Outcome = 'deny-auth' | 'deny-role' | 'deny-service' | 'pass' | 'invalid' | 'throttled'

const AUTH = new Set(['401', 'UNAUTHENTICATED', 'KIT_USER_NOT_AUTHORIZED', 'AUTH_SESSION_TERMINATED', 'KIT_SESSION_ENDED', 'MARKETPLACE_AUTH_REQUIRED', 'GRAPHQL_FIELD_UNAUTHORIZED'])
const ROLE = new Set(['KIT_INSUFFICIENT_RIGHTS', 'KIT_MEMBERS_ONLY', 'KIT_AUTHORIZED_USER_REQUIRED', 'KIT_ACTIVE_MEMBERS_ONLY', 'MARKETPLACE_NOT_A_MEMBER', 'GRAPHQL_FIELD_FORBIDDEN', 'FORBIDDEN'])
const INVALID = new Set(['GRAPHQL_VALIDATION_FAILED', 'BAD_USER_INPUT', 'GRAPHQL_PARSE_FAILED'])
const THROTTLED = new Set(['429', 'GRAPHQL_RATE_LIMITED', 'THROTTLED'])

export function classify(err: GqlError | null): Outcome {
  if (!err)
    return 'pass'
  const code = err.code === null ? '' : String(err.code)
  const msg = err.message
  if (THROTTLED.has(code))
    return 'throttled'
  if (INVALID.has(code) || /^(Variable "\$|Unknown argument|Field ".*" of required type|Cannot query field|Syntax Error)/.test(msg))
    return 'invalid'
  if (AUTH.has(code) || /^Unauthorized$/.test(msg))
    return 'deny-auth'
  // Гварды Стола заказов отвечают по-английски «Forbidden: marketplace …»,
  // CASL — «Forbidden resource»/«Forbidden Exception», ядро — по-русски.
  if (ROLE.has(code) || /^Forbidden: marketplace/.test(msg) || /Недостаточно прав доступа|Доступ только для пайщиков/.test(msg))
    return 'deny-role'
  if (code === '403' || /FORBIDDEN|NOT_TRUSTEE|SELF_ONLY|FOREIGN|NOT_OWNER|ACCESS_DENIED|NOT_ALLOWED/.test(code) || /^Forbidden/.test(msg))
    return 'deny-service'
  return 'pass'
}

export function isDenied(o: Outcome): boolean {
  return o === 'deny-auth' || o === 'deny-role' || o === 'deny-service'
}
