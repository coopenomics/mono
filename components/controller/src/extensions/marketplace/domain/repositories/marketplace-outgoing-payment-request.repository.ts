import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../entities/marketplace-outgoing-payment-request.entity';
import type { MarketplaceOutgoingPaymentRequestStatus } from '../entities/marketplace-outgoing-payment-request.types';

export const MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY = Symbol(
  'MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY'
);

export interface MarketplaceOutgoingPaymentRequestCreateInput {
  coopname: string;
  order_hash: string;
  order_id: string;
  apl_reception_id: string;
  payee_account: string;
  amount: string;
  symbol: string;
  purpose: string;
  /** Маскированные реквизиты получателя на момент создания выплаты. */
  payout_destination?: string | null;
  payout_tx_hash?: string | null;
  core_payment_id?: string | null;
}

export interface MarketplaceOutgoingPaymentRequestDomainRepository {
  /**
   * Идемпотентное создание projection одного outcome'а в статусе PENDING.
   * При повторном вызове с тем же `(coopname, order_hash)` возвращает
   * существующую запись без ошибок — нужно для retry-safety listener'а
   * `action::marketplace::payout`.
   */
  createIfNotExists(
    input: MarketplaceOutgoingPaymentRequestCreateInput
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity>;

  findById(id: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  findByOrderHash(
    coopname: string,
    order_hash: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  findByAplReceptionId(
    coopname: string,
    apl_reception_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  listByPayee(
    coopname: string,
    payee_account: string,
    statuses?: MarketplaceOutgoingPaymentRequestStatus[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  /**
   * Лента выплат по всему кооперативу для совета (read:all). Опциональные
   * фильтры по поставщику-получателю и статусам. В отличие от listByPayee
   * не привязана к текущему пайщику.
   */
  listAll(
    coopname: string,
    filter?: {
      payee_account?: string;
      statuses?: MarketplaceOutgoingPaymentRequestStatus[];
    }
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  /**
   * Переход PENDING → COMPLETED. Listener `action::marketplace::payconfirm`.
   * Идемпотентен — повторный вызов не меняет уже COMPLETED-запись.
   */
  applyCompletion(
    coopname: string,
    order_hash: string,
    patch: {
      completed_at: Date;
      core_payment_id?: string | null;
      payout_tx_hash?: string | null;
    }
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  /**
   * Переход PENDING → DECLINED. Listener `action::marketplace::paydecline`.
   * Идемпотентен — повторный вызов не меняет уже DECLINED-запись.
   */
  applyDecline(
    coopname: string,
    order_hash: string,
    reason: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  /**
   * Story 598-17 / AR35: проставить связку с платежом в core-реестре
   * (записывается отдельно от createIfNotExists, если core-вызов
   * выполняется после `marketplace::payout` delta).
   */
  applyCorePaymentId(
    coopname: string,
    order_hash: string,
    core_payment_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;
}
