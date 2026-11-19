/**
 * Операция, которую открывает правая панель: номер операции учёта (apply),
 * её процесс и код. Реестр проводок и счетов знает номер операции проводки
 * (parentApplyGlobalSequence), реестр операций и процессов — саму операцию.
 */
export interface OperationRef {
  globalSequence: string
  processHash?: string | null
  operationCode?: string | null
  memo?: string | null
  /** Сумма операции, актив «2348.3900 RUB». */
  quantity?: string | null
  /** Когда операция прошла; дата из ответа сервера (скаляр DateTime) либо объект даты. */
  createdAt?: unknown
  /** Имя действия корректировки (walmove, revert) — у них кода операции нет. */
  action?: string | null
}
