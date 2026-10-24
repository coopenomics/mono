/**
 * Подписки кооператива на приложения каталога у провайдера подключения
 * (Архитектура v5 каталога, 487-34).
 *
 * Подписка на приложение — строка общего счёта кооператива у провайдера:
 * оплачивается тем же платежом, что и хостинг. Каталог хранит копию и по ней
 * выдаёт пакет. Оформляет подписку узел оператора: только у него канал к
 * провайдеру. На узле без провайдера порт отвечает `unavailable` — подписка
 * оформляется на столе подключения у оператора.
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
}

/** Предложение приложения у провайдера: цена за период оплаты. */
export interface InnerAppOffer {
  /** Пакет каталога, `@scope/name`. */
  package_id: string;
  /** Цена за период, рубли. */
  price: number;
  /** Период оплаты, дней. */
  period_days: number;
}

export type InnerAppSubscribeOutcome =
  | { status: 'subscribed'; created: boolean; subscription: InnerAppSubscription }
  | { status: 'notOffered'; error: string }
  | { status: 'unavailable' }
  | { status: 'failed'; error: string };

export interface IProviderAppsPort {
  /** Оформить подписку кооператива на пакет. Повтор возвращает действующую подписку. */
  subscribe(coopname: string, packageId: string): Promise<InnerAppSubscribeOutcome>;
  /**
   * Приложения, которые провайдер предлагает кооперативу, с ценой; `null` —
   * узел не связан с провайдером, цена известна только на столе подключения.
   */
  listOffers(coopname: string): Promise<InnerAppOffer[] | null>;
}

export const PROVIDER_APPS_PORT = Symbol.for('Innercoop.CorePort.ProviderApps');
