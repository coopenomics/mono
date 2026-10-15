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

/** Удержанный налог: сколько должны бюджету и что уже отправлено кассиру */
export * as GetWithheldTaxState from './getWithheldTaxState'

/** История перечислений удержанного налога — от новых к старым */
export * as GetWithheldTaxPayments from './getWithheldTaxPayments'

/** Счета плана счетов с остатками — реестр стола бухгалтера */
export * as ReportsLedgerAccounts from './reportsLedgerAccounts'

/** Кошельки кооператива с остатками — реестр стола бухгалтера */
export * as ReportsLedgerWallets from './reportsLedgerWallets'

/** Реестр операций стола бухгалтера */
export * as ReportsLedgerHistory from './reportsLedgerHistory'

/** Реестр проводок стола бухгалтера */
export * as ReportsLedgerPostings from './reportsLedgerPostings'

/** Процесс целиком — реестр стола бухгалтера */
export * as ReportsProcess from './reportsProcess'

/** Реестр процессов стола бухгалтера */
export * as ReportsProcesses from './reportsProcesses'

/** Принятые пайщики с именами — для реестров стола бухгалтера */
export * as ReportsParticipants from './reportsParticipants'

/** Кошельки пайщиков по программам — реестр кошельков стола бухгалтера */
export * as ReportsParticipantWallets from './reportsParticipantWallets'

/** Имена и вид субъектов операций — для реестров стола бухгалтера */
export * as ReportsSubjects from './reportsSubjects'
