import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonRequest, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1114

/**
 * Протокол решения совета о возврате паевого взноса имуществом — выдача
 * заказа в паевой модели ЦПП «Стол заказов» (компонент 68).
 *
 * Документ-решение совета по Заявлению 1113. Подписывается председателем
 * совета по типовому процессу решений совета (`soviet::authorize`) — обычно
 * роботом решений совета по делегированным разрешениям. `soviet::exec`
 * вызывает `marketplace::onmktisauth(coopname, hash, authorization)` с этим
 * протоколом; далее заказчик подписывает акт 1115.
 *
 * Текст — 1-к-1 с 801.ReturnByAssetDecision (юридически выверенный), с
 * указанием целевой потребительской программы.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** ID решения в soviet.decisions. */
  decision_id: number
  /** Канонический order_hash on-chain. */
  order_hash: string
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
  program: ICommonProgram
}

export const title = 'Протокол решения совета о возврате паевого взноса имуществом'
export const description = 'Форма протокола решения совета о возврате паевого взноса имуществом по ЦПП «Стол заказов»'
export const context = '<style> \nh1 {\nmargin: 0px; \ntext-align:center;\n}\nh3{\nmargin: 0px;\npadding-top: 15px;\n}\n.about {\npadding: 20px;\n}\n.about p{\nmargin: 0px;\n}\n.signature {\npadding-top: 20px;\n}\n.digital-document {\npadding: 20px;\nwhite-space: pre-wrap;\n}\n.subheader {\npadding-bottom: 20px; \n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid currentColor;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word; \n  overflow-wrap: break-word; \n}\nth {\n  width: 30%;\n}\n</style>\n\n<div class="digital-document"><h1 class="header">{% trans \'protocol_number\', decision.id %}</h1>\n<p style="text-align:center" class="subheader">{% trans \'council_meeting_name\' %} {{vars.full_abbr_genitive}} "{{vars.name}}"</p>\n<p style="text-align: right"> {{ meta.created_at }}, {{ coop.city }}</p>\n<table class="about">\n<tbody>\n<tr>\n  <th>{% trans \'meeting_format\' %}</th>\n  <td>{% trans \'meeting_format_value\' %}</td>\n</tr>\n<tr>\n  <th>{% trans \'meeting_place\' %}</th>\n  <td>{{ coop.full_address }}</td>\n</tr>\n<tr>\n  <th>{% trans \'meeting_date\' %}</th>\n  <td>{{ decision.date }}</td>\n</tr>\n<tr>\n  <th>{% trans \'opening_time\' %}</th>\n  <td>{{ decision.time }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'council_members\' %}</h3>\n<table>\n<tbody>\n{% for member in coop.members %}\n<tr>\n<th>{% if member.is_chairman %}{% trans \'chairman_of_the_council\' %}{% else %}{% trans \'member_of_the_council\' %}{% endif %}</th>\n<td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td>\n</tr>\n{% endfor %}\n</tbody>\n</table>\n<h3>{% trans \'meeting_legality\' %} </h3>\n<p>{% trans \'voting_results\', decision.voters_percent %} {% trans \'quorum\' %} {% trans \'chairman_of_the_meeting\', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p>\n<h3>{% trans \'agenda\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td></td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% trans \'question_number_one\', program.name %}\n\n<table>\n<tbody>\n<tr>\n  <th>{% trans \'full_name\' %}</th>\n  <td>{{ user.full_name_or_short_name }}</td>\n</tr>\n\n<tr>\n  <th>{% trans \'user.birthdate_or_ogrn\' %}</th>\n  <td>{{ user.birthdate_or_ogrn }}</td>\n</tr>\n\n<tr>\n  <th>{% trans \'article\' %}</th>\n  <td>{{request.hash}}</td>\n</tr>\n<tr>\n  <th>{% trans \'asset_title\' %}</th>\n  <td>{{request.title}}</td>\n</tr>\n<tr>\n  <th>{% trans \'form_of_asset\' %}</th>\n  <td>{% trans \'form_of_asset_type\' %}</td>\n</tr>\n<tr>\n  <th>{% trans \'unit_of_measurement\' %}</th>\n  <td>{{ request.unit_of_measurement}}</td>\n</tr>\n<tr>\n  <th>{% trans \'units\' %} </th>\n  <td>{{ request.units }}</td>\n</tr>\n<tr>\n  <th>{% trans \'unit_cost\', request.currency %}</th>\n  <td>{{ request.unit_cost }}</td>\n</tr>\n<tr>\n  <th>{% trans \'total_cost\', request.currency %}</th>\n  <td>{{ request.total_cost }}</td>\n</tr>\n</tbody>\n</table>\n</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'voting\' %}</h3>\n<p>{% trans \'vote_results\' %} </p><table>\n<tbody>\n<tr>\n<th>{% trans \'votes_for\' %}</th>\n<td>{{ decision.votes_for }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_against\' %}</th>\n<td>{{ decision.votes_against }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_abstained\' %}</th>\n<td>{{ decision.votes_abstained }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'decision_made\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td></td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% trans \'decision_number_one\', user.full_name_or_short_name %}</td>\n</tr>\n</tbody>\n</table>\n<hr>\n<p>{% trans \'closing_time\', decision.time %}</p>\n<div class="signature"><p>{% trans \'signature\' %}</p><p>{% trans \'chairman\' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div></div>'

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
    'question_number_one': 'Возвратить паевой взнос пайщику Кооператива имуществом согласно поданного заявления по условиям Целевой Потребительской Программы "{0}", а именно:',
    'full_name': 'ФИО/ИП/Полное наименование юр./лица',
    'user.birthdate_or_ogrn': 'Дата рождения/ОГРНИП/ОГРН',
    'unit_of_measurement': 'Единицы измерения',
    'article': 'Артикул',
    'asset_title': 'Наименование / реквизиты',
    'form_of_asset': 'Форма имущества',
    'units': 'Количество',
    'unit_cost': 'Стоимость Единицы, {0}',
    'total_cost': 'Стоимость Всего, {0}',
    'form_of_asset_type': 'Материальная',
    'decision_number_one': 'Возвратить паевой взнос пайщику {0} указанным в заявлении имуществом по акту приёма-передачи.',
  },
}

export const exampleData = {
  meta: {
    created_at: '06.09.2026 12:14',
  },
  coop: {
    city: 'Москва',
    full_address: 'г. Москва, ул. Пушкина, д. 1',
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
    id: 24,
    date: '06.09.2026',
    time: '12:14',
    votes_for: 2,
    votes_against: 0,
    votes_abstained: 0,
    voters_percent: 100,
  },
}
