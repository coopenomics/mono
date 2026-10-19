import { registerEnumType } from '@nestjs/graphql';

/**
 * Статусы, приходящие из провайдера (Epic 12/13). Зеркало доменных enum'ов
 * provider-backend (`SubscriptionStatus`, `BillingInvoiceStatus`) — строковые
 * значения совпадают, чтобы ответ провайдера ложился без маппинга.
 */
export enum ProviderSubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
registerEnumType(ProviderSubscriptionStatus, {
  name: 'ProviderSubscriptionStatus',
  description: 'Статус подписки у провайдера: ACTIVE | TRIAL | EXPIRED (past_due/suspended) | CANCELLED',
});

/** Статус invoice провайдера на оплату подписок. */
export enum ProviderBillingInvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
}

/** Ответ провайдера на package-invoice (докупка пакета документооборота). */
export enum ProviderPackageInvoiceStatus {
  PENDING = 'PENDING',
  BLOCKED = 'BLOCKED',
  NO_PACKAGE = 'NO_PACKAGE',
  /** Дата оплаты не наступила, бак не ниже кванта — пополнять нечего. */
  NOT_DUE = 'NOT_DUE',
}

/** Вид счёта на пополнение бака AXON: объём месяца по дате или квант сверх тарифа. */
export enum ProviderPackageInvoiceKind {
  MONTHLY = 'monthly',
  QUANT = 'quant',
}

/** Статус кооператива в цепи (registrator.coops). */
export enum CooperativeChainStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}
registerEnumType(CooperativeChainStatus, {
  name: 'CooperativeChainStatus',
  description: 'Статус кооператива в блокчейне: pending | active | blocked',
});
