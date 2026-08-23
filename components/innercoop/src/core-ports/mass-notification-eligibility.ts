import { MonoAccountStatus, type IMonoAccount } from './mono-account.contract';

/**
 * Обеим проверкам нужна только учётная запись у провайдера. Параметр сужен до
 * неё, чтобы функции годились и для `AccountDomainEntity` ядра, и для
 * `InnerAccount` из контракта порта — обе формы её содержат.
 */
type AccountWithProvider = { provider_account: IMonoAccount | null };

/**
 * Кого включать в массовые уведомления «для пайщиков» (собрания, календарь и т.д.).
 * Исключаем незавершённую регистрацию и проблемные статусы.
 */
export function isEligibleForParticipantMassNotification(account: AccountWithProvider): boolean {
  const p = account.provider_account;
  if (!p) {
    return false;
  }
  if (!p.is_registered || !p.has_account) {
    return false;
  }

  const status = p.status;
  if (
    status === MonoAccountStatus.Failed ||
    status === MonoAccountStatus.Refunded ||
    status === MonoAccountStatus.Blocked
  ) {
    return false;
  }

  return (
    status === MonoAccountStatus.Active || status === MonoAccountStatus.Registered
  );
}

/**
 * Календарь / не-проектные комнаты: только активный пайщик (не только статус registered в Mono).
 */
export function isEligibleForActiveCoopCalendarBroadcast(account: AccountWithProvider): boolean {
  const p = account.provider_account;
  if (!p) {
    return false;
  }
  if (!p.is_registered || !p.has_account) {
    return false;
  }

  const status = p.status;
  if (
    status === MonoAccountStatus.Failed ||
    status === MonoAccountStatus.Refunded ||
    status === MonoAccountStatus.Blocked
  ) {
    return false;
  }

  return status === MonoAccountStatus.Active;
}
