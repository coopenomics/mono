/**
 * Подписки кооператива на приложения каталога у провайдера подключения
 * (Архитектура v5 каталога, 487-34).
 *
 * Подписка на приложение — строка общего счёта кооператива у провайдера:
 * оплачивается тем же платежом, что и хостинг. Каталог хранит копию и по ней
 * выдаёт пакет. Оформляет подписку узел кооператива сам (26.10.2026): у него
 * есть канал к провайдеру (`PROVIDER_BASE_URL`), а оператор только показывает
 * состояние. На узле без канала порт отвечает `unavailable`.
 *
 * Тот же порт отдаёт узлу его подписки у провайдера целиком (хостинг,
 * документооборот, приложения) и сводку счёта — только для чтения: пополнение
 * кошелька и смена тарифа остаются на столе пайщика у оператора.
 */

/** Статус подписки у провайдера. */
export enum InnerAppSubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface InnerAppSubscription {
  /** Пакет каталога, `@scope/name`. */
  package_id: string;
  /** Статус подписки у провайдера. */
  status: InnerAppSubscriptionStatus;
  /** Цена за период, рубли. */
  amount_per_period: number;
  /** Начало подписки, ISO 8601. */
  started_at: string;
  /** Оплачено по, ISO 8601. */
  expires_at: string;
  /** Идёт пробный срок: до `trial_ends_at` оплата не списывается. */
  is_trial?: boolean;
  /** Конец пробного срока, ISO 8601; null — подписка платная. */
  trial_ends_at?: string | null;
  /** Ближайшее списание с кошелька членских взносов, ISO 8601. */
  next_payment_due?: string | null;
}

export interface InnerAppOffer {
  /** Пакет каталога, `@scope/name`. */
  package_id: string;
  /** Цена за период, рубли. */
  price: number;
  /** Период оплаты, дней. */
  period_days: number;
  /** Пробный срок из публикации пакета, дней; 0 — оплата с первого дня. */
  trial_days: number;
}

export type InnerAppSubscribeOutcome =
  | { status: 'subscribed'; created: boolean; subscription: InnerAppSubscription }
  | { status: 'notOffered'; error: string }
  | { status: 'unavailable' }
  | { status: 'failed'; error: string };

export type InnerAppCancelOutcome =
  | { status: 'cancelled'; subscription: InnerAppSubscription }
  | { status: 'notSubscribed' }
  | { status: 'unavailable' }
  | { status: 'failed'; error: string };

/** Любая подписка кооператива у провайдера: хостинг, документооборот, приложение. */
export interface InnerProviderSubscription {
  id: number;
  /** Название услуги у провайдера. */
  name: string;
  /** Код типа: `hosting`, `docflow`, `catalog:@scope/name`. */
  code: string | null;
  /** `time` — повременная, `package` — пакетная (объём ресурса). */
  kind: string | null;
  /** Пакет каталога, если подписка на приложение. */
  package_id: string | null;
  status: InnerAppSubscriptionStatus;
  is_trial: boolean;
  /** Цена за период, рубли. */
  price: number;
  period_days: number;
  started_at: string;
  expires_at: string;
  next_payment_due: string | null;
}

/** Сводка счёта кооператива у провайдера: что и когда спишется. */
export interface InnerBillingSummary {
  /** Сумма к списанию за период, рубли. */
  total_amount: number;
  currency: string;
  /** Ближайшая дата списания, ISO 8601. */
  next_payment_due: string | null;
  items: Array<{
    subscription_id: number;
    name: string;
    status: InnerAppSubscriptionStatus;
    amount: number;
    /** Срок оплаты позиции наступил. */
    is_due: boolean;
  }>;
}

export interface IProviderAppsPort {
  /** Оформить подписку кооператива на пакет. Повтор возвращает действующую подписку. */
  subscribe(coopname: string, packageId: string): Promise<InnerAppSubscribeOutcome>;
  /** Отменить подписку кооператива на пакет. */
  cancel(coopname: string, packageId: string): Promise<InnerAppCancelOutcome>;
  /**
   * Приложения, которые провайдер предлагает кооперативу, с ценой и пробным
   * сроком; `null` — узел не связан с провайдером.
   */
  listOffers(coopname: string): Promise<InnerAppOffer[] | null>;
  /** Подписки кооператива на приложения; `null` — узел не связан с провайдером. */
  listAppSubscriptions(coopname: string): Promise<InnerAppSubscription[] | null>;
  /** Все подписки кооператива у провайдера; `null` — узел не связан с провайдером. */
  listSubscriptions(coopname: string): Promise<InnerProviderSubscription[] | null>;
  /** Сводка счёта кооператива; `null` — узел не связан с провайдером. */
  billingSummary(coopname: string): Promise<InnerBillingSummary | null>;
}

export const PROVIDER_APPS_PORT = Symbol.for('Innercoop.CorePort.ProviderApps');
