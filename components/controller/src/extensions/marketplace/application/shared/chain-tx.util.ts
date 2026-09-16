import { BadRequestException } from '@nestjs/common';

/**
 * Извлекает tx_hash из ответа цепи (ответ wharfkit).
 *
 * wharfkit держит Antelope push_transaction response под `response`
 * (`response.processed.id` / `response.transaction_id`). Для совместимости
 * со spec-тестами поддерживаем и плоский `processed.id` / `transaction.id`.
 *
 * fail-fast: цепь приняла action, но не вернула tx_hash — audit-trail станет
 * фантомным ('unknown') без возможности cross-reference. Лучше отбить операцию
 * пайщику с просьбой о retry (`txHashMissingMessage`), чем записать «unknown».
 */
export function normalizeChainTxHash(tx: unknown, txHashMissingMessage: string): string {
  const t = tx as {
    transaction?: { id?: string };
    processed?: { id?: string };
    response?: {
      transaction_id?: string;
      processed?: { id?: string };
    };
  };
  const hash =
    t?.response?.processed?.id ??
    t?.response?.transaction_id ??
    t?.processed?.id ??
    t?.transaction?.id;
  if (!hash) {
    throw new BadRequestException(txHashMissingMessage);
  }
  return hash;
}

/**
 * Хэш и номер блока транзакции из ответа цепи. Номер блока лежит только в
 * `response.processed.block_num` (wharfkit @1.6.x); без него — 0, как и
 * раньше у снимка транзакции заказа.
 */
export function normalizeChainTx(tx: unknown, txHashMissingMessage: string): { tx_hash: string; block_num: number } {
  const tx_hash = normalizeChainTxHash(tx, txHashMissingMessage);
  const t = tx as { response?: { processed?: { block_num?: number } } };
  return { tx_hash, block_num: t?.response?.processed?.block_num ?? 0 };
}
