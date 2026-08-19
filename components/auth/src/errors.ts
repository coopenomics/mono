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
  InvalidOfflineCode = 'invalid_offline_code',
  InsufficientVerification = 'insufficient_verification',
  /** Ротация ключа недоступна: пайщик ещё не принят (кандидат) — регистрация не завершена. */
  RotationUnavailable = 'rotation_unavailable',
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
    message: 'Функция пока недоступна.',
    action: 'none',
    keepSession: true,
  },
  [AuthV2ErrorCode.InvalidCredentials]: {
    message: 'Неверный email или пароль.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.WeakPassword]: {
    message: 'Пароль слишком простой. Нужно минимум 8 символов, хотя бы одна цифра и один спецсимвол.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.SessionBindingReused]: {
    message: 'Сессия входа уже использована. Войдите заново.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.SessionBindingExpired]: {
    message: 'Время на подтверждение входа истекло. Войдите заново.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.TimestampTooOld]: {
    message: 'Истекло время на подтверждение входа. Повторите попытку.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.VaultDecryptionFailed]: {
    message: 'Не удалось расшифровать кошелёк. Попробуйте восстановить доступ.',
    action: 'recover',
    keepSession: false,
  },
  [AuthV2ErrorCode.CertificateExpired]: {
    message: 'Срок действия удостоверения истёк. Войдите заново, чтобы обновить его.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.CertificateRevoked]: {
    message: 'Удостоверение отозвано. Обратитесь в кооператив.',
    action: 'contact_support',
    keepSession: false,
  },
  [AuthV2ErrorCode.ChainVerificationFailed]: {
    message: 'Не удалось подтвердить подпись. Обратитесь в поддержку кооператива.',
    action: 'contact_support',
    keepSession: false,
  },
  [AuthV2ErrorCode.CooposDegraded]: {
    message: 'Кооператив временно недоступен. Повторите попытку позже.',
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.TooManyAttempts]: {
    message: 'Слишком много попыток. Подождите немного и попробуйте снова.',
    action: 'retry',
    // временный троттлинг — не разлогиниваем пайщика, просто просим подождать.
    keepSession: true,
  },
  [AuthV2ErrorCode.TooManyRecoveryAttempts]: {
    message: 'Слишком много запросов на восстановление. Подождите и попробуйте позже.',
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.InvalidTwoFactorCode]: {
    message: 'Неверный код из приложения-аутентификатора. Проверьте код и попробуйте снова.',
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.TwoFactorNotEnrolled]: {
    message: 'Второй фактор не подключён.',
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.InvalidRecoveryToken]: {
    message: 'Ссылка восстановления недействительна или истекла. Запросите восстановление заново.',
    action: 'recover',
    keepSession: false,
  },
  [AuthV2ErrorCode.InvalidOfflineCode]: {
    message: 'Код восстановления неверен или уже использован.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.InsufficientVerification]: {
    message: 'Недостаточный уровень верификации для этого действия. Обратитесь в кооператив.',
    action: 'contact_support',
    // авторизационное ограничение по уровню доверия — сессия валидна, не разлогиниваем.
    keepSession: true,
  },
  [AuthV2ErrorCode.RotationUnavailable]: {
    message: 'Смена ключа доступна после завершения регистрации.',
    action: 'retry',
    // технический код для авто-повтора без ротации; до экрана в норме не доходит.
    keepSession: true,
  },
  [AuthV2ErrorCode.NetworkError]: {
    message: 'Нет связи с кооперативом. Проверьте интернет.',
    action: 'check_connection',
    keepSession: true,
  },
  [AuthV2ErrorCode.WalletLocked]: {
    message: 'Кошелёк заблокирован. Введите пароль для доступа к ключу.',
    action: 'retry',
    keepSession: true,
  },
  [AuthV2ErrorCode.ClientWalletMismatch]: {
    message: 'Ключ в этом браузере не соответствует аккаунту. Войдите заново.',
    action: 'retry',
    keepSession: false,
  },
  [AuthV2ErrorCode.ConsentRequired]: {
    message: 'Для экспорта удостоверения нужно подтверждение.',
    action: 'retry',
    keepSession: true,
  },
}

/** Безопасный фолбэк для неожиданной (не-AuthV2) ошибки — без утечки технических деталей. */
const GENERIC_ERROR_VIEW: AuthV2ErrorViewBody = {
  message: 'Не удалось выполнить операцию. Попробуйте ещё раз.',
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
