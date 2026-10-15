// Таблицы контракта edubridge (E3, «Образовательный мост»).

/**
 * Активные подписки на курсы — анкеры процесса p.edu.access.
 */
export * as EduSubs from './edusubs'

/**
 * Учёт средств курса: собрано, резерв выплат преподавателям, выплачено.
 */
export * as EduCourses from './educourses'

/**
 * Заявления о взносе РИД в ожидании решения совета — анкеры процесса p.edu.rid.
 */
export * as EduRids from './edurids'

/**
 * Договоры УХД преподавателей — анкеры процесса p.edu.teach.
 */
export * as EduContracts from './educontracts'

/**
 * Условия курса, по которым контракт считает суммы.
 */
export * as EduTerms from './eduterms'

/**
 * Допуски преподавателей к курсам и их ставки.
 */
export * as EduAssigns from './eduassigns'

/**
 * Занятия, по которым идёт расчёт с участниками.
 */
export * as EduLessons from './edulessons'
