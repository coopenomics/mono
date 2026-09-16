import type { IDecisionData, IDocDataRef, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonRequest, ICommonUser, ICooperativeData, IFirstLastMiddleName, IVars } from '../../model'
import type { IOrganizationData } from '../../users'

export const registry_id = 1115

/**
 * Акт приёма-передачи имущества в счёт возврата паевого взноса — выдача заказа
 * в паевой модели ЦПП «Стол заказов» (компонент 68).
 *
 * Составляется во исполнение Протокола решения совета (1114). Порядок подписей:
 *   - первая — пайщик-заказчик (`username`, устройство ставит подпись по
 *     получении протокола без нового нажатия; `marketplace::issueact1`);
 *   - вторая, закрывающая — передающая сторона `transmitter`: председатель
 *     участка выдачи, доверенное лицо или оператор (`marketplace::issueact2`).
 *     Только она ставит проводки и переводит заказ в «получен».
 *
 * Текст и переводы — 1-к-1 с 802.ReturnByAssetAct (юридически выверенный
 * текст, ссылка на номер протокола). Прежний 802 принадлежал системе
 * клиринга и снят вместе с ней; 1105 членской модели снят вместе с моделью.
 */
export interface Action extends IGenerate, IDocDataRef {
  registry_id: number
  /** id заказа пайщика. */
  order_id: string
  /** Канонический order_hash on-chain. */
  order_hash: string
  /** ID решения совета в soviet.decisions — номер протокола в тексте акта. */
  decision_id: number
  /** Уникальный номер акта (act_id) — выводится в шапке как «АКТ № …». */
  act_id: string
  /** USERNAME председателя КУ, доверенного или оператора — передающая сторона. */
  transmitter: string
  /** Имя кооперативного участка выдачи (braname). */
  braname?: string
  /** Артикул (СКУ) товара по заказу. */
  sku: string
  /** Наименование товара по заказу. */
  product_title: string
  /** Человекочитаемая единица измерения. */
  unit_of_measurement: string
  /** Фактически выдаваемое количество единиц. */
  fact_quantity: number
  /** Фактическая цена за единицу отпуска. */
  unit_cost: string
  /** Фактическая сумма выдачи. */
  total_amount: string
  /** Символ валюты. */
  currency: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  request: ICommonRequest
  decision: IDecisionData
  act_id: string
  transmitter: IFirstLastMiddleName
  program: ICommonProgram
  branch?: IOrganizationData
}

export const title = 'Акт приёма-передачи имущества в счёт возврата паевого взноса'
export const description = 'Форма акта приёма-передачи имущества пайщику в счёт возврата паевого взноса по ЦПП «Стол заказов»'
export const context = '<style>\nh1 {\n  margin: 0px;\n  text-align: center;\n}\nh3 {\n  margin: 0px;\n  padding-top: 15px;\n}\n.about {\n  padding: 20px;\n}\n.about p {\n  margin: 0px;\n}\n.digital-document {\n  padding: 20px;\n  white-space: pre-wrap;\n}\n.subheader {\n  padding-bottom: 20px;\n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth,\ntd {\n  border: 1px solid currentColor;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word;\n  overflow-wrap: break-word;\n}\nth {\n  width: 30%;\n}\n</style>\n\n<div class="digital-document">\n  <h1 class="header">{% trans \'act_number\', act_id %}</h1>\n  <p style="text-align:center" class="subheader">{% trans \'act_name\', program.name %}</p>\n  <p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>\n\n  {% if coop.is_branched %}\n  <p>{% trans \'branched_contribution_act\', branch.short_name, vars.full_abbr_genitive, vars.name, user.full_name_or_short_name, program.name, decision.id %}</p>\n  {% else %}\n  <p>{% trans \'contribution_act\', vars.full_abbr, vars.name, user.full_name_or_short_name, program.name, decision.id %}</p>\n  {% endif %}\n\n  <table>\n    <tbody>\n      <tr>\n        <th>№</th>\n        <td>1</td>\n      </tr>\n      <tr>\n        <th>{% trans \'article\' %}</th>\n        <td>{{ request.hash }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'asset_title\' %}</th>\n        <td>{{ request.title }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'form_of_asset\' %}</th>\n        <td>{% trans \'form_of_asset_type\' %}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_of_measurement\' %}</th>\n        <td>{{ request.unit_of_measurement }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'units\' %}</th>\n        <td>{{ request.units }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_cost\', request.currency %}</th>\n        <td>{{ request.unit_cost }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'total_cost\', request.currency %}</th>\n        <td>{{ request.total_cost }}</td>\n      </tr>\n    </tbody>\n  </table>\n\n<p>{% trans \'contribution\', request.total_cost, request.currency %}</p><div class="signature">\n<table>\n      <tbody>\n       <tr>\n          <th></th>\n          <td>{% trans \'participant_full_name\' %}</td>\n          <td>{% trans \'signature\' %}</td>\n        </tr>\n         <tr>\n          <th>{% trans \'received_order\' %}</th>\n          <td>{{ user.full_name_or_short_name }}</td>\n          <td>{% trans \'signature_placeholder\' %}</td>\n        </tr>\n        <tr>\n          <th>{% trans \'transferred_order\' %}</th>\n          <td>{{ transmitter.last_name }} {{ transmitter.first_name }} {{ transmitter.middle_name }}</td>\n          <td>{% trans \'signature_placeholder\' %}</td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n</div>\n'

export const translations = {
  ru: {
    unit_of_measurement: 'Единицы измерения',
    article: 'Артикул',
    asset_title: 'Наименование / реквизиты',
    form_of_asset: 'Форма имущества',
    units: 'Количество',
    unit_cost: 'Стоимость Единицы, {0}',
    total_cost: 'Стоимость Всего, {0}',
    form_of_asset_type: 'Материальная',
    act_number: 'АКТ №{0}',
    act_name: 'приёма-передачи имущества в счёт возврата паевого взноса по Целевой Потребительской Программе «{0}»',
    contribution_act: '{0} "{1}" (далее – Кооператив), в лице полномочного Представителя Кооператива, и пайщик Кооператива {2} (далее – "Пайщик") составили настоящий Акт о том, что Пайщик заказал и впоследствии получил от Кооператива, в соответствии с Целевой Потребительской Программой "{3}" и Протоколом Совета №{4}, следующее имущество:',
    branched_contribution_act: 'Кооперативный участок "{0}" {1} "{2}" (далее – Кооператив), в лице полномочного Представителя Кооператива, и пайщик Кооператива {3} (далее – "Пайщик") составили настоящий Акт о том, что Пайщик заказал и впоследствии получил от Кооператива, в соответствии с Целевой Потребительской Программой "{4}" и Протоколом Совета №{5}, следующее имущество:',
    contribution: 'Вышеуказанное имущество передано Пайщику в счёт возврата принадлежащего ему паевого взноса в размере {0} {1}. Пайщик получил от Кооператива имущество в достаточном для Пайщика качестве и количестве. Пайщик претензий к Кооперативу не имеет.',
    signature_placeholder: 'подписан электронной подписью',
    received_order: 'Получил',
    transferred_order: 'Передал',
    signature: 'Подпись',
    participant_full_name: 'ФИО/Наименование Пайщика',
  },
}

export const exampleData = {
  meta: {
    created_at: '06.09.2026 12:15',
  },
  coop: {
    city: 'Москва',
    is_branched: true,
  },
  user: {
    full_name_or_short_name: 'Петров Пётр Петрович',
  },
  request: {
    unit_of_measurement: 'шт.',
    hash: '0000abcd...',
    title: 'Сахар-песок «Сладкий», 1 кг',
    units: '10',
    unit_cost: '85',
    total_cost: '850',
    currency: 'RUB',
  },
  program: {
    name: 'Стол заказов',
  },
  branch: {
    short_name: 'КУ-МОСКВА-1',
  },
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
  },
  transmitter: {
    last_name: 'Иванов',
    first_name: 'Иван',
    middle_name: 'Иванович',
  },
  act_id: 'APL-2026-09-0001',
  decision: {
    id: 24,
  },
}
