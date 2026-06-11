import { ForbiddenException } from '@nestjs/common';

/**
 * Внутренняя причина отказа авторизации (для лога/диагностики). Наружу НЕ уходит:
 * клиенту отдаётся обобщённый `authorization_denied` без указания, какой именно слой
 * отказал (AC Story 6.4 — «не раскрывает специфику для security»). Статусы — enum.
 */
export enum AuthorizationDenialReason {
  /** В запросе нет авторизованного пайщика (JWT-guard не проставил user). */
  NoSubjectUser = 'no_subject_user',
  /** Ability (Layer 1+2) не разрешает пару action+subject. */
  InsufficientAbility = 'insufficient_ability',
  /** Политика Layer 3 вернула false. */
  PolicyDenied = 'policy_denied',
}

/** Публичный код отказа — единый, без раскрытия слоя/правила. */
export const AUTHORIZATION_DENIED_CODE = 'authorization_denied';

/**
 * 403 с обобщённым кодом. Точную причину (reason) логирует вызывающий — она не
 * попадает в ответ. Формат тела совместим с auth-v2 ({ error, error_description }).
 */
export function authorizationDenied(): ForbiddenException {
  return new ForbiddenException({
    error: AUTHORIZATION_DENIED_CODE,
    error_description: 'Недостаточно прав для выполнения операции',
  });
}
