import type { IDocDataRef, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonRequest, ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IOrganizationData } from '../../users'

export const registry_id = 1106

/**
 * Заявление пайщика о гарантийном возврате имущества — Эпик 7 ЦПП
 * «Стол заказов» (членские взносы).
 *
 * Подписывается пайщиком-заказчиком и инициирует процесс возврата
 * полученного по АПП (1104.MarketplaceAplReception) имущества обратно
 * на кооператив в пределах гарантийного срока, заданного поставщиком.
 *
 * При окончательном принятии заявления на очном осмотре C++ контракт
 * `p.mkt.return` выполняет атомарную compensating-forward-пару
 * `o.mkt.return + o.mkt.return2` через транзит 91 — на программный
 * кошелёк пайщика `w.mkt.member.available` возвращается стоимость, а
 * имущество — на склад кооператива.
 *
 * Не путать с registry_id=800 `ReturnByAssetStatement` — тот документ
 * принадлежит старой системе клиринга и сохранён отдельно как есть.
 */
export interface Action extends IGenerate, IDocDataRef {
  registry_id: number
  /** id заказа пайщика, по которому подаётся заявление о возврате. */
  order_id: string
  /** Канонический order_hash on-chain (якорь к o.mkt.order). */
  order_hash: string
  /** Имя кооперативного участка доставки (braname) исходного заказа. */
  braname?: string
  /** Краткое описание причины возврата (1-2000 симв.). */
  reason_text: string
  /** Фактически возвращаемое количество единиц. */
  actual_quantity: number
  /** Стоимость возвращаемой части (4 знака после запятой). */
  fact_cost: string
  /** Артикул (SKU) товара — id предложения, по которому был оформлен заказ. */
  sku: string
  /** Наименование товара из предложения. */
  product_title: string
  /** Единица измерения (человеко-читаемая: «литры», «кг», «шт.» и т.п.). */
  unit_of_measurement: string
  /** Стоимость базовой единицы товара (4 знака после запятой). */
  unit_cost: string
  /** Код валюты (напр. RUB). */
  currency: string
}

export type Meta = IMetaDocument & Action

/**
 * Модель данных для PDF-рендера. Структурно повторяет 800.ReturnByAsset
 * Statement (юр.выверенный текст), но дополнительно несёт ссылку на
 * программу ЦПП «Стол заказов» и факт-параметры возврата (количество и
 * сумма), а также кооперативный участок доставки.
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  request: ICommonRequest
  program: ICommonProgram
  /** Стоимость возвращаемой части. */
  fact_cost: string
  /** Фактически возвращаемое количество. */
  actual_quantity: string
  /** Краткое описание причины возврата. */
  reason_text: string
  branch?: IOrganizationData
}

export const title = 'Заявление о гарантийном возврате имущества'
export const description = 'Форма заявления пайщика о гарантийном возврате имущества по ЦПП «Стол заказов»'
export const context = '<style>\nh1 {\n  margin: 0px;\n  text-align: center;\n}\nh3 {\n  margin: 0px;\n  padding-top: 15px;\n}\n.about {\n  padding: 20px;\n}\n.about p {\n  margin: 0px;\n}\n.digital-document {\n  padding: 20px;\n}\n.digital-document p {\n  margin: 0 0 6px;\n}\n.subheader {\n  padding-bottom: 20px;\n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid currentColor;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word;\n  overflow-wrap: break-word;\n}\nth {\n  width: 30%;\n}\n</style>\n\n<div class="digital-document">\n  <div style="text-align: right; margin-bottom: 24px;">\n    <p style="margin: 0px !important">{% trans \'v_soviet\' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>\n    <p style="margin: 0px !important">{% trans \'from\' %} {{ user.full_name_or_short_name }}</p>\n  </div>\n\n  <div style="text-align: center">\n    <h1 class="header">{% trans \'statement\' %}</h1>\n    <p class="subheader">{% trans \'statement_subheader\', program.name %}</p>\n  </div>\n\n  {% if coop.is_branched %}\n  <p>{% trans \'branched_return\', branch.short_name, vars.full_abbr_genitive, vars.name, program.name %}</p>\n  {% else %}\n  <p>{% trans \'unbranched_return\', vars.full_abbr_genitive, vars.name, program.name %}</p>\n  {% endif %}\n\n  <table>\n    <tbody>\n      <tr>\n        <th>№</th>\n        <td>1</td>\n      </tr>\n      <tr>\n        <th>{% trans \'article\' %}</th>\n        <td>{{ request.hash }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'asset_title\' %}</th>\n        <td>{{ request.title }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'form_of_asset\' %}</th>\n        <td>{% trans \'form_of_asset_type\' %}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_of_measurement\' %}</th>\n        <td>{{ request.unit_of_measurement }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'units_returned\' %}</th>\n        <td>{{ actual_quantity }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_cost\', request.currency %}</th>\n        <td>{{ request.unit_cost }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'fact_cost\', request.currency %}</th>\n        <td>{{ fact_cost }}</td>\n      </tr>\n    </tbody>\n  </table>\n\n  <p>{% trans \'reason_label\' %}</p>\n  <p>{{ reason_text }}</p>\n\n  <p>{% trans \'signature\' %}</p>\n  <p>{{ user.full_name_or_short_name }}</p>\n  <p>{{ meta.created_at }}</p>\n</div>\n'

export const translations = {
  ru: {
    from: 'от',
    v_soviet: 'В Совет',
    statement: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о гарантийном возврате имущества по Целевой Потребительской Программе «{0}»',
    unbranched_return: 'Прошу принять заявление о гарантийном возврате имущества, полученного мной от {0} "{1}" в рамках Целевой Потребительской Программы "{2}", в пределах гарантийного срока, установленного поставщиком, в следующем составе:',
    branched_return: 'Прошу принять заявление о гарантийном возврате имущества, полученного мной через кооперативный участок "{0}" {1} "{2}" в рамках Целевой Потребительской Программы "{3}", в пределах гарантийного срока, установленного поставщиком, в следующем составе:',
    signature: 'Подписано электронной подписью.',
    article: 'Артикул',
    asset_title: 'Наименование/Реквизиты',
    form_of_asset: 'Форма имущества',
    form_of_asset_type: 'Материальная',
    unit_of_measurement: 'Единицы измерения',
    units_returned: 'Количество к возврату',
    unit_cost: 'Стоимость Единицы, {0}',
    fact_cost: 'Сумма возврата, {0}',
    reason_label: 'Причина обращения:',
  },
}

export const exampleData = {
  meta: {
    created_at: '18.05.2026 11:30',
  },
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
    is_branched: true,
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
    full_abbr: 'Потребительский Кооператив',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  request: {
    hash: '0000abcd...',
    title: 'Сахар-песок «Сладкий», 1 кг',
    unit_of_measurement: 'шт.',
    units: '10',
    unit_cost: '85',
    total_cost: '850',
    currency: 'RUB',
  },
  program: {
    name: 'СТОЛ ЗАКАЗОВ',
  },
  branch: {
    short_name: 'КУ-МОСКВА-1',
  },
  fact_cost: '425.0000',
  actual_quantity: '5',
  reason_text: 'При вскрытии упаковки обнаружена пересортица: вместо сахарного песка молоко с истёкшим сроком годности.',
}
