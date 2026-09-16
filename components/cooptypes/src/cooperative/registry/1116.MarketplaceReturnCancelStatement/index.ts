import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonRequest, ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IOrganizationData } from '../../users'

export const registry_id = 1116

/**
 * Заявление оператора кооперативного участка в совет об отмене сделки по
 * гарантийному возврату имущества — паевая модель ЦПП «Стол заказов»
 * (компонент 68, задача 99D-12; решение владельца 08.09.2026 по разъяснению
 * методолога).
 *
 * Пайщик получил имущество как возврат паевого взноса и в пределах гарантийного
 * срока подал рекламацию — Заявление о гарантийном возврате имущества (1106).
 * Оператор участка осмотрел имущество у стойки, принял его под свою
 * материальную ответственность и этим заявлением просит совет отменить сделку:
 * принять имущество на склад участка и восстановить пайщику паевой и членский
 * взносы за возвращённое. Подписывает только оператор (`marketplace::accretrn`);
 * пайщик ничего не вносит — сделка отменяется. Заявление уходит в повестку
 * совета (тип `mktretrn`); совет легитимизирует решение оператора протоколом
 * 1117, по которому контракт проводит обратные операции.
 *
 * `username` документа — оператор (подписант); пайщик указан полем `orderer`.
 * Поля повторяются в протоколе 1117: робот решений совета переносит деловые
 * поля метаданных заявления повестки в данные протокола.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** id заказа пайщика, сделка по которому отменяется. */
  order_id: string
  /** Канонический order_hash on-chain — сделка, которая отменяется. */
  order_hash: string
  /** Хэш рекламации пайщика (return_request.hash, он же нитка процесса возврата). */
  request_hash: string
  /** Кооперативный участок, на котором принято имущество (braname). */
  braname: string
  /** Пайщик-заказчик, чья сделка отменяется (username). */
  orderer: string
  /** Оператор участка, принявший имущество (username; совпадает с подписантом). */
  operator: string
  /** Номер протокола решения совета о выдаче имущества по этому заказу; 0 — сделка без протокола (старые заказы). */
  issue_decision_id: number
  /** Артикул (SKU) товара — id предложения, по которому был оформлен заказ. */
  sku: string
  /** Наименование товара из предложения. */
  product_title: string
  /** Единица измерения (человеко-читаемая: «литры», «кг», «шт.» и т.п.). */
  unit_of_measurement: string
  /** Принятое на участке количество единиц. */
  actual_quantity: number
  /** Стоимость базовой единицы товара (4 знака после запятой). */
  unit_cost: string
  /** Стоимость принятого имущества — паевой взнос к восстановлению (4 знака после запятой). */
  fact_cost: string
  /** Членский взнос участка за принятое имущество — к восстановлению на членский кошелёк (4 знака после запятой). */
  fee_refund: string
  /** Всего к восстановлению пайщику: паевой плюс членский (4 знака после запятой). */
  total_refund: string
  /** Код валюты (напр. RUB). */
  currency: string
  /** Причина обращения пайщика из рекламации. */
  reason_text: string
  /** Результат осмотра имущества оператором на участке. */
  inspection_result: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  /** Оператор участка — автор и подписант заявления. */
  user: ICommonUser
  /** Пайщик, чья сделка отменяется. */
  orderer: ICommonUser
  request: ICommonRequest
  program: ICommonProgram
  branch?: IOrganizationData
  /** Стоимость принятого имущества — паевой взнос к восстановлению. */
  fact_cost: string
  /** Членский взнос за принятое имущество — к восстановлению. */
  fee_refund: string
  /** Всего к восстановлению. */
  total_refund: string
  /** Принятое количество. */
  actual_quantity: string
  /** Причина обращения пайщика. */
  reason_text: string
  /** Результат осмотра на участке. */
  inspection_result: string
  /** Сделка: хэш заказа. */
  order_hash: string
  /** Рекламация пайщика: хэш заявления. */
  request_hash: string
  /** Номер протокола совета о выдаче; пустая строка — без протокола. */
  issue_decision_id: string
}

export const title = 'Заявление об отмене сделки по гарантийному возврату имущества'
export const description = 'Форма заявления оператора кооперативного участка в совет об отмене сделки по возврату паевого взноса имуществом при гарантийном возврате по ЦПП «Стол заказов»'
export const context = '<style>\nh1 {\n  margin: 0px;\n  text-align: center;\n}\nh3 {\n  margin: 0px;\n  padding-top: 15px;\n}\n.about {\n  padding: 20px;\n}\n.about p {\n  margin: 0px;\n}\n.digital-document {\n  padding: 20px;\n}\n.digital-document p {\n  margin: 0 0 6px;\n}\n.subheader {\n  padding-bottom: 20px;\n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid currentColor;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word;\n  overflow-wrap: break-word;\n}\nth {\n  width: 30%;\n}\n</style>\n\n<div class="digital-document">\n  <div style="text-align: right; margin-bottom: 24px;">\n    <p style="margin: 0px !important">{% trans \'v_soviet\' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>\n    {% if coop.is_branched %}\n    <p style="margin: 0px !important">{% trans \'from_operator\', branch.short_name %} {{ user.full_name_or_short_name }}</p>\n    {% else %}\n    <p style="margin: 0px !important">{% trans \'from_authorized\' %} {{ user.full_name_or_short_name }}</p>\n    {% endif %}\n  </div>\n\n  <div style="text-align: center">\n    <h1 class="header">{% trans \'statement\' %}</h1>\n    <p class="subheader">{% trans \'statement_subheader\', program.name %}</p>\n  </div>\n\n  {% if coop.is_branched %}\n  <p>{% trans \'branched_intro\', orderer.full_name_or_short_name, request_hash, branch.short_name, vars.full_abbr_genitive, vars.name, program.name, order_hash %}{% if issue_decision_id %} {% trans \'issue_decision\', issue_decision_id %}{% endif %}.</p>\n  {% else %}\n  <p>{% trans \'unbranched_intro\', orderer.full_name_or_short_name, request_hash, vars.full_abbr_genitive, vars.name, program.name, order_hash %}{% if issue_decision_id %} {% trans \'issue_decision\', issue_decision_id %}{% endif %}.</p>\n  {% endif %}\n\n  <p>{% trans \'reason_label\' %}</p>\n  <p>{{ reason_text }}</p>\n\n  <p>{% trans \'inspection_label\' %}</p>\n  <p>{{ inspection_result }}</p>\n\n  {% if coop.is_branched %}\n  <p>{% trans \'branched_accepted\', branch.short_name %}</p>\n  {% else %}\n  <p>{% trans \'unbranched_accepted\' %}</p>\n  {% endif %}\n\n  <table>\n    <tbody>\n      <tr>\n        <th>№</th>\n        <td>1</td>\n      </tr>\n      <tr>\n        <th>{% trans \'article\' %}</th>\n        <td>{{ request.hash }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'asset_title\' %}</th>\n        <td>{{ request.title }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'form_of_asset\' %}</th>\n        <td>{% trans \'form_of_asset_type\' %}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_of_measurement\' %}</th>\n        <td>{{ request.unit_of_measurement }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'units_accepted\' %}</th>\n        <td>{{ actual_quantity }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'unit_cost\', request.currency %}</th>\n        <td>{{ request.unit_cost }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'fact_cost\', request.currency %}</th>\n        <td>{{ fact_cost }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'fee_refund\', request.currency %}</th>\n        <td>{{ fee_refund }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'total_refund\', request.currency %}</th>\n        <td>{{ total_refund }}</td>\n      </tr>\n    </tbody>\n  </table>\n\n  <p>{% trans \'request_text\', orderer.full_name_or_short_name, fact_cost, fee_refund, total_refund, request.currency %}</p>\n\n  <p>{% trans \'signature\' %}</p>\n  <p>{{ user.full_name_or_short_name }}</p>\n  <p>{{ meta.created_at }}</p>\n</div>\n'

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_operator: 'от оператора кооперативного участка "{0}"',
    from_authorized: 'от уполномоченного лица',
    statement: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'об отмене сделки по гарантийному возврату имущества по Целевой Потребительской Программе «{0}»',
    branched_intro: 'Пайщик {0} обратился с заявлением о гарантийном возврате имущества (заявление {1}), полученного им через кооперативный участок "{2}" {3} "{4}" в счёт возврата паевого взноса по Целевой Потребительской Программе "{5}" по заказу {6}, в пределах гарантийного срока, установленного поставщиком',
    unbranched_intro: 'Пайщик {0} обратился с заявлением о гарантийном возврате имущества (заявление {1}), полученного им от {2} "{3}" в счёт возврата паевого взноса по Целевой Потребительской Программе "{4}" по заказу {5}, в пределах гарантийного срока, установленного поставщиком',
    issue_decision: '(протокол решения совета № {0})',
    reason_label: 'Причина обращения пайщика:',
    inspection_label: 'Результат осмотра имущества на кооперативном участке:',
    branched_accepted: 'Имущество осмотрено и принято мной на кооперативном участке "{0}" в следующем составе:',
    unbranched_accepted: 'Имущество осмотрено и принято мной в следующем составе:',
    request_text: 'Прошу отменить сделку по возврату паевого взноса имуществом в части принятого имущества, принять имущество на склад кооператива и восстановить пайщику {0} паевой взнос в размере {1} {4} и членский взнос в размере {2} {4}, всего {3} {4}.',
    signature: 'Подписано электронной подписью.',
    article: 'Артикул',
    asset_title: 'Наименование/Реквизиты',
    form_of_asset: 'Форма имущества',
    form_of_asset_type: 'Материальная',
    unit_of_measurement: 'Единицы измерения',
    units_accepted: 'Количество принято',
    unit_cost: 'Стоимость Единицы, {0}',
    fact_cost: 'Стоимость имущества (паевой взнос к восстановлению), {0}',
    fee_refund: 'Членский взнос за имущество (к восстановлению), {0}',
    total_refund: 'Всего к восстановлению, {0}',
  },
}

export const exampleData = {
  meta: {
    created_at: '08.09.2026 14:20',
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
    full_name_or_short_name: 'Петров Пётр Петрович',
  },
  orderer: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  request: {
    hash: '0000abcd...',
    title: 'Сахар-песок «Сладкий», 1 кг',
    unit_of_measurement: 'шт.',
    units: '5',
    unit_cost: '85',
    total_cost: '425',
    currency: 'RUB',
  },
  program: {
    name: 'СТОЛ ЗАКАЗОВ',
  },
  branch: {
    short_name: 'КУ-МОСКВА-1',
  },
  fact_cost: '425.0000',
  fee_refund: '42.5000',
  total_refund: '467.5000',
  actual_quantity: '5',
  reason_text: 'При вскрытии упаковки обнаружена пересортица: вместо сахарного песка молоко с истёкшим сроком годности.',
  inspection_result: 'Упаковка вскрыта при пайщике, содержимое не соответствует наименованию, срок годности истёк.',
  order_hash: 'a1b2c3d4...',
  request_hash: 'e5f6a7b8...',
  issue_decision_id: '24',
}
