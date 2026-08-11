/**
 * Форма ответа, из которой берётся номер блока. Описана здесь, а не взята из
 * SDK цепи: утилиту зовут и с результатом `IChainPort`, у которого типа SDK
 * нет, — а нужно от него ровно одно поле.
 */
export interface TransactResultWithResponse {
  response?: { processed?: { block_num?: unknown }; [key: string]: any } | null;
  [key: string]: any;
}

/**
 * Номер блока, в котором транзакция была применена.
 *
 * WHY: `transactResult.transaction` — это подписанная транзакция, и её `ref_block_num` относится
 * к TaPoS: младшие 16 бит номера блока, на который транзакция ссылается для защиты от повторов.
 * Это не блок применения и даже не полный номер блока — значение всегда лежит в диапазоне
 * 0..65535 (в проде наблюдалось 60852 вместо 128 641 857). Записанный в БД как `block_num`, он
 * ломает версионирование и откат по форку: `deleteByBlockNumGreaterThan` такие строки не заденет.
 *
 * Реальный блок приходит в ответе API после broadcast — `response.processed.block_num`.
 * Если транзакция не броадкастилась (или узел не вернул `processed`), отдаём 0: по канону
 * сущность с нулевым `block_num` считается не привязанной к синхронизации и не откатывается
 * форком, что честнее правдоподобного, но неверного номера.
 */
export function getAppliedBlockNum(transactResult?: TransactResultWithResponse | null): number {
  const processed = (transactResult?.response as { processed?: { block_num?: unknown } } | undefined)?.processed;
  const blockNum = Number(processed?.block_num);

  return Number.isFinite(blockNum) && blockNum > 0 ? blockNum : 0;
}
