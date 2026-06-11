import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 327

/**
 * Интерфейс генерации договора о полной материальной ответственности доверенного
 * лица кооперативного участка. Документ подписывается двумя сторонами: заявителем
 * и председателем кооперативного участка (встречная подпись на том же документе).
 */
export interface Action extends IGenerate {
  hash: string
  braname: string
  chairman_full_name: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  braname: string
  chairman_full_name: string
  vars: IVars
}

export const title = 'Договор о полной материальной ответственности доверенного лица кооперативного участка'
export const description = 'Форма договора о полной материальной ответственности доверенного лица кооперативного участка с подписями заявителя и председателя участка'
export const context = `<style>.digital-document h1 {margin: 0px;text-align:center;}.digital-document {padding: 20px;white-space: pre-wrap;}.signature {padding-top: 30px;}.parties {display: flex; justify-content: space-between; padding-top: 40px;}</style><div class="digital-document"><h1 class="header">{% trans 'AGREEMENT_TITLE' %}</h1><p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'PREAMBLE', braname %}</p><p>{% trans 'CLAUSE_1' %}</p><p>{% trans 'CLAUSE_2' %}</p><p>{% trans 'CLAUSE_3' %}</p><div class="parties"><div><p><strong>{% trans 'TRUSTED_PARTY_LABEL' %}</strong></p><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div><div><p><strong>{% trans 'CHAIRMAN_PARTY_LABEL' %}</strong></p><p>{{ chairman_full_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div></div>`

export const translations = {
  ru: {
    AGREEMENT_TITLE: 'ДОГОВОР О ПОЛНОЙ МАТЕРИАЛЬНОЙ ОТВЕТСТВЕННОСТИ',
    PREAMBLE: 'Настоящий договор заключён между доверенным лицом и председателем кооперативного участка «{0}» в целях обеспечения сохранности имущества и средств, вверяемых доверенному лицу.',
    CLAUSE_1: '1. Доверенное лицо принимает на себя полную материальную ответственность за недостачу вверенного ему имущества и средств кооперативного участка.',
    CLAUSE_2: '2. Доверенное лицо обязуется бережно относиться к вверенному имуществу и принимать меры к предотвращению ущерба.',
    CLAUSE_3: '3. Договор вступает в силу с момента его подписания обеими сторонами и действует на весь период исполнения полномочий доверенного лица.',
    TRUSTED_PARTY_LABEL: 'Доверенное лицо',
    CHAIRMAN_PARTY_LABEL: 'Председатель кооперативного участка',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
  },
  meta: {
    created_at: '20.03.2024 12:00',
  },
  user: {
    full_name_or_short_name: 'Сидоров Иван Петрович',
  },
  braname: 'РОМАШКА',
  chairman_full_name: 'Иванов Петр Сидорович',
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
