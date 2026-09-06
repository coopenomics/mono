import type { IDocDataRef, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonRequest, ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IOrganizationData } from '../../users'

export const registry_id = 1113

/**
 * Заявление о возврате паевого взноса имуществом — выдача заказа в паевой
 * модели ЦПП «Стол заказов» (компонент 68, задача 99D-5).
 *
 * Подписывается пайщиком-заказчиком на пункте выдачи после сверки состава:
 * фактическое количество и цена — то, что заказчик действительно получает.
 * Уходит в повестку совета (`marketplace::issuestmt` → `soviet::createagenda`,
 * тип `mktissue`); после решения совета составляется акт 1115.
 *
 * Текст — 1-к-1 с 800.ReturnByAssetStatement (юридически выверенный), с
 * указанием целевой потребительской программы. Прежний 800 принадлежал
 * системе клиринга и снят вместе с ней.
 */
export interface Action extends IGenerate, IDocDataRef {
  registry_id: number
  /** id заказа пайщика. */
  order_id: string
  /** Канонический order_hash on-chain (он же hash повестки совета). */
  order_hash: string
  /** Имя кооперативного участка выдачи (braname). */
  braname?: string
  /** Артикул (СКУ) товара по заказу. */
  sku: string
  /** Наименование товара по заказу. */
  product_title: string
  /** Человекочитаемая единица измерения (напр. «л», «шт.»). */
  unit_of_measurement: string
  /** Фактически выдаваемое количество единиц. */
  fact_quantity: number
  /** Фактическая цена за единицу отпуска (десятичная строка без символа валюты). */
  unit_cost: string
  /** Фактическая сумма выдачи (десятичная строка). */
  total_amount: string
  /** Символ валюты (напр. «RUB»). */
  currency: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  request: ICommonRequest
  program: ICommonProgram
  branch?: IOrganizationData
}

export const title = 'Заявление о возврате паевого взноса имуществом'
export const description = 'Форма заявления пайщика о возврате паевого взноса имуществом по ЦПП «Стол заказов»'
export const context = '<style>\nh1 {\n  margin: 0px;\n  text-align: center;\n}\n.digital-document {\n  padding: 20px;\n}\n.digital-document p {\n  margin: 0 0 6px;\n}\n.subheader {\n  padding-bottom: 20px;\n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid currentColor;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word;\n  overflow-wrap: break-word;\n}\nth {\n  width: 30%;\n}\n</style>\n\n<div class="digital-document">\n  <div style="text-align: right; margin-bottom: 24px;">\n    <p style="margin: 0px !important">{% trans \'v_soviet\' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>\n    <p style="margin: 0px !important">{% trans \'from\' %} {{ user.full_name_or_short_name }}</p>\n  </div>\n\n  <div style="text-align: center">\n    <h1 class="header">{% trans \'statement\' %}</h1>\n    <p class="subheader">{% trans \'statement_subheader\', program.name %}</p>\n  </div>\n\n  {% if coop.is_branched %}\n  <p>{% trans \'branched_property_contribution\', branch.short_name, coop.short_name, program.name %}</p>\n  {% else %}\n  <p>{% trans \'property_contribution\', coop.short_name, program.name %}</p>\n  {% endif %}\n\n  <table>\n    <tbody>\n      <tr>\n        <th>№</th>\n        <td>1</td>\n      </tr>\n      <tr>\n        <th>{% trans \'article\' %}</th>\n        <td>{{ request.hash }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'asset_title\' %}</th>\n        <td>{{ request.title }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'form_of_asset\' %}</th>\n        <td>{% trans \'form_of_asset_type\' %}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_of_measurement\' %}</th>\n        <td>{{ request.unit_of_measurement }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'units\' %}</th>\n        <td>{{ request.units }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_cost\', request.currency %}</th>\n        <td>{{ request.unit_cost }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'total_cost\', request.currency %}</th>\n        <td>{{ request.total_cost }}</td>\n      </tr>\n    </tbody>\n  </table>\n\n  <p>{% trans \'signature\' %}</p>\n  <p>{{ user.full_name_or_short_name }}</p>\n  <p>{{ meta.created_at }}</p>\n</div>\n'

export const translations = {
  ru: {
    from: 'от',
    v_soviet: 'В Совет',
    statement: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о возврате паевого взноса имуществом по Целевой Потребительской Программе «{0}»',
    property_contribution: 'Прошу возвратить принадлежащий мне паевой взнос в {0} в соответствии с условиями Целевой Потребительской Программы "{1}" в виде следующего имущества:',
    branched_property_contribution: 'Прошу возвратить принадлежащий мне паевой взнос в {1} через кооперативный участок "{0}" в соответствии с условиями Целевой Потребительской Программы "{2}" в виде следующего имущества:',
    signature: 'Подписано электронной подписью.',
    unit_cost: 'Стоимость Единицы, {0}',
    total_cost: 'Стоимость Всего, {0}',
    article: 'Артикул',
    asset_title: 'Наименование/Реквизиты',
    form_of_asset: 'Форма имущества',
    form_of_asset_type: 'Материальная',
    unit_of_measurement: 'Единицы измерения',
    units: 'Количество',
  },
}

export const exampleData = {
  vars: {
    name: 'Восход',
    full_abbr_genitive: 'потребительского кооператива',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  coop: {
    short_name: 'ПК ВОСХОД',
    is_branched: true,
  },
  branch: {
    short_name: 'КУ-МОСКВА-1',
  },
  program: {
    name: 'Стол заказов',
  },
  meta: {
    created_at: '06.09.2026 12:13',
  },
  request: {
    hash: '123',
    title: 'Молоко "Бурёнка"',
    unit_of_measurement: 'Литр',
    units: '10',
    unit_cost: '100',
    total_cost: '1000',
    currency: 'RUB',
  },
}
