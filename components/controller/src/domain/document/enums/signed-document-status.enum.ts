/**
 * Статус подписанного документа в реестре подписанных документов (Postgres-проекция).
 *
 * Жизненный цикл документа фиксируется блокчейн-событиями контракта soviet:
 * - newsubmitted → Submitted
 * - newresolved  → Resolved
 * - newdeclined  → Declined
 *
 * Resolved — основной статус (на нём построено отображение реестра).
 * Submitted — отправлен/подписан, но ещё не утверждён (сценарий доп. утверждения;
 * сейчас фактически не используется — кандидат на вырезание, см. задачу C28-21).
 * Declined — отклонён/аннулирован.
 */
export enum SignedDocumentStatus {
  Submitted = 'submitted',
  Resolved = 'resolved',
  Declined = 'declined',
}
