import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 900

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  method_id: string // ID платежного метода
  quantity: string
  currency: string
  payment_hash: string // Хеш платежа для связи с withdraw
}

export type Meta = IMetaDocument & Action

// Модель данных документа с детальными платежными данными
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  payment_details: string // Детали платежа из хранилища
  quantity: string
  currency: string
  payment_hash: string // Хеш платежа для связи с withdraw
}

export const title = 'Заявление на возврат паевого взноса денежными средствами'
export const description = 'Форма заявления на возврат паевого взноса денежными средствами'
export const context = `<div class="digital-document"><div style="text-align: right; margin:"><p style="margin: 0px !important">{% trans 'v_soviet' %} {{ vars.full_abbr_genitive}} "{{vars.name}}"</p><p style="margin: 0px !important">{% trans 'from_participant' %}</p><p style="margin: 0px !important">{{ user.full_name_or_short_name}}</p></div><div style="text-align: center; padding-top: 20px; padding-bottom: 20px;"><h1 class="header">{% trans 'statement' %}</h1></div><p style="padding-bottom: 20px;">{% trans 'money_return_request', coop.short_name %}</p><table style="margin-bottom: 20px;"><tbody><tr><th>{% trans 'asset_form' %}</th><td>{% trans 'money_assets' %}</td></tr><tr><th>{% trans 'name_requisites' %}</th><td>{% trans 'return_part_contribution' %}</td></tr><tr><th>№</th><td>1</td></tr><tr><th>{% trans 'payment_details_field' %}</th><td style="white-space: pre-line;">{{ payment_details }}</td></tr><tr><th>{% trans 'article' %}</th><td>na</td></tr><tr><th>{% trans 'unit_measurement' %}</th><td>{{ currency }}</td></tr><tr><th>{% trans 'quantity' %}</th><td>{{ quantity }}</td></tr><tr><th>{% trans 'unit_cost' %}</th><td>na</td></tr><tr><th>{% trans 'total_cost' %}</th><td>{{ quantity }} {{ currency }}</td></tr></tbody></table><p style="padding-top: 20px;">{% trans 'signature' %}</p><p>{{ user.full_name_or_short_name }}</p><p>{{ created_at }}</p><style>.digital-document {padding: 20px;white-space: pre-wrap;};table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30%;}</style>`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_participant: 'от пайщика',
    statement: 'ЗАЯВЛЕНИЕ',
    money_return_request: 'Прошу возвратить принадлежащий мне паевой взнос в {0} в соответствии с соглашением новации (ст.414 ГК РФ) в виде следующего имущества:',
    payment_details_field: 'Реквизиты получателя',
    article: 'Артикул',
    name_requisites: 'Наименование/Реквизиты',
    asset_form: 'Форма имущества',
    unit_measurement: 'Ед изм.',
    quantity: 'Количество',
    unit_cost: 'Стоимость единицы',
    total_cost: 'Стоимость Всего',
    return_part_contribution: 'Возврат паевого взноса',
    money_assets: 'Денежные средства',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  coop: {
    short_name: 'ПК "ВОСХОД"',
  },
  meta: {
    created_at: '18.03.2025',
  },
  quantity: '50 000',
  currency: 'Руб.',
  payment_hash: 'abc123def456789',
  payment_details: '№ счета получателя: 40817 810 6 3826 1231150\nБанк получателя: ПАО «Сбербанк»\nКорр. счет банка: 30101 810 4 0000 0000225\nБИК 44525225\nПолучатель: Иванов Иван Иванович',
}
