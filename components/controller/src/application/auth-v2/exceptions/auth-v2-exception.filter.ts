import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';

/**
 * Единый маппинг типизированной ошибки контура auth-v2 (CoopID) в HTTP-статус.
 * Тело ответа — формат OAuth 2.0 `{ error, error_description }` (см. AuthV2Error).
 * Зеркало кодов держит SDK `@coopenomics/auth` (errors.ts) — клиент по `error`
 * выбирает человеко-читаемое сообщение и actionable-подсказку.
 *
 * До Story 1.11 маппинг дублировался inline в каждом контроллере (`toHttp`).
 * Здесь он сведён в один источник: контроллеры контура просто пробрасывают
 * AuthV2Error, фильтр (`@Catch(AuthV2Error)`) единообразно переводит его в HTTP.
 *
 * Подключается через controller-scoped `@UseFilters` (НЕ APP_FILTER): в приложении
 * есть глобальный catch-all `GraphQLExceptionFilter` (useGlobalFilters), который
 * перехватывает AuthV2Error раньше любого APP_FILTER и переформатирует ответ в
 * `{statusCode, message, error}` со статусом 500. Controller-scoped фильтр имеет
 * приоритет над глобальным и пишет OAuth2-тело напрямую в response — глобальный
 * фильтр для этой ошибки уже не вызывается (проверено живьём, Story 1.11).
 */
const STATUS_BY_CODE: Record<AuthV2ErrorCode, number> = {
  // 503: блокчейн/инфраструктура временно недоступна — клиенту «повторить позже».
  [AuthV2ErrorCode.CooposDegraded]: HttpStatus.SERVICE_UNAVAILABLE,
  // 429: сработал rate-limit контура входа (Story 9.1) — слишком много попыток.
  [AuthV2ErrorCode.TooManyAttempts]: HttpStatus.TOO_MANY_REQUESTS,
  // 429: rate-limit recovery (Story 3.1) — слишком много запросов восстановления.
  [AuthV2ErrorCode.TooManyRecoveryAttempts]: HttpStatus.TOO_MANY_REQUESTS,
  // 401: неверный код второго фактора (Story 3.6) — TOTP не прошёл.
  [AuthV2ErrorCode.InvalidTwoFactorCode]: HttpStatus.UNAUTHORIZED,
  // 400: второй фактор не подключён, а операция его требует (Story 3.6).
  [AuthV2ErrorCode.TwoFactorNotEnrolled]: HttpStatus.BAD_REQUEST,
  // 400: recovery-токен недействителен/истёк/уже использован (Story 3.2).
  [AuthV2ErrorCode.InvalidRecoveryToken]: HttpStatus.BAD_REQUEST,
  // 400: offline-код восстановления неверен/использован (Story 3.4).
  [AuthV2ErrorCode.InvalidOfflineCode]: HttpStatus.BAD_REQUEST,
  // 403: серверная расшифровка ключа запрещена инвариантом (не «не авторизован»).
  [AuthV2ErrorCode.VaultServerDecryptionForbidden]: HttpStatus.FORBIDDEN,
  // 400: некорректный ввод/данные клиента (AC Story 1.11 — invalid_credentials → 400).
  [AuthV2ErrorCode.InvalidCredentials]: HttpStatus.BAD_REQUEST,
  // 400: пароль не проходит требования стойкости (Story 11.4 / FR58).
  [AuthV2ErrorCode.WeakPassword]: HttpStatus.BAD_REQUEST,
  [AuthV2ErrorCode.VaultDecryptionFailed]: HttpStatus.BAD_REQUEST,
  // 401: провал второго этапа аутентификации (владение ключом не доказано).
  [AuthV2ErrorCode.TimestampTooOld]: HttpStatus.UNAUTHORIZED,
  [AuthV2ErrorCode.SessionBindingReused]: HttpStatus.UNAUTHORIZED,
  [AuthV2ErrorCode.SessionBindingExpired]: HttpStatus.UNAUTHORIZED,
  [AuthV2ErrorCode.ChainVerificationFailed]: HttpStatus.UNAUTHORIZED,
  // 403: уровень верификации пайщика ниже требуемого правилом действия (Story 4.2) —
  // «доступ запрещён по уровню доверия», пайщик аутентифицирован (не 401).
  [AuthV2ErrorCode.InsufficientVerification]: HttpStatus.FORBIDDEN,
};

@Catch(AuthV2Error)
export class AuthV2ExceptionFilter implements ExceptionFilter<AuthV2Error> {
  catch(exception: AuthV2Error, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.UNAUTHORIZED;
    res.status(status).json(exception.toResponse());
  }
}
