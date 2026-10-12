/**
 * Номер транзакции цепи из ответа на отправку. Им помечается задача доступа:
 * служба и слушатель цепи ставят одну и ту же задачу, и защита от повтора
 * срабатывает только при одном ключе. Узел отдаёт номер в `response` либо в
 * `resolved`, слушатель цепи получает его в другом регистре — поэтому номер
 * приводится к нижнему.
 */
export function trxIdOf(result: unknown): string | null {
  const r = result as { transaction_id?: string; response?: { transaction_id?: string }; resolved?: { transaction?: { id?: unknown } } } | null | undefined;
  const id = r?.response?.transaction_id ?? r?.resolved?.transaction?.id ?? r?.transaction_id;
  return id ? String(id).toLowerCase() : null;
}

/** Ключ задачи доступа по номеру транзакции из действия цепи — в том же виде, что у службы. */
export const chainTrigger = (transactionId: string): string => String(transactionId).toLowerCase();
