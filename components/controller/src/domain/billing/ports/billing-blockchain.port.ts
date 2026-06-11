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
 * Параметры докупки пакета документооборота — действие `billing::converttoaxn`
 * (operation `o.bil.axn`): BURN членского с `w.wal.bill[username]` в леджере
 * оператора + инъекция AXON на счёт кооператива-пайщика (10₽ = 1 AXON).
 * Подписывает оператор платформы (`_provider`); идемпотентно по `paymentHash`
 * (журнал PG хаба).
 */
export interface BillingConvertToAxnBlockchainDomainInterface {
  /** Кооператив-пайщик: владелец L3-разреза биллинг-кошелька и получатель AXON. */
  username: string;
  /** Сумма членского взноса с символом, например `"1500.0000 RUB"`. */
  quantity: string;
  /** Детерминированный идентификатор докупки (из provider package-invoice). */
  paymentHash: string;
}

/**
 * Порт billing для записи в блокчейн. `convert` подписывает кооператив
 * (`coopname@active`, согласие пайщика несёт `document`); `pay` и
 * `convertToAxn` — оператор платформы (`_provider`).
 */
export interface BillingBlockchainPort {
  convert(data: BillingConvertBlockchainDomainInterface): Promise<TransactionResult>;
  pay(data: BillingPayBlockchainDomainInterface): Promise<TransactionResult>;
  convertToAxn(data: BillingConvertToAxnBlockchainDomainInterface): Promise<TransactionResult>;
  /** Ликвидный AXON-баланс аккаунта (для мониторинга исчерпания пакета). */
  getAxonBalance(username: string): Promise<number>;
}

export const BILLING_BLOCKCHAIN_PORT = Symbol('BILLING_BLOCKCHAIN_PORT');
