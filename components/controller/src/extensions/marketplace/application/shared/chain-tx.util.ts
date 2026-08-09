import { BadRequestException } from '@nestjs/common';

/**
 * Извлекает tx_hash из ответа цепи (wharfkit TransactResult).
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
 * Чистит `assertion failure with message: ...` из `eosio::check` и пробрасывает
 * пайщику как BadRequest с человекочитаемым текстом (без EOSIO-обёртки).
 */
export function rethrowChainError(error: unknown): never {
  const raw: string = (error as { message?: string })?.message ?? String(error);
  const match = raw.match(/assertion failure with message: (.+?)(?:\n|$)/);
  const clean = match ? match[1].trim() : raw;
  throw new BadRequestException(clean);
}
