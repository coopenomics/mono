import { MonoAccountStatus, type IMonoAccount } from './mono-account.contract';

/**
 * Обеим проверкам нужна только учётная запись у провайдера. Параметр сужен до
 * неё, чтобы функции годились и для `AccountDomainEntity` ядра, и для
 * `InnerAccount` из контракта порта — обе формы её содержат.
 */
type AccountWithProvider = { provider_account: IMonoAccount | null };

/**
 * Кого включать в массовые уведомления «для пайщиков» (собрания, календарь и т.д.).
 *
 * Пайщик — тот, кто завершил вступление и принят кооперативом: статус `active`.
 * Остальные статусы адресатами массовых рассылок не являются — `created`/`joined`/
 * `payed`/`registered` ещё в процессе вступления (аккаунт может быть уже создан, но
 * решения о приёме нет), `failed`/`refunding`/`refunded`/`blocked` вышли из него или
 * исключены.
 *
 * `has_account` здесь не проверяется намеренно: этот флаг говорит лишь о том, что при
 * регистрации завели аккаунт в блокчейне, и у ранних пайщиков он остался `false` при
 * живом аккаунте — по нему из рассылок о собраниях молча выпадали действующие пайщики,
 * включая членов совета (инцидент 2026-08-27). Право быть уведомлённым даёт членство,
 * а `status` его и выражает.
 */
export function isEligibleForParticipantMassNotification(account: AccountWithProvider): boolean {
  const p = account.provider_account;
  if (!p) {
    return false;
  }
  if (!p.is_registered) {
    return false;
  }

  return p.status === MonoAccountStatus.Active;
}
