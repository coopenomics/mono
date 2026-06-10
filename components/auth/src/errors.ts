/**
 * Зеркало enum'а ошибок auth-v2 контроллера (источник истины — controller,
 * появится в Story 1.11). Расширяется синхронно с серверной стороной.
 */
export enum AuthV2ErrorCode {
  NotImplemented = 'not_implemented',
  InvalidCredentials = 'invalid_credentials',
  WeakPassword = 'weak_password',
  SessionBindingReused = 'session_binding_reused',
  SessionBindingExpired = 'session_binding_expired',
  TimestampTooOld = 'timestamp_too_old',
  VaultDecryptionFailed = 'vault_decryption_failed',
  CertificateExpired = 'certificate_expired',
  CertificateRevoked = 'certificate_revoked',
  ChainVerificationFailed = 'chain_verification_failed',
  CooposDegraded = 'coopos_degraded',
  NetworkError = 'network_error',
  WalletLocked = 'wallet_locked',
  ClientWalletMismatch = 'client_wallet_mismatch',
}

/**
 * Ошибки SDK в формате OAuth 2.0 ({ error, error_description }): код — машинный,
 * description — человеко-читаемое сообщение для UI.
 */
export class AuthV2Error extends Error {
  readonly code: AuthV2ErrorCode

  constructor(code: AuthV2ErrorCode, description: string) {
    super(description)
    this.name = 'AuthV2Error'
    this.code = code
  }

  toJSON(): { error: AuthV2ErrorCode, error_description: string } {
    return { error: this.code, error_description: this.message }
  }
}

/** Внутренний помощник для каркаса: единообразный отказ нереализованных методов. */
export function notImplemented(method: string): never {
  throw new AuthV2Error(
    AuthV2ErrorCode.NotImplemented,
    `Метод ${method}() ещё не реализован: скелет SDK (Story 1.2), реализация приходит историями Эпиков 1–2.`,
  )
}
