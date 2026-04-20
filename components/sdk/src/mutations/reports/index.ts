/** Генерация отчёта для ФНС/ФСС с сохранением истории */
export * as GenerateReport from './generateReport'

/** Обновить ручные реквизиты кооператива (ИНН/КПП/ОГРН не редактируются — живут в БД кооператива, не в блокчейне) */
export * as UpdateReportRequisites from './updateReportRequisites'
