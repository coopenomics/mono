import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';

/**
 * Параметры перевода между кошельками одного бух.счёта (operation `o.adj.walmove`).
 */
export interface WalmoveBlockchainDomainInterface {
  coopname: string;
  /** Инициатор корректировки (для аудита; обычно совпадает с coopname). */
  initiator: string;
  /** Владелец кошельков (для аналитики; для коллективных — обычно coopname). */
  username: string;
  /** eosio::name кошелька-источника (`w.<contract>.<waltype>`). */
  fromWallet: string;
  /** eosio::name кошелька-приёмника (`w.<contract>.<waltype>`). */
  toWallet: string;
  /** Сумма с символом, например `"100.00 RUB"`. */
  quantity: string;
  /** SHA-256 хэш корректировки (генерирует backend). */
  processHash: string;
  /** Обязательное обоснование (≤ 255 символов). */
  memo: string;
}

/**
 * Порт ledger2 для записи в блокчейн (walmove — единственная корректировка
 * председателя в UI; revert вызывается только из других контрактов через
 * whitelist auth, см. revert.cpp).
 *
 * Чтение состояния (accounts/wallets/history) живёт в `Ledger2StatePort` —
 * этот порт только пишет. Подпись `coopname@active`.
 */
export interface Ledger2BlockchainPort {
  walmove(data: WalmoveBlockchainDomainInterface): Promise<TransactionResult>;
}

export const LEDGER2_BLOCKCHAIN_PORT = Symbol('LEDGER2_BLOCKCHAIN_PORT');
