import * as Permissions from '../../../common/permissions'
import * as ContractNames from '../../../common/names'
import type * as Draft from '../../../interfaces/draft'

export const authorizations = [{ permissions: [Permissions.active], actor: ContractNames._system }] as const

/**
 * Имя действия
 */
export const actionName = 'upversion'

/**
 * @interface
 * Увеличивает версию шаблона на единицу. Рост версии — сигнал пайщикам
 * переподписать документ (см. виджет требований подписи на рабочем столе),
 * поэтому вызывается только при содержательном изменении документа.
 */
export type IUpVersion = Draft.IUpversion
