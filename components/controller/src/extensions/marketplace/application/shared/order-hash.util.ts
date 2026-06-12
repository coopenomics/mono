import { createHash, randomBytes } from 'crypto';

/**
 * order_hash заказа поставщика: SHA256(coopname|orderer|offer_id|nonce).
 * Nonce — 16-байтовый random hex: уникальность на цепи (idempotency
 * контракта) + безопасный re-submit при transient сетевых ошибках.
 * Используется и сервисом создания заказа, и превью checkout'а (hash
 * рождается на этапе заявления о конвертации и идёт с ним в мете).
 */
export function computeOrderHash(coopname: string, orderer: string, offer_id: string): string {
  const nonce = randomBytes(16).toString('hex');
  return createHash('sha256').update(`${coopname}|${orderer}|${offer_id}|${nonce}`).digest('hex');
}

/** order_hash заказа из остатка кооператива (маркер `stock` в seed'е). */
export function computeStockOrderHash(coopname: string, orderer: string, offer_id: string): string {
  const nonce = randomBytes(16).toString('hex');
  return createHash('sha256')
    .update(`${coopname}|${orderer}|stock|${offer_id}|${nonce}`)
    .digest('hex');
}
