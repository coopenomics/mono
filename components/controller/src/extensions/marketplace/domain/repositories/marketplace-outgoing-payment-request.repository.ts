import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../entities/marketplace-outgoing-payment-request.entity';
import type {
  MarketplaceOutgoingPaymentLine,
  MarketplaceOutgoingPaymentRequestStatus,
} from '../entities/marketplace-outgoing-payment-request.types';

export const MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY = Symbol(
  'MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY'
);

/** Новый пакет выплаты: заводит обход выплат до включения заказов в цепи. */
export interface MarketplaceOutgoingPaymentRequestCreateInput {
  coopname: string;
  payment_hash: string;
  lines: MarketplaceOutgoingPaymentLine[];
  payee_account: string;
  symbol: string;
  purpose: string;
  /** Маскированные реквизиты получателя на момент создания пакета. */
  payout_destination?: string | null;
}

/** Состояние пакета из дельты таблицы `payouts`: сумму и удержание считает контракт. */
export interface MarketplaceOutgoingPaymentChainState {
  amount: string;
  withheld_amount: string;
  status: MarketplaceOutgoingPaymentRequestStatus;
}

export interface MarketplaceOutgoingPaymentRequestDomainRepository {
  /** Новый пакет в состоянии OPEN, сумма 0 до дельты цепи. */
  create(input: MarketplaceOutgoingPaymentRequestCreateInput): Promise<MarketplaceOutgoingPaymentRequestDomainEntity>;

  findById(id: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  findByPaymentHash(
    coopname: string,
    payment_hash: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  listByPayee(
    coopname: string,
    payee_account: string,
    statuses?: MarketplaceOutgoingPaymentRequestStatus[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  /**
   * Лента выплат по всему кооперативу для совета (read:all). Опциональные
   * фильтры по поставщику-получателю и статусам.
   */
  listAll(
    coopname: string,
    filter?: {
      payee_account?: string;
      statuses?: MarketplaceOutgoingPaymentRequestStatus[];
    }
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  /** Заказы пакета после включения в цепи: остаются те, что вошли в пакет. */
  applyLines(
    coopname: string,
    payment_hash: string,
    lines: MarketplaceOutgoingPaymentLine[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  /**
   * Сумма, удержание и состояние из дельты `payouts`. Состояние вперёд не
   * откатывается: COMPLETED и DECLINED — конечные.
   */
  applyChainState(
    coopname: string,
    payment_hash: string,
    state: MarketplaceOutgoingPaymentChainState
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  /** Переход → COMPLETED по подтверждению кассира. Идемпотентен. */
  applyCompletion(
    coopname: string,
    payment_hash: string,
    patch: { completed_at: Date; payout_tx_hash?: string | null }
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  /** Переход → DECLINED по отказу кассира. Идемпотентен. */
  applyDecline(
    coopname: string,
    payment_hash: string,
    reason: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  /** Платёж пакета в реестре кассира. */
  applyCorePaymentId(
    coopname: string,
    payment_hash: string,
    core_payment_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  /** Пакеты, у которых не все заказы закрыты: их довозит обход выплат. */
  listUnsettled(coopname: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  /** Все заказы пакета закрыты: обходу пакет больше не нужен. Идемпотентно. */
  markSettled(coopname: string, payment_hash: string, at: Date): Promise<void>;

  /** Пакет без заказов (долг покрыл всю стоимость) — записи не остаётся. */
  deleteByPaymentHash(coopname: string, payment_hash: string): Promise<void>;
}
