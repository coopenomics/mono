import type { IDecisionData, IDocDataRef, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonRequest, ICommonUser, ICooperativeData, IFirstLastMiddleName, IVars } from '../../model'
import type { IOrganizationData } from '../../users'

export const registry_id = 1102

// Модель действия для генерации.
//
// Семантика подписантов АПП выдачи пайщику (Эпик 5):
//   - `username` (из IGenerate) — USERNAME пайщика-получателя имущества.
//     ФИО подставляется factory через `getUser(username) → user`.
//   - `transmitter` — USERNAME передающей стороны: председатель
//     кооперативного участка или доверенное им лицо (или председатель
//     кооператива). ФИО подставляется factory через
//     `getUser(transmitter) → getFirstLastMiddleName`.
//
// Текст шаблона и переводы — 1-к-1 с 802.ReturnByAssetAct (юр.выверенный
// текст). В Action попадают только переменные, которые подставляются в
// шаблон; прочие признаки (например, идентификатор записи АПП в
// инфраструктуре marketplace) попадают в meta автоматически.
//
// `doc_data_hash` — зарезервированное опциональное поле для приватных
// данных off-chain (см. раздел «Document Generation Pattern: doc_data»).
export interface Action extends IGenerate, IDocDataRef {
  registry_id: number
  /** id заказа пайщика, по которому формируется АПП. */
  order_id: string
  /** Канонический order_hash on-chain. */
  order_hash: string
  /** Уникальный номер акта (act_id) — выводится в шапке как «АКТ № …». */
  act_id: string
  /** USERNAME председателя КУ или доверенного им лица — передающая сторона. */
  transmitter: string
  /** Имя кооперативного участка, выдающего имущество (braname). */
  braname?: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа: структура повторяет 802.ReturnByAssetAct
// один-к-одному.
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

export const title = 'Акт приёмки-передачи имущества'
export const description = 'Форма акта приёмки-передачи имущества'
export const context = '<style>\nh1 {\n  margin: 0px;\n  text-align: center;\n}\nh3 {\n  margin: 0px;\n  padding-top: 15px;\n}\n.about {\n  padding: 20px;\n}\n.about p {\n  margin: 0px;\n}\n.digital-document {\n  padding: 20px;\n  white-space: pre-wrap;\n}\n.subheader {\n  padding-bottom: 20px;\n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth,\ntd {\n  border: 1px solid #ccc;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word;\n  overflow-wrap: break-word;\n}\nth {\n  background-color: #f4f4f4;\n  width: 30%;\n}\n</style>\n\n<div class="digital-document">\n  <h1 class="header">{% trans \'act_number\', act_id %}</h1>\n  <p style="text-align:center" class="subheader">{% trans \'act_name\', program.name %}</p>\n  <p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>\n\n  {% if coop.is_branched %}\n  <p>{% trans \'branched_contribution_act\', branch.short_name, vars.full_abbr_genitive, vars.name, user.full_name_or_short_name, program.name, decision.id %}</p>\n  {% else %}\n  <p>{% trans \'contribution_act\', vars.full_abbr, vars.name, user.full_name_or_short_name, program.name, decision.id %}</p>\n  {% endif %}\n\n  <table>\n    <tbody>\n      <tr>\n        <th>№</th>\n        <td>1</td>\n      </tr>\n      <tr>\n        <th>{% trans \'article\' %}</th>\n        <td>{{ request.hash }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'asset_title\' %}</th>\n        <td>{{ request.title }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'form_of_asset\' %}</th>\n        <td>{% trans \'form_of_asset_type\' %}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_of_measurement\' %}</th>\n        <td>{{ request.unit_of_measurement }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'units\' %}</th>\n        <td>{{ request.units }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_cost\', request.currency %}</th>\n        <td>{{ request.unit_cost }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'total_cost\', request.currency %}</th>\n        <td>{{ request.total_cost }}</td>\n      </tr>\n    </tbody>\n  </table>\n\n<table>\n      <tbody>\n       <tr>\n          <th></th>\n          <td>{% trans \'participant_full_name\' %}</td>\n          <td>{% trans \'date\' %}</td>\n          <td>{% trans \'signature\' %}</td>\n        </tr>\n         \n       <tr>\n          <th>{% trans \'ordered\' %}</th>\n          <td>{{ user.full_name_or_short_name }}</td>\n          <td>{{ order_date }}</td>\n          <td>{% trans \'signature_placeholder\' %}</td>\n        </tr>\n        \n      </tbody>\n    </table>\n  <p>{% trans \'contribution\', request.total_cost, request.currency, request.total_cost_string %}</p><div class="signature">\n<table>\n      <tbody>\n       <tr>\n          <th></th>\n          <td>{% trans \'participant_full_name\' %}</td>\n          <td>{% trans \'signature\' %}</td>\n        </tr>\n         <tr>\n          <th>{% trans \'received_order\' %}</th>\n          <td>{{ user.full_name_or_short_name }}</td>\n          <td>{% trans \'signature_placeholder\' %}</td>\n        </tr>\n        <tr>\n          <th>{% trans \'transferred_order\' %}</th>\n          <td>{{ transmitter.last_name }} {{ transmitter.first_name }} {{ transmitter.middle_name }}</td>\n          <td>{% trans \'signature_placeholder\' %}</td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n</div>\n'

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
    act_name: 'приемки-передачи имущества по Целевой Потребительской Программе «{0}»',
    contribution_act: '{0} "{1}" (далее – Кооператив), в лице полномочного Представителя Кооператива, и пайщик Кооператива {2} (далее – "Пайщик") составили настоящий Акт о том, что Пайщик заказал и впоследствии получил от Кооператива, в соответствии с Целевой Потребительской Программой "{3}" и Протоколом Совета №{4}, следующее имущество:',
    branched_contribution_act: 'Кооперативный участок "{0}" {1} "{2}" (далее – Кооператив), в лице полномочного Представителя Кооператива, и пайщик Кооператива {3} (далее – "Пайщик") составили настоящий Акт о том, что Пайщик заказал и впоследствии получил от Кооператива, в соответствии с Целевой Потребительской Программой "{4}" и Протоколом Совета №{5}, следующее имущество:',
    contribution: 'Для покрытия затрат, связанных с получением вышеуказанного имущества, Пайщик внес паевой взнос в размере {0} {1} ({2}). Пайщик, в соответствии с соглашением новации, получил от Кооператива имущество в достаточном для Пайщика качестве и количестве. Пайщик претензий к Кооперативу не имеет.',
    ordered: 'Заказал',
    signature_placeholder: 'подписан электронной подписью',
    received_order: 'Получил заказ',
    transferred_order: 'Передал заказ',
    signature: 'Подпись',
    date: 'Дата',
    participant_full_name: 'ФИО/Наименование Пайщика',
  },
}

export const exampleData = {
  meta: {
    created_at: '12.05.2026 11:30',
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
    total_cost_string: 'восемьсот пятьдесят рублей 00 копеек',
    currency: 'RUB',
  },
  program: {
    name: 'СТОЛ ЗАКАЗОВ',
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
  order_date: '01.05.2026',
  act_id: 'APL-2026-05-0001',
  decision: {
    id: '24',
  },
}
