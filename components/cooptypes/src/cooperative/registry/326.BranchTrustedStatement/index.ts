import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 326

/**
 * Интерфейс генерации заявления пайщика о приёме доверенным лицом
 * кооперативного участка.
 */
export interface Action extends IGenerate {
  hash: string
  braname: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  braname: string
  vars: IVars
}

export const title = 'Заявление о приёме доверенным лицом кооперативного участка'
export const description = 'Форма заявления пайщика о приёме доверенным лицом кооперативного участка'
export const context = `<style>.digital-document h1 {margin: 0px;text-align:center;}.digital-document {padding: 20px;white-space: pre-wrap;}.signature {padding-top: 30px;}</style><div class="digital-document"><h1 class="header">{% trans 'STATEMENT_TITLE' %}</h1><p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'TO_CHAIRMAN' %} «{{ braname }}» {% trans 'FROM_PARTICIPANT' %} {{ user.full_name_or_short_name }}.</p><p>{% trans 'REQUEST_TEXT', braname %}</p><div class="signature"><p>{% trans 'PARTICIPANT_LABEL' %} {{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    STATEMENT_TITLE: 'ЗАЯВЛЕНИЕ О ПРИЁМЕ ДОВЕРЕННЫМ ЛИЦОМ',
    TO_CHAIRMAN: 'Председателю кооперативного участка',
    FROM_PARTICIPANT: 'от пайщика',
    REQUEST_TEXT: 'Прошу принять меня доверенным лицом кооперативного участка «{0}». С обязанностями доверенного лица ознакомлен(а) и согласен(на), договор о полной материальной ответственности принимаю.',
    PARTICIPANT_LABEL: 'Пайщик',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
  },
  meta: {
    created_at: '20.03.2024 10:00',
  },
  user: {
    full_name_or_short_name: 'Сидоров Иван Петрович',
  },
  braname: 'РОМАШКА',
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
