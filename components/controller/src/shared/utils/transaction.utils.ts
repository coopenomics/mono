/**
 * Утилиты для работы с результатом on-chain транзакции, который возвращают
 * blockchain-порты (`BillingBlockchainPort`, `Ledger2BlockchainPort` и т.п.).
 * Форма ответа Wharfkit/Antelope разная: иногда `{ transaction_id }` прямо
 * в корне, иногда `{ response: { transaction_id } }`. Выносим разбор в одно
 * место, чтобы сервисы не дублировали.
 */
export class TransactionUtils {
  /**
   * Извлекает on-chain `transaction_id` из произвольного объекта-результата
   * подписи/отправки. Возвращает пустую строку, если поле не найдено.
   */
  static extractTransactionId(result: unknown): string {
    if (result && typeof result === 'object' && 'transaction_id' in result) {
      const tx = (result as { transaction_id?: unknown }).transaction_id;
      if (typeof tx === 'string') return tx;
    }
    if (result && typeof result === 'object' && 'response' in result) {
      const resp = (result as { response?: { transaction_id?: unknown } }).response;
      if (resp && typeof resp.transaction_id === 'string') return resp.transaction_id;
    }
    return '';
  }
}
