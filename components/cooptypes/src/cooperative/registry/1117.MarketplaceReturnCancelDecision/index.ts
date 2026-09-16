import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonRequest, ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IOrganizationData } from '../../users'

export const registry_id = 1117

/**
 * Протокол решения совета об отмене сделки по гарантийному возврату имущества
 * и восстановлении взносов пайщика — паевая модель ЦПП «Стол заказов»
 * (компонент 68, задача 99D-12).
 *
 * Документ-решение совета по Заявлению оператора кооперативного участка об
 * отмене сделки (1116). Совет не разбирает случай заново: оператор принял
 * имущество под свою материальную ответственность, совет легитимизирует его
 * решение. Подписывается председателем совета по типовому процессу решений
 * совета — обычно роботом решений совета. `soviet::exec` вызывает
 * `marketplace::onmktrtauth(coopname, hash, authorization)` с этим протоколом:
 * контракт проводит обратные операции — имущество на склад участка и паевой
 * взнос на свободный паевой «Стола заказов», членский взнос за возвращённое
 * обратно на членский кошелёк пайщика.
 *
 * `username` документа — пайщик (автор повестки); оператор указан полем
 * `operator`. Деловые поля совпадают с заявлением 1116: робот переносит их из
 * метаданных заявления повестки.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** ID решения в soviet.decisions. */
  decision_id: number
  /** id заказа, сделка по которому отменяется. */
  order_id: string
  /** Канонический order_hash отменяемой сделки. */
  order_hash: string
  /** Хэш рекламации пайщика (return_request.hash). */
  request_hash: string
  /** Кооперативный участок, на котором принято имущество (braname). */
  braname: string
  /** Пайщик-заказчик (username). */
  orderer: string
  /** Оператор участка, принявший имущество и подавший заявление (username). */
  operator: string
  /** Номер протокола совета о выдаче имущества по заказу; 0 — без протокола. */
  issue_decision_id: number
  /** Артикул (СКУ) товара по заказу. */
  sku: string
  /** Наименование товара по заказу. */
  product_title: string
  /** Человекочитаемая единица измерения. */
  unit_of_measurement: string
  /** Принятое количество единиц. */
  actual_quantity: number
  /** Цена за единицу. */
  unit_cost: string
  /** Стоимость принятого имущества — паевой взнос к восстановлению. */
  fact_cost: string
  /** Членский взнос за принятое имущество — к восстановлению. */
  fee_refund: string
  /** Всего к восстановлению. */
  total_refund: string
  /** Символ валюты. */
  currency: string
  /** Причина обращения пайщика из рекламации. */
  reason_text: string
  /** Результат осмотра имущества оператором. */
  inspection_result: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  /** Пайщик, чья сделка отменяется. */
  user: ICommonUser
  /** Оператор участка — автор заявления. */
  operator: ICommonUser
  request: ICommonRequest
  decision: IDecisionData
  program: ICommonProgram
  branch?: IOrganizationData
  fact_cost: string
  fee_refund: string
  total_refund: string
  reason_text: string
  inspection_result: string
  order_hash: string
  request_hash: string
  /** Номер протокола совета о выдаче; пустая строка — без протокола. */
  issue_decision_id: string
}

export const title = 'Протокол решения совета об отмене сделки по гарантийному возврату имущества'
export const description = 'Форма протокола решения совета об отмене сделки по возврату паевого взноса имуществом при гарантийном возврате по ЦПП «Стол заказов» и восстановлении паевого и членского взносов пайщика'
export const context = '<style> \nh1 {\nmargin: 0px; \ntext-align:center;\n}\nh3{\nmargin: 0px;\npadding-top: 15px;\n}\n.about {\npadding: 20px;\n}\n.about p{\nmargin: 0px;\n}\n.signature {\npadding-top: 20px;\n}\n.digital-document {\npadding: 20px;\nwhite-space: pre-wrap;\n}\n.subheader {\npadding-bottom: 20px; \n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid currentColor;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word; \n  overflow-wrap: break-word; \n}\nth {\n  width: 30%;\n}\n</style>\n\n<div class="digital-document"><h1 class="header">{% trans \'protocol_number\', decision.id %}</h1>\n<p style="text-align:center" class="subheader">{% trans \'council_meeting_name\' %} {{vars.full_abbr_genitive}} "{{vars.name}}"</p>\n<p style="text-align: right"> {{ meta.created_at }}, {{ coop.city }}</p>\n<table class="about">\n<tbody>\n<tr>\n  <th>{% trans \'meeting_format\' %}</th>\n  <td>{% trans \'meeting_format_value\' %}</td>\n</tr>\n<tr>\n  <th>{% trans \'meeting_place\' %}</th>\n  <td>{{ coop.full_address }}</td>\n</tr>\n<tr>\n  <th>{% trans \'meeting_date\' %}</th>\n  <td>{{ decision.date }}</td>\n</tr>\n<tr>\n  <th>{% trans \'opening_time\' %}</th>\n  <td>{{ decision.time }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'council_members\' %}</h3>\n<table>\n<tbody>\n{% for member in coop.members %}\n<tr>\n<th>{% if member.is_chairman %}{% trans \'chairman_of_the_council\' %}{% else %}{% trans \'member_of_the_council\' %}{% endif %}</th>\n<td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td>\n</tr>\n{% endfor %}\n</tbody>\n</table>\n<h3>{% trans \'meeting_legality\' %} </h3>\n<p>{% trans \'voting_results\', decision.voters_percent %} {% trans \'quorum\' %} {% trans \'chairman_of_the_meeting\', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p>\n<h3>{% trans \'agenda\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td></td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% if coop.is_branched %}{% trans \'question_branched\', user.full_name_or_short_name, program.name, order_hash, branch.short_name, operator.full_name_or_short_name, request_hash %}{% else %}{% trans \'question_unbranched\', user.full_name_or_short_name, program.name, order_hash, operator.full_name_or_short_name, request_hash %}{% endif %}{% if issue_decision_id %} {% trans \'issue_decision\', issue_decision_id %}{% endif %}\n\n<table>\n<tbody>\n<tr>\n  <th>{% trans \'full_name\' %}</th>\n  <td>{{ user.full_name_or_short_name }}</td>\n</tr>\n\n<tr>\n  <th>{% trans \'user.birthdate_or_ogrn\' %}</th>\n  <td>{{ user.birthdate_or_ogrn }}</td>\n</tr>\n\n<tr>\n  <th>{% trans \'article\' %}</th>\n  <td>{{request.hash}}</td>\n</tr>\n<tr>\n  <th>{% trans \'asset_title\' %}</th>\n  <td>{{request.title}}</td>\n</tr>\n<tr>\n  <th>{% trans \'form_of_asset\' %}</th>\n  <td>{% trans \'form_of_asset_type\' %}</td>\n</tr>\n<tr>\n  <th>{% trans \'unit_of_measurement\' %}</th>\n  <td>{{ request.unit_of_measurement}}</td>\n</tr>\n<tr>\n  <th>{% trans \'units\' %} </th>\n  <td>{{ request.units }}</td>\n</tr>\n<tr>\n  <th>{% trans \'unit_cost\', request.currency %}</th>\n  <td>{{ request.unit_cost }}</td>\n</tr>\n<tr>\n  <th>{% trans \'fact_cost\', request.currency %}</th>\n  <td>{{ fact_cost }}</td>\n</tr>\n<tr>\n  <th>{% trans \'fee_refund\', request.currency %}</th>\n  <td>{{ fee_refund }}</td>\n</tr>\n<tr>\n  <th>{% trans \'total_refund\', request.currency %}</th>\n  <td>{{ total_refund }}</td>\n</tr>\n</tbody>\n</table>\n<p>{% trans \'reason_label\' %} {{ reason_text }}</p>\n<p>{% trans \'inspection_label\' %} {{ inspection_result }}</p>\n</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'voting\' %}</h3>\n<p>{% trans \'vote_results\' %} </p><table>\n<tbody>\n<tr>\n<th>{% trans \'votes_for\' %}</th>\n<td>{{ decision.votes_for }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_against\' %}</th>\n<td>{{ decision.votes_against }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_abstained\' %}</th>\n<td>{{ decision.votes_abstained }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'decision_made\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td></td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% trans \'decision_number_one\', user.full_name_or_short_name, order_hash, fact_cost, fee_refund, request.currency %}</td>\n</tr>\n</tbody>\n</table>\n<hr>\n<p>{% trans \'closing_time\', decision.time %}</p>\n<div class="signature"><p>{% trans \'signature\' %}</p><p>{% trans \'chairman\' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div></div>'

export const translations = {
  ru: {
    'meeting_format': 'Форма',
    'meeting_date': 'Дата',
    'meeting_place': 'Место',
    'opening_time': 'Время открытия',
    'council_members': 'ЧЛЕНЫ СОВЕТА',
    'voting_results': 'Количество голосов составляет {0}% от общего числа членов Совета.',
    'meeting_legality': 'СОБРАНИЕ ПРАВОМОЧНО',
    'chairman_of_the_meeting': 'Председатель собрания совета: {0} {1} {2}',
    'agenda': 'ПОВЕСТКА ДНЯ',
    'vote_results': 'По первому вопросу повестки дня проголосовали:',
    'decision_made': 'РЕШИЛИ',
    'closing_time': 'Время закрытия собрания совета: {0}.',
    'protocol_number': 'ПРОТОКОЛ № {0}',
    'council_meeting_name': 'Собрания Совета',
    'chairman_of_the_council': 'Председатель совета',
    'signature': 'Документ подписан электронной подписью.',
    'chairman': 'Председатель',
    'quorum': 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    'voting': 'ГОЛОСОВАНИЕ',
    'meeting_format_value': 'Заочная',
    'member_of_the_council': 'Член совета',
    'votes_for': 'ЗА',
    'votes_against': 'ПРОТИВ',
    'votes_abstained': 'ВОЗДЕРЖАЛСЯ',
    'question_branched': 'Об отмене сделки по возврату паевого взноса имуществом пайщику {0} по Целевой Потребительской Программе "{1}" (заказ {2}) в связи с гарантийным возвратом имущества — по заявлению оператора кооперативного участка "{3}" {4}, принявшего имущество по заявлению пайщика о гарантийном возврате {5}, а именно:',
    'question_unbranched': 'Об отмене сделки по возврату паевого взноса имуществом пайщику {0} по Целевой Потребительской Программе "{1}" (заказ {2}) в связи с гарантийным возвратом имущества — по заявлению уполномоченного лица {3}, принявшего имущество по заявлению пайщика о гарантийном возврате {4}, а именно:',
    'issue_decision': 'Сделка совершена по протоколу решения совета № {0}.',
    'reason_label': 'Причина обращения пайщика:',
    'inspection_label': 'Результат осмотра имущества:',
    'full_name': 'ФИО/ИП/Полное наименование юр./лица',
    'user.birthdate_or_ogrn': 'Дата рождения/ОГРНИП/ОГРН',
    'unit_of_measurement': 'Единицы измерения',
    'article': 'Артикул',
    'asset_title': 'Наименование / реквизиты',
    'form_of_asset': 'Форма имущества',
    'units': 'Количество принято',
    'unit_cost': 'Стоимость Единицы, {0}',
    'fact_cost': 'Стоимость имущества (паевой взнос к восстановлению), {0}',
    'fee_refund': 'Членский взнос за имущество (к восстановлению), {0}',
    'total_refund': 'Всего к восстановлению, {0}',
    'form_of_asset_type': 'Материальная',
    'decision_number_one': 'Отменить сделку по возврату паевого взноса имуществом пайщику {0} (заказ {1}) в части принятого на кооперативном участке имущества, принять имущество на склад кооператива и восстановить пайщику паевой взнос в размере {2} {4} и членский взнос в размере {3} {4}.',
  },
}

export const exampleData = {
  meta: {
    created_at: '08.09.2026 14:21',
  },
  coop: {
    city: 'Москва',
    full_address: 'г. Москва, ул. Пушкина, д. 1',
    is_branched: true,
    chairman: { last_name: 'Иванов', first_name: 'Иван', middle_name: 'Иванович' },
    members: [
      { is_chairman: true, last_name: 'Иванов', first_name: 'Иван', middle_name: 'Иванович' },
      { is_chairman: false, last_name: 'Петров', first_name: 'Пётр', middle_name: 'Петрович' },
    ],
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: {
    full_name_or_short_name: 'Сидоров Сидор Сидорович',
    birthdate_or_ogrn: '01.01.1990',
  },
  operator: {
    full_name_or_short_name: 'Петров Пётр Петрович',
  },
  branch: {
    short_name: 'КУ-МОСКВА-1',
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
  program: {
    name: 'Стол заказов',
  },
  decision: {
    id: 25,
    date: '08.09.2026',
    time: '14:21',
    votes_for: 2,
    votes_against: 0,
    votes_abstained: 0,
    voters_percent: 100,
  },
  fact_cost: '1000.0000',
  fee_refund: '100.0000',
  total_refund: '1100.0000',
  reason_text: 'Молоко скисло до истечения срока годности.',
  inspection_result: 'Упаковка вздута, при вскрытии продукт скис.',
  order_hash: 'a1b2c3d4...',
  request_hash: 'e5f6a7b8...',
  issue_decision_id: '24',
}
