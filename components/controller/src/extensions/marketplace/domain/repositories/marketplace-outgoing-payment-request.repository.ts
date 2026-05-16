import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../entities/marketplace-outgoing-payment-request.entity';
import type { MarketplaceOutgoingPaymentRequestStatus } from '../entities/marketplace-outgoing-payment-request.types';

export const MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY = Symbol(
  'MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY'
);

export interface MarketplaceOutgoingPaymentRequestCreateInput {
  coopname: string;
  apl_reception_id: string;
  payee_account: string;
  related_order_ids: string[];
  amount: string;
  symbol: string;
  purpose: string;
  status: MarketplaceOutgoingPaymentRequestStatus;
}

export interface MarketplaceOutgoingPaymentRequestConfirmInput {
  confirmed_at: Date;
  payment_reference: string;
  bank_statement_ref: string | null;
  payout_tx_hash?: string | null;
  status: MarketplaceOutgoingPaymentRequestStatus;
}

export interface MarketplaceOutgoingPaymentRequestDomainRepository {
  create(
    input: MarketplaceOutgoingPaymentRequestCreateInput
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity>;

  /**
   * Story 598-17 / AR35: проставить связку с платежом в core-реестре.
   * Возвращает обновлённую сущность. Вызывается из
   * `MarketplaceAplReceptionService.createOutgoingPaymentRequest` после
   * успешного `GatewayInteractor.createSystemOutgoingPayment`.
   */
  applyCorePaymentId(
    id: string,
    core_payment_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity>;

  /**
   * Compensating rollback: удалить request, если core-вызов вернул ошибку и
   * marketplace-запись осталась без core-binding. Сохраняет инвариант
   * 1 АПП → 1 request (без core ⇔ без AR35-видимости).
   */
  deleteById(id: string): Promise<void>;

  findById(id: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  findByAplReceptionId(
    coopname: string,
    apl_reception_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null>;

  listByStatus(
    coopname: string,
    status: MarketplaceOutgoingPaymentRequestStatus | MarketplaceOutgoingPaymentRequestStatus[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  listByPayee(
    coopname: string,
    payee_account: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]>;

  confirmByCashier(
    id: string,
    patch: MarketplaceOutgoingPaymentRequestConfirmInput
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity>;

  markBlocked(
    id: string,
    reason: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity>;
}
