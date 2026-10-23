import * as Actors from '../../../common/actors'
import type * as Draft from '../../../interfaces/draft'

/**
 * Имя таблицы
 */
export const tableName = 'approvals'

/**
 * Таблица хранится в области памяти кооператива.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Утверждённая советом кооператива редакция шаблона документа: номер редакции,
 * номер и дата решения совета, хэш утверждённого текста. Ключ — `registry_id`
 * шаблона. Текст шаблона по кооперативам не дублируется и остаётся в
 * глобальной таблице `drafts`.
 */
export type IApproval = Draft.IDraftapproval
