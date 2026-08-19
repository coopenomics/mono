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
      'Серверная расшифровка ключа участника запрещена: расшифровать может только владелец пароля на клиенте',
    );
  }
}
