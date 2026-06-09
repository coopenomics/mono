import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1200

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  quantity: string
  currency: string
  payment_hash: string // Хеш платежа для связи с investment (invest_hash)
  target_coop_fullname: string // Полное наименование кооператива-оператора (получателя инвестиции)
  program_name: string // Наименование целевой потребительской программы оператора
  payment_details: string // Реквизиты оператора и назначение платежа
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  quantity: string
  currency: string
  payment_hash: string
  target_coop_fullname: string
  program_name: string
  payment_details: string
}

export const title = 'Заявление об инвестировании средств кооператива в ЦПП оператора'
export const description = 'Форма заявления об инвестировании средств кооператива в целевую потребительскую программу кооператива-оператора платформы'
export const context = `<div class="digital-document"><div style="text-align: right; margin:"><p style="margin: 0px !important">{% trans 'v_soviet' %} {{ vars.full_abbr_genitive}} "{{vars.name}}"</p><p style="margin: 0px !important">{% trans 'from_chairman' %}</p><p style="margin: 0px !important">{{ user.full_name_or_short_name}}</p></div><div style="text-align: center; padding-top: 20px; padding-bottom: 20px;"><h1 class="header">{% trans 'statement' %}</h1></div><p style="padding-bottom: 20px;">{% trans 'invest_request', target_coop_fullname, program_name, quantity, currency %}</p><p style="padding-bottom: 20px;">{% trans 'assign_chairman', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}</p><table style="margin-bottom: 20px;"><tbody><tr><th>{% trans 'target_coop_field' %}</th><td>{{ target_coop_fullname }}</td></tr><tr><th>{% trans 'program_field' %}</th><td>{{ program_name }}</td></tr><tr><th>{% trans 'payment_details_field' %}</th><td style="white-space: pre-line;">{{ payment_details }}</td></tr><tr><th>{% trans 'unit_measurement' %}</th><td>{{ currency }}</td></tr><tr><th>{% trans 'quantity' %}</th><td>{{ quantity }}</td></tr><tr><th>{% trans 'total_cost' %}</th><td>{{ quantity }} {{ currency }}</td></tr></tbody></table><p style="padding-top: 20px;">{% trans 'signature' %}</p><p>{{ user.full_name_or_short_name }}</p><p>{{ meta.created_at }}</p><style>.digital-document {padding: 20px;white-space: pre-wrap;};table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30%;}</style>`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_chairman: 'от председателя совета',
    statement: 'ЗАЯВЛЕНИЕ',
    invest_request: 'Предлагаю принять решение об инвестировании средств кооператива в {0} в рамках целевой потребительской программы «{1}» в сумме {2} {3}.',
    assign_chairman: 'Поручить председателю совета {0} {1} {2} произвести необходимые действия по перечислению средств и оформлению инвестиции.',
    target_coop_field: 'Получатель инвестиции',
    program_field: 'Целевая потребительская программа',
    payment_details_field: 'Реквизиты и назначение платежа',
    unit_measurement: 'Ед изм.',
    quantity: 'Количество',
    total_cost: 'Стоимость Всего',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  vars: {
    name: 'КООПЕРАТИВ',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  coop: {
    short_name: 'ПК "КООПЕРАТИВ"',
    chairman: {
      last_name: 'Иванов',
      first_name: 'Иван',
      middle_name: 'Иванович',
    },
  },
  meta: {
    created_at: '18.03.2025',
  },
  quantity: '100 000',
  currency: 'RUB',
  payment_hash: 'abc123def456789',
  target_coop_fullname: 'Потребительский Кооператив «ВОСХОД»',
  program_name: 'Благорост',
  payment_details: '№ счета получателя: 40703 810 0 3800 0005215\nБанк получателя: ПАО «Сбербанк»\nКорр. счет банка: 30101 810 4 0000 0000225\nБИК 44525225\nПолучатель: ПК «ВОСХОД»\nНазначение платежа: Паевой взнос по ЦПП «Цифровой Кошелёк»',
}
