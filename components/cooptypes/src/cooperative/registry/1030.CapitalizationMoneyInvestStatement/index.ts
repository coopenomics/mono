import type { ICommonUser, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1030

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  amount: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  vars: IVars
  common_user: ICommonUser
  amount: string
}

export const title = 'Заявление об инвестировании денежных средств в Благорост'
export const description = 'Заявление о зачете части целевого паевого взноса в целевую потребительскую программу БЛАГОРОСТ'

export const context = `<div class="digital-document"><p style="text-align: right">{% trans 'to_council' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p style="text-align: right">{% trans 'from_shareholder' %} {{ common_user.full_name_or_short_name }}</p><div style="text-align: center"><h2>{% trans 'statement_title' %}</h2></div><p>{% trans 'request_credit' %} {{ amount }} {% trans 'as_share_contribution' %}.</p><p>{% trans 'signed_by_digital_signature' %}							{{ created_at }}</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}</style>`

export const translations = {
  ru: {
    to_council: 'В Совет',
    from_shareholder: 'От пайщика:',
    statement_title: 'ЗАЯВЛЕНИЕ',
    request_credit: 'Прошу зачесть часть моего целевого паевого взноса по Целевой Потребительской Программе "ЦИФРОВОЙ КОШЕЛЕК" в размере',
    as_share_contribution: 'в качестве паевого взноса в целевую потребительскую программу "БЛАГОРОСТ"',
    signed_by_digital_signature: 'Подписано электронной подписью',
  },
}

export const exampleData = {
  meta: {
    created_at: '11.04.2024 12:00',
  },
  amount: '50000.00 RUB',
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    email: 'ivanov@example.com',
    phone: '+7 999 123-45-67',
  },
}
