/**
 * Пользовательская отметка на ячейке календаря отчётности.
 *
 * - NOT_REQUIRED — «не надо сдавать» (для этого кооператива/периода
 *   отчёт не требуется). Ячейка серая с ⊘.
 * - SUBMITTED_EXTERNALLY — сдали вне платформы (в бумаге / через
 *   стороннюю систему типа Контур.Экстерн / СБИС). Реального XML
 *   в нашем архиве нет, но ячейка должна быть зелёной.
 *
 * Приоритет в календаре: SUBMITTED (архив) > SUBMITTED_EXTERNALLY (отметка)
 * > DRAFT > NOT_REQUIRED > OVERDUE > EMPTY. SUBMITTED_EXTERNALLY сильнее
 * draft/overdue, но слабее реальной сдачи — если пользователь всё-таки
 * сгенерировал XML через платформу, реальный архив переопределяет отметку.
 */
export enum ReportSubmissionMark {
  NOT_REQUIRED = 'not_required',
  SUBMITTED_EXTERNALLY = 'submitted_externally',
}
