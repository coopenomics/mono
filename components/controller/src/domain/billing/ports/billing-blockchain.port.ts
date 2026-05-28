import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';
import type { Cooperative } from 'cooptypes';

/**
 * Параметры конвертации паевого взноса пайщика в членский на биллинг-кошелёк
 * (`w.wal.bill`) — действие `billing::convert` (operation `o.bil.fund`).
 * Несёт подписанное пайщиком заявление (`document`).
 */
export interface BillingConvertBlockchainDomainInterface {
  coopname: string;
  /** Пайщик-владелец биллинг-кошелька. */
  username: string;
  /** Сумма с символом, например `"1500.0000 RUB"`. */
  quantity: string;
  /**
   * Детерминированный process-якорь действия `billing::convert`. Используется и как
   * `process_hash` в ledger2::apply, и как `package_hash` в `Soviet::make_complete_document`.
   * Уникальность гарантирует идемпотентность и связность шагов процесса.
   */
  convertHash: string;
  /** Подписанное пайщиком заявление (document2). */
  document: Cooperative.Document.IChainDocument2;
}

/**
 * Параметры списания стоимости подписок с биллинг-кошелька пайщика в
 * инфраструктурный кошелёк кооператива — действие `billing::pay`
 * (operation `o.bil.pay`). Идемпотентно по `paymentHash`.
 */
export interface BillingPayBlockchainDomainInterface {
  coopname: string;
  username: string;
  /** Сумма с символом, например `"1500.0000 RUB"`. */
  quantity: string;
  /** Детерминированный идентификатор платежа (из provider getBillingSummary). */
  paymentHash: string;
  memo: string;
}

/**
 * Порт billing для записи в блокчейн. Подпись `coopname@active` (WIF из vault);
 * согласие пайщика для convert несёт `document`.
 */
export interface BillingBlockchainPort {
  convert(data: BillingConvertBlockchainDomainInterface): Promise<TransactionResult>;
  pay(data: BillingPayBlockchainDomainInterface): Promise<TransactionResult>;
}

export const BILLING_BLOCKCHAIN_PORT = Symbol('BILLING_BLOCKCHAIN_PORT');
