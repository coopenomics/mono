import * as Permissions from '../../../common/permissions'
import * as Actors from '../../../common/actors'
import type * as Draft from '../../../interfaces/draft'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'approve'

/**
 * @interface
 * Утверждение редакции шаблона документа советом кооператива.
 *
 * Фиксирует в области кооператива, что его совет решением `decision_id`
 * принял редакцию `version` шаблона `registry_id`. Редакция обязана совпадать
 * с текущей редакцией шаблона в сети. С этого момента генератор документов и
 * контракты подписи предъявляют пайщикам кооператива именно эту редакцию;
 * пока утверждения нет, действует текущая редакция сети.
 */
export type IApprove = Draft.IApprove
