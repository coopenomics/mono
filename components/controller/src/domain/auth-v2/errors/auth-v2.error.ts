import { HttpStatus } from '@nestjs/common';
import { t } from '~/i18n';
/** Зеркало enum'а ошибок SDK @coopenomics/auth (источник контракта един). */
export enum AuthV2ErrorCode {
  InvalidCredentials = 'invalid_credentials',
  WeakPassword = 'weak_password',
  VaultDecryptionFailed = 'vault_decryption_failed',
  VaultServerDecryptionForbidden = 'vault_server_decryption_forbidden',
  TimestampTooOld = 'timestamp_too_old',
  SessionBindingReused = 'session_binding_reused',
  SessionBindingExpired = 'session_binding_expired',
  ChainVerificationFailed = 'chain_verification_failed',
  CooposDegraded = 'coopos_degraded',
  TooManyAttempts = 'too_many_attempts',
  TooManyRecoveryAttempts = 'too_many_recovery_attempts',
  InvalidTwoFactorCode = 'invalid_2fa_code',
  TwoFactorNotEnrolled = 'two_factor_not_enrolled',
  InvalidRecoveryToken = 'invalid_recovery_token',
  InvalidOfflineCode = 'invalid_offline_code',
  InsufficientVerification = 'insufficient_verification',
  /** Ротация ключа недоступна: пайщик ещё не принят (кандидат) — регистрация не завершена. */
  RotationUnavailable = 'rotation_unavailable',
  /** Challenge второго фактора входа неизвестен или истёк — вход начинается заново. */
  LoginChallengeExpired = 'login_challenge_expired',
}

/** Ошибки auth-v2 в формате OAuth 2.0 ({ error, error_description }). */
export class AuthV2Error extends Error {
  constructor(
    readonly code: AuthV2ErrorCode,
    description: string,
  ) {
    super(description);
    this.name = 'AuthV2Error';
  }

  toResponse(): { error: AuthV2ErrorCode; error_description: string } {
    return { error: this.code, error_description: this.message };
  }
}

/**
 * Инвариант CoopID: сервер никогда не расшифровывает ключ пайщика.
 * Бросается в рантайме, если код пытается это сделать (страховка к type-ban).
 */
export class VaultServerDecryptionForbiddenError extends AuthV2Error {
  constructor() {
    super(
      AuthV2ErrorCode.VaultServerDecryptionForbidden,
      t('authV2.authV2Error.vaultServerDecryptionForbidden'),
    );
  }
}

/**
 * HTTP-статус ошибки контура auth-v2. Одна таблица на REST-фильтр контура и
 * на общий фильтр GraphQL: мутации двухфакторки и восстановления в GraphQL
 * до 25.09.2026 отвечали на те же отказы статусом 500 (C28-80).
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
  // 409: ротация ключа недоступна кандидату (регистрация не завершена) —
  // клиент по этому коду прозрачно повторяет миграцию без ротации.
  [AuthV2ErrorCode.RotationUnavailable]: HttpStatus.CONFLICT,
  [AuthV2ErrorCode.VaultDecryptionFailed]: HttpStatus.BAD_REQUEST,
  // 401: провал второго этапа аутентификации (владение ключом не доказано).
  [AuthV2ErrorCode.TimestampTooOld]: HttpStatus.UNAUTHORIZED,
  [AuthV2ErrorCode.SessionBindingReused]: HttpStatus.UNAUTHORIZED,
  [AuthV2ErrorCode.SessionBindingExpired]: HttpStatus.UNAUTHORIZED,
  [AuthV2ErrorCode.ChainVerificationFailed]: HttpStatus.UNAUTHORIZED,
  // 401: challenge второго фактора входа истёк/неизвестен — вход начинается заново.
  [AuthV2ErrorCode.LoginChallengeExpired]: HttpStatus.UNAUTHORIZED,
  // 403: уровень верификации пайщика ниже требуемого правилом действия (Story 4.2) —
  // «доступ запрещён по уровню доверия», пайщик аутентифицирован (не 401).
  [AuthV2ErrorCode.InsufficientVerification]: HttpStatus.FORBIDDEN,
};

export function authV2HttpStatus(code: AuthV2ErrorCode): number {
  return STATUS_BY_CODE[code] ?? HttpStatus.UNAUTHORIZED;
}
