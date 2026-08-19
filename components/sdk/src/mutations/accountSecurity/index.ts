/** Подтвердить подключение второго фактора первым кодом */
export * as ActivateTwoFactor from './activateTwoFactor'

/** Отключить второй фактор */
export * as DisableTwoFactor from './disableTwoFactor'

/** Начать подключение второго фактора */
export * as EnrollTwoFactor from './enrollTwoFactor'

/** Сигнал «Это не я»: немедленно завершить все сессии пайщика */
export * as ReportNotMe from './reportNotMe'

/** Завершить все сессии пайщика */
export * as RevokeAllSessions from './revokeAllSessions'

/** Завершить конкретную сессию пайщика */
export * as RevokeSession from './revokeSession'

/** Изменить настройки подтверждения входа (2FA) */
export * as SetLoginFactors from './setLoginFactors'

/** Сменить стратегию восстановления */
export * as SetRecoveryStrategy from './setRecoveryStrategy'
