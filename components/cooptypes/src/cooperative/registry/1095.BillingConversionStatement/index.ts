import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1095

/**
 * Интерфейс генерации заявления на перевод паевого взноса пайщика по программе
 * «Цифровой Кошелёк» в членский взнос по соглашению о подключении (Epic 12,
 * действие billing::convert). Членский взнос зачисляется на биллинг-кошелёк, с
 * которого оплачиваются подписки; сам факт перевода трактуется как согласие на
 * последующие рекуррентные списания.
 */
export interface Action extends IGenerate {
  registry_id: number
  convert_amount: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  vars: IVars
  coop: ICooperativeData
  commonUser: ICommonUser
}

export const title = 'Заявление о переводе паевого взноса в членский взнос'
export const description = 'Форма заявления о переводе паевого взноса по программе «Цифровой Кошелёк» в членский взнос по соглашению о подключении'

export const context = `<style>.digital-document h1 {margin: 0px;text-align:center;}.digital-document {padding: 20px;}.subheader {padding-bottom: 20px;}</style><div class="digital-document"><div style="text-align: right; margin:"><p>{% trans 'to_council_of' %} {{vars.full_abbr_genitive}} «{{vars.name}}»</p><p>{% trans 'from_participant' %}</p><p>{{ commonUser.full_name_or_short_name }}</p></div><h1 class="header">{% trans 'convert_statement' %}</h1><p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right">{{ meta.created_at }}, {{coop.city}}</p><p>{% trans 'convert_request_text', meta.convert_amount %}</p><div class="signature"><p>{% trans 'signature' %} </p><p>{{ commonUser.full_name_or_short_name }}</p></div></div>`

export const translations = {
  ru: {
    to_council_of: 'В Совет',
    convert_request_text: 'Прошу перевести мой паевой взнос по программе «Цифровой Кошелёк» в сумме {0} в членский взнос по соглашению о подключении. Подтверждаю своё согласие на последующие списания членских взносов в счёт оплаты подписок.',
    signature: 'Документ подписан электронной подписью',
    convert_statement: 'Заявление о переводе паевого взноса в членский взнос',
    from_participant: 'от пайщика',
  },
}

export const exampleData = {
  meta: {
    created_at: '04.03.2024 10:54',
    convert_amount: '1500.00 RUB',
  },
  coop: {
    city: 'Москва',
  },
  commonUser: {
    full_name_or_short_name: 'ПК "РОМАШКА"',
  },
  vars: {
    full_abbr_genitive: 'потребительского кооператива',
    name: 'ВОСХОД',
  },
}
