import { lt } from '@coopenomics/i18n'
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
  TooManyAttempts = 'too_many_attempts',
  TooManyRecoveryAttempts = 'too_many_recovery_attempts',
  InvalidTwoFactorCode = 'invalid_2fa_code',
  TwoFactorNotEnrolled = 'two_factor_not_enrolled',
  InvalidRecoveryToken = 'invalid_recovery_token',
  /** Ключ уже сменён, а автоматический вход следом не удался — повторять восстановление нечем. */
  RecoveryDoneLoginFailed = 'recovery_done_login_failed',
  InvalidOfflineCode = 'invalid_offline_code',
  InsufficientVerification = 'insufficient_verification',
  /** Ротация ключа недоступна: пайщик ещё не принят (кандидат) — регистрация не завершена. */
  RotationUnavailable = 'rotation_unavailable',
  /** Вход требует второго подтверждения (2FA): сервер выдал challenge вместо токенов. */
  SecondFactorRequired = 'second_factor_required',
  /** Challenge второго фактора входа неизвестен или истёк — вход начинается заново. */
  LoginChallengeExpired = 'login_challenge_expired',
  NetworkError = 'network_error',
  WalletLocked = 'wallet_locked',
  ClientWalletMismatch = 'client_wallet_mismatch',
  /** Клиентский код: high-stakes-действие (экспорт удостоверения с PII) не подтверждено. */
  ConsentRequired = 'consent_required',
}

/**
 * Ошибки SDK в формате OAuth 2.0 ({ error, error_description }): код — машинный,
 * description — человеко-читаемое сообщение для UI.
 */
export class AuthV2Error extends Error {
  readonly code: AuthV2ErrorCode
  /**
   * Машинные детали ошибки (например, challenge второго фактора у
   * `SecondFactorRequired`). В UI-тексты не попадают.
   */
  readonly details?: Record<string, unknown>

  constructor(code: AuthV2ErrorCode, description: string, details?: Record<string, unknown>) {
    super(description)
    this.name = 'AuthV2Error'
    this.code = code
    this.details = details
  }

  toJSON(): { error: AuthV2ErrorCode, error_description: string } {
    return { error: this.code, error_description: this.message }
  }
}

/** Внутренний помощник для каркаса: единообразный отказ нереализованных методов. */
export function notImplemented(method: string): never {
  throw new AuthV2Error(
    AuthV2ErrorCode.NotImplemented,
    lt('authClient.errors.notImplementedDetail', { method }),
  )
}

/**
 * Рекомендованное действие для UI при ошибке — определяет, какую кнопку/подсказку
 * показать пайщику (Story 1.11).
 */
export type AuthV2ErrorAction =
  | 'retry' // повторить ввод/вход
  | 'recover' // предложить восстановление доступа («Восстановить доступ»)
  | 'check_connection' // проверить интернет
  | 'contact_support' // обратиться в кооператив
  | 'none'

/** Описание ошибки для отображения: сообщение + действие + судьба сессии. */
export interface AuthV2ErrorView {
  /** машинный код (null — неожиданная, не-типизированная ошибка) */
  code: AuthV2ErrorCode | null
  /** человеко-читаемое сообщение для UI */
  message: string
  /** что предложить пайщику */
  action: AuthV2ErrorAction
  /**
   * Сохранять ли текущую сессию. `true` — НЕ разлогинивать (сбой временный/внешний:
   * нет связи, кооператив недоступен, кошелёк заперт) — NFR20/FR50: оффлайн не
   * выкидывает пайщика. `false` — сбой требует повторного входа.
   */
  keepSession: boolean
}

type AuthV2ErrorViewBody = Omit<AuthV2ErrorView, 'code'>

/**
 * Каталог человеко-читаемых сообщений по кодам ошибок (Story 1.11). Источник
 * UI-текстов — здесь; контроллер отдаёт только машинный `error`, клиент по нему
 * выбирает сообщение и actionable-подсказку. Тексты — по-русски, без раскрытия
 * технических деталей (например, какое именно поле логина неверно — security).
 */
export const AUTH_V2_ERROR_VIEWS: Record<AuthV2ErrorCode, AuthV2ErrorViewBody> = {
  [AuthV2ErrorCode.NotImplemented]: {
    message: lt('authClient.errors.notImplemented'),
    action: 'none',
    keepSession: true,
  },
  [AuthV2ErrorCode.InvalidCredentials]: {
    message: lt('authClient.errors.invalidCredentials'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.WeakPassword]: {
    message: lt('authClient.errors.weakPassword'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.SessionBindingReused]: {
    message: lt('authClient.errors.sessionBindingReused'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.SessionBindingExpired]: {
    message: lt('authClient.errors.sessionBindingExpired'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.TimestampTooOld]: {
    message: lt('authClient.errors.timestampTooOld'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.VaultDecryptionFailed]: {
    message: lt('authClient.errors.vaultDecryptionFailed'),
    action: 'recover',
    keepSession: false,
  },
  [AuthV2ErrorCode.CertificateExpired]: {
    message: lt('authClient.errors.certificateExpired'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.CertificateRevoked]: {
    message: lt('authClient.errors.certificateRevoked'),
    action: 'contact_support',
    keepSession: false,
  },
  [AuthV2ErrorCode.ChainVerificationFailed]: {
    message: lt('authClient.errors.chainVerificationFailed'),
    action: 'contact_support',
    keepSession: false,
  },
  [AuthV2ErrorCode.CooposDegraded]: {
    message: lt('authClient.errors.cooposDegraded'),
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.TooManyAttempts]: {
    message: lt('authClient.errors.tooManyAttempts'),
    action: 'retry',
    // временный троттлинг — не разлогиниваем пайщика, просто просим подождать.
    keepSession: true,
  },
  [AuthV2ErrorCode.TooManyRecoveryAttempts]: {
    message: lt('authClient.errors.tooManyRecoveryAttempts'),
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.InvalidTwoFactorCode]: {
    message: lt('authClient.errors.invalidTwoFactorCode'),
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.TwoFactorNotEnrolled]: {
    message: lt('authClient.errors.twoFactorNotEnrolled'),
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.InvalidRecoveryToken]: {
    message: lt('authClient.errors.invalidRecoveryToken'),
    action: 'recover',
    keepSession: false,
  },
  [AuthV2ErrorCode.RecoveryDoneLoginFailed]: {
    message: lt('authClient.errors.recoveryDoneLoginFailed'),
    // Повторять восстановление нечем: ссылка одноразовая и уже сожжена, ключ ротирован.
    // Единственная осмысленная дорога отсюда — обычный вход новым паролём, его и предлагаем.
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.InvalidOfflineCode]: {
    message: lt('authClient.errors.invalidOfflineCode'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.InsufficientVerification]: {
    message: lt('authClient.errors.insufficientVerification'),
    action: 'contact_support',
    // авторизационное ограничение по уровню доверия — сессия валидна, не разлогиниваем.
    keepSession: true,
  },
  [AuthV2ErrorCode.RotationUnavailable]: {
    message: lt('authClient.errors.rotationUnavailable'),
    action: 'retry',
    // технический код для авто-повтора без ротации; до экрана в норме не доходит.
    keepSession: true,
  },
  [AuthV2ErrorCode.SecondFactorRequired]: {
    message: lt('authClient.errors.secondFactorRequired'),
    action: 'retry',
    // не ошибка, а следующая ступень входа — сессия ещё строится.
    keepSession: true,
  },
  [AuthV2ErrorCode.LoginChallengeExpired]: {
    message: lt('authClient.errors.loginChallengeExpired'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.NetworkError]: {
    message: lt('authClient.errors.networkError'),
    action: 'check_connection',
    keepSession: true,
  },
  [AuthV2ErrorCode.WalletLocked]: {
    message: lt('authClient.errors.walletLocked'),
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.ClientWalletMismatch]: {
    message: lt('authClient.errors.clientWalletMismatch'),
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.ConsentRequired]: {
    message: lt('authClient.errors.consentRequired'),
    action: 'retry',
    keepSession: true,
  },
}

/** Безопасный фолбэк для неожиданной (не-AuthV2) ошибки — без утечки технических деталей. */
const GENERIC_ERROR_VIEW: AuthV2ErrorViewBody = {
  message: lt('authClient.errors.generic'),
  action: 'retry',
  keepSession: true,
}

/**
 * Превратить любую брошенную SDK ошибку в готовое к показу описание (Story 1.11):
 * человеко-читаемое сообщение, рекомендованное действие и флаг сохранения сессии.
 * Не-типизированные ошибки сводятся к безопасному фолбэку (не показываем `e.message`).
 */
export function describeAuthV2Error(error: unknown): AuthV2ErrorView {
  if (error instanceof AuthV2Error)
    return { code: error.code, ...AUTH_V2_ERROR_VIEWS[error.code] }
  return { code: null, ...GENERIC_ERROR_VIEW }
}
