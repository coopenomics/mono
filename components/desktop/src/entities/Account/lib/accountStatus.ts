import { Zeus } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import type { IAccount } from '../types';
import { t } from 'src/shared/i18n';

export interface AccountStatusBadge {
  label: string;
  variant: BaseBadgeVariant;
}

/**
 * Человекочитаемый статус пайщика для реестра. Сводит два источника:
 *  - participant_account — членство в блокчейне (accepted | blocked);
 *  - provider_account.status — регистрационная воронка MONO (Zeus.UserStatus).
 *
 * Отказ совета после оплаты определяем по registration_payment: аккаунт уже
 * зарегистрирован в блокчейне (Registered), но заведён возврат вступительного
 * взноса. Без этого признака он неотличим от «ожидает решения совета» — оба в
 * статусе Registered. Поле registration_payment в списке реестра отдаётся только
 * после enrich в account.interactor.getAccounts.
 */
export function getAccountStatusBadge(account: IAccount): AccountStatusBadge {
  // 1. Уже принят в кооператив — запись пайщика есть в блокчейне.
  const participant = account.participant_account;
  if (participant) {
    if (participant.status === 'blocked') {
      return { label: t('account.accountStatus.blocked'), variant: 'neg' };
    }
    return { label: t('account.accountStatus.active'), variant: 'pos' };
  }

  // 1b. Вышел из кооператива: запись пайщика удалена (delpartcpnt), а аккаунт в
  //     registrator переведён в blocked (finalize_member_exit). participant_account
  //     уже нет — ловим терминал по user_account.status, иначе воронка ниже
  //     показала бы «Активный пайщик» (provider-статус остаётся Active).
  if (String(account.user_account?.status) === 'blocked') {
    return { label: t('account.accountStatus.exited'), variant: 'neutral' };
  }

  const status = account.provider_account?.status;

  // 2. Отклонён советом после оплаты: PROCESSING — возврат ещё идёт, REFUNDED —
  //    завершён; для реестра оба = «Отклонён советом».
  const payment = account.registration_payment?.status;
  if (
    status === Zeus.UserStatus.Registered &&
    (payment === Zeus.PaymentStatus.REFUNDED || payment === Zeus.PaymentStatus.PROCESSING)
  ) {
    return { label: t('account.accountStatus.rejectedByBoard'), variant: 'neg' };
  }

  // 3. Регистрационная воронка MONO.
  switch (status) {
    case Zeus.UserStatus.Created:
      return { label: t('account.accountStatus.draft'), variant: 'neutral' };
    case Zeus.UserStatus.Joined:
      return { label: t('account.accountStatus.applied'), variant: 'info' };
    case Zeus.UserStatus.Payed:
      return { label: t('account.accountStatus.paid'), variant: 'info' };
    case Zeus.UserStatus.Registered:
      return { label: t('account.accountStatus.pendingBoard'), variant: 'warn' };
    case Zeus.UserStatus.Active:
      return { label: t('account.accountStatus.active'), variant: 'pos' };
    case Zeus.UserStatus.Failed:
      return { label: t('account.accountStatus.registrationFailed'), variant: 'neg' };
    case Zeus.UserStatus.Refunded:
      return { label: t('account.accountStatus.refunded'), variant: 'neutral' };
    case Zeus.UserStatus.Blocked:
      return { label: t('account.accountStatus.blocked'), variant: 'neg' };
    default:
      return { label: t('account.accountStatus.unknown'), variant: 'neutral' };
  }
}
