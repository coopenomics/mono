/** Список доступных типов отчётов MVP c мета по последней генерации и готовности реквизитов */
export * as GetAvailableReports from './getAvailableReports'

/** Получить сгенерированный отчёт по UUID (полный XML) */
export * as GetReport from './getReport'

/** История сгенерированных отчётов (постраничная, без XML) */
export * as GetReportHistory from './getReportHistory'

/** Объединённый вид реквизитов кооператива (ончейн + ручные) с источником каждого поля */
export * as GetReportRequisites from './getReportRequisites'

/** Проверить готовность реквизитов для генерации конкретной формы */
export * as CheckReportReadiness from './checkReportReadiness'

/** Построить предзаполненные edits для формы с наложением dirty-полей черновика */
export * as BuildInitialReportEdits from './buildInitialReportEdits'

/** Получить черновик формы отчёта по типу+году+периоду (null если не существует) */
export * as GetReportDraft from './getReportDraft'

/** Список черновиков форм отчётов текущего пользователя */
export * as ListReportDrafts from './listReportDrafts'

/** Валидировать edits-состояние формы — возвращает FieldError[] с JSONPath */
export * as ValidateReportEdits from './validateReportEdits'

/** Календарь отчётности — матрица форм × периодов со статусами */
export * as GetReportCalendar from './getReportCalendar'
