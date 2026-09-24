import { t } from '~/i18n';
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
  [SecurityEventKind.TwoFactorEnabled]: t('authV2.securityEvent.type.twoFaEnabled'),
  [SecurityEventKind.TwoFactorDisabled]: t('authV2.securityEvent.type.twoFaDisabled'),
  [SecurityEventKind.RecoveryStrategyChanged]: t('authV2.securityEvent.type.recoveryMethodChanged'),
  [SecurityEventKind.PasswordChanged]: t('authV2.securityEvent.type.passwordChanged'),
  [SecurityEventKind.KeyRotated]: t('authV2.securityEvent.type.accessKeyReissued'),
  [SecurityEventKind.LoginFactorsChanged]: t('authV2.securityEvent.type.loginConfirmationSettingsChanged'),
};
