/**
 * Состояние отчёта по строке-авансу под отчёт — зеркалится в платёж выдачи
 * аванса (`payment.blockchain_data.report_state`), чтобы реестр платежей
 * показывал статус отчёта рядом со статусом платежа без чтения цепи.
 *
 * Не путать со статусом ПЛАТЕЖА (`PaymentStatusEnum`, движение денег) и статусом
 * ПОЗИЦИИ в контракте (`ItemStatus`). Это отдельная UI-ось «надо ли пайщику
 * отчитаться»:
 *  - AWAITING — аванс выдан, отчёт ещё не подан (дефолт; отдельно не пишется);
 *  - SETTLEMENT_PENDING — отчёт подан с недо-/перерасходом, заведена платёжка
 *    расчёта разницы, ждём её подтверждения кассой;
 *  - CLOSED — отчёт принят on-chain (reportexp);
 *  - NOT_REQUIRED — отчёт пайщика не требуется (прямая оплата организации).
 *
 * Значения дублируются строковыми константами на фронте
 * (`desktop/src/shared/lib/expenses`) — поле живёт в JSON-скаляре blockchain_data,
 * а не в типизированной GraphQL-схеме.
 */
export enum ExpenseReportState {
  NOT_REQUIRED = 'NOT_REQUIRED',
  AWAITING = 'AWAITING',
  SETTLEMENT_PENDING = 'SETTLEMENT_PENDING',
  CLOSED = 'CLOSED',
}
