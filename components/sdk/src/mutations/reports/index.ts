/** Сгенерировать XML отчёта из edits-состояния формы (результат редактора) */
export * as GenerateReportFromEdits from './generateReportFromEdits'

/** Обновить ручные реквизиты кооператива (ИНН/КПП/ОГРН не редактируются — живут в БД кооператива, не в блокчейне) */
export * as UpdateReportRequisites from './updateReportRequisites'

/** Сохранить/обновить черновик формы отчёта (upsert по owner+type+year+period) */
export * as SaveReportDraft from './saveReportDraft'

/** Удалить черновик отчёта по id (только владелец) */
export * as DeleteReportDraft from './deleteReportDraft'

/** Поставить/снять отметку на ячейку календаря (NOT_REQUIRED — «не надо сдавать»; null — снять) */
export * as MarkReportPeriod from './markReportPeriod'
