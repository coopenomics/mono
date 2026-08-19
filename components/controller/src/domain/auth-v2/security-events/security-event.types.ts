/**
 * Критичные события безопасности аккаунта (CoopID Story 3.11) — повод уведомить
 * пайщика, чтобы он заметил изменение, сделанное без его ведома.
 *
 * Канонический набор из AC. `PasswordChanged` / `KeyRotated` проводятся из ротации
 * ключа (Story 3.3, backlog) — объявлены здесь, но пока не триггерятся.
 */
export enum SecurityEventKind {
  TwoFactorEnabled = 'two_factor_enabled',
  TwoFactorDisabled = 'two_factor_disabled',
  RecoveryStrategyChanged = 'recovery_strategy_changed',
  PasswordChanged = 'password_changed',
  KeyRotated = 'key_rotated',
  LoginFactorsChanged = 'login_factors_changed',
}

/** Человекочитаемый заголовок события для тела уведомления. */
export const SECURITY_EVENT_TITLES: Record<SecurityEventKind, string> = {
  [SecurityEventKind.TwoFactorEnabled]: 'Подключён второй фактор (2FA)',
  [SecurityEventKind.TwoFactorDisabled]: 'Отключён второй фактор (2FA)',
  [SecurityEventKind.RecoveryStrategyChanged]: 'Изменён способ восстановления доступа',
  [SecurityEventKind.PasswordChanged]: 'Изменён пароль',
  [SecurityEventKind.KeyRotated]: 'Перевыпущен ключ доступа',
  [SecurityEventKind.LoginFactorsChanged]: 'Изменены настройки подтверждения входа',
};
