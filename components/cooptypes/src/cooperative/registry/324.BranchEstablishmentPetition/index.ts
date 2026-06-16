import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 324

/**
 * Интерфейс генерации заявления председателя собрания в совет об учреждении
 * кооперативного участка. К заявлению прилагаются протокол собрания и бюллетени.
 */
export interface Action extends IGenerate {
  hash: string
  branch_name: string
  address: string
  // username избранного председателя участка; ФИО резолвит фабрика через getUser,
  // в meta (→ on-chain) уходит только username
  chairman: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  branch_name: string
  address: string
  chairman_full_name: string
  vars: IVars
}

export const title = 'Заявление председателя собрания в совет об учреждении кооперативного участка'
export const description = 'Форма заявления председателя собрания пайщиков в совет кооператива об учреждении кооперативного участка'
export const context = `<style>.digital-document h1 {margin: 0px;text-align:center;}.digital-document {padding: 20px;white-space: pre-wrap;}table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;}th {background-color: #f4f4f4;width: 30% !important;}.signature {padding-top: 30px;}</style><div class="digital-document"><h1 class="header">{% trans 'PETITION_TITLE' %}</h1><p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'TO_COUNCIL' %} {{vars.full_abbr_genitive}} «{{vars.name}}» {% trans 'FROM_CHAIRMAN' %} {{ user.full_name_or_short_name }}.</p><p>{% trans 'PETITION_TEXT' %}:</p><table><tbody><tr><th>{% trans 'BRANCH_NAME_LABEL' %}</th><td>{{ branch_name }}</td></tr><tr><th>{% trans 'BRANCH_ADDRESS_LABEL' %}</th><td>{{ address }}</td></tr><tr><th>{% trans 'CHAIRMAN_LABEL' %}</th><td>{{ chairman_full_name }}</td></tr></tbody></table><p>{% trans 'ATTACHMENTS_NOTE' %}</p><div class="signature"><p>{% trans 'CHAIRMAN_SIGNATURE_LABEL' %} {{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    PETITION_TITLE: 'ЗАЯВЛЕНИЕ ОБ УЧРЕЖДЕНИИ КООПЕРАТИВНОГО УЧАСТКА',
    TO_COUNCIL: 'В Совет',
    FROM_CHAIRMAN: 'от председателя собрания пайщиков',
    PETITION_TEXT: 'На основании решения собрания пайщиков прошу Совет согласовать создание кооперативного участка со следующими реквизитами и согласовать кандидатуру избранного председателя кооперативного участка',
    BRANCH_NAME_LABEL: 'Наименование кооперативного участка',
    BRANCH_ADDRESS_LABEL: 'Адрес привязки кооперативного участка',
    CHAIRMAN_LABEL: 'Избранный председатель кооперативного участка',
    ATTACHMENTS_NOTE: 'Приложения: протокол решения собрания пайщиков, бюллетени голосования участников.',
    CHAIRMAN_SIGNATURE_LABEL: 'Председатель собрания',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
  },
  meta: {
    created_at: '15.03.2024 18:30',
  },
  user: {
    full_name_or_short_name: 'Иванов Петр Сидорович',
  },
  branch_name: 'РОМАШКА',
  address: 'г. Красногорск, ул. Ленина, д. 1',
  chairman_full_name: 'Сидоров Николай Петрович',
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
