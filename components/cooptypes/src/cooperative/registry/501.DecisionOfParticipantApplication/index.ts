import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '../../users'

export const registry_id = 501

/**
 * Интерфейс генерации решения совета
 */
export interface Action extends IGenerate {
  decision_id: number
}

// Модель данных
export interface Model {
  type: string

  individual?: IIndividualData
  organization?: IOrganizationData
  entrepreneur?: IEntrepreneurData
  coop: ICooperativeData
  meta: IMetaDocument
  decision: IDecisionData
  vars: IVars
}

export const title = 'Решение совета о приёме пайщика в кооператив'
export const description = 'Форма решения совета о приёме пайщика в потребительский кооператив'
export const context = '<style> \nh1 {\nmargin: 0px; \ntext-align:center;\n}\nh3{\nmargin: 0px;\npadding-top: 15px;\n}\n.about {\npadding: 20px;\n}\n.digital-document {\npadding: 20px;\nwhite-space: pre-wrap;\n}\n.subheader {\npadding-bottom: 20px; \n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid #ccc;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word; \n  overflow-wrap: break-word; \n}\nth {\n  background-color: #f4f4f4;\n  width: 30%;\n}\n</style>\n\n<div class="digital-document">\n  <h1 class="header">{% trans \'protocol_number\', decision.id %}</h1>\n  <p style="text-align:center" class="subheader">{% trans \'council_meeting_name\' %} {{vars.full_abbr_genitive}} "{{vars.name}}"</p>\n  <p style="text-align: right"> {{ meta.created_at }}, {{ coop.city }}</p>\n  <table class="about">\n    <tbody>\n      <tr>\n        <th>{% trans \'meeting_format\' %}</th>\n        <td>{% trans \'meeting_format_value\' %}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'meeting_place\' %}</th>\n        <td>{{ coop.full_address }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'meeting_date\' %}</th>\n        <td>{{ decision.date }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'opening_time\' %}</th>\n        <td>{{ decision.time }}</td>\n      </tr>\n    </tbody>\n  </table>\n  <h3>{% trans \'council_members\' %}</h3>\n  <table>\n    <tbody>\n      {% for member in coop.members %}\n      <tr>\n  <th>{% if member.is_chairman %}{% trans \'chairman_of_the_council\' %}{% else %}{% trans \'member_of_the_council\' %}{% endif %}</th>\n  <td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td>\n</tr>\n      {% endfor %}\n    </tbody>\n  </table>\n  <h3>{% trans \'meeting_legality\' %}</h3>\n  <p>{% trans \'voting_results\', decision.voters_percent %} {% trans \'quorum\' %} {% trans \'chairman_of_the_meeting\', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p>\n  <h3>{% trans \'agenda\' %}</h3>\n  <table>\n    <tbody>\n      <tr>\n        <th>№</th>\n        <td>{% trans \'question\' %}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'agenda_item\' %}</th>\n        <td>{% trans \'decision_joincoop1\' %} {% if type == \'individual\' %}{{individual.last_name}} {{individual.first_name}} {{individual.middle.name}} ({{individual.birthdate}} {% trans \'birthdate\' %}){% endif %}{% if type == \'entrepreneur\' %}{% trans \'entrepreneur\' %} {{entrepreneur.last_name}} {{entrepreneur.first_name}} {{entrepreneur.middle.name}} ({% trans \'ogrnip\' %} {{entrepreneur.details.ogrn}}){% endif %}{% if type == \'organization\' %} {{organization.short_name}} ({% trans \'ogrn\' %} {{organization.details.ogrn}}){% endif %}{% trans \'in_participants\' %} {{ coop.short_name }}.\n        </td>\n      </tr>\n    </tbody>\n  </table>\n<h3>{% trans \'voting\' %}</h3>\n<p>{% trans \'vote_results\' %}</p><table>\n    <tbody>\n      <tr>\n        <th>{% trans \'votes_for\' %}</th>\n        <td>{{ decision.votes_for }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'votes_against\' %}</th>\n        <td>{{ decision.votes_against }}</td>\n      </tr>\n      <tr>\n        <th>{% trans \'votes_abstained\' %}</th>\n        <td>{{ decision.votes_abstained }}</td>\n      </tr>\n    </tbody>\n  </table>\n  <h3>{% trans \'decision_made\' %}</h3>\n  <table>\n    <tbody>\n      <tr>\n      <tr>\n        <th>№</th>\n        <td>{% trans \'question\' %}</td>\n      </tr>\n\n        <th>{% trans \'decision\' %}</th>\n        <td>{% trans \'decision_joincoop2\' %}\n{% if type == \'individual\' %}{{individual.last_name}} {{individual.first_name}} {{individual.middle.name}} {{individual.birthdate}} {% trans \'birthdate\' %} {% endif %}{% if type == \'entrepreneur\' %}{% trans \'entrepreneur\' %} {{entrepreneur.last_name}} {{entrepreneur.first_name}} {{entrepreneur.middle.name}}, {% trans \'ogrnip\' %} {{entrepreneur.details.ogrn}}{% endif %}{% if type == \'organization\' %}{{organization.short_name}}, {% trans \'ogrn\' %} {{organization.details.ogrn}}{% endif %}\n        </td>\n      </tr>\n    </tbody>\n  </table>\n  <hr>\n<p>{% trans \'closing_time\', decision.time %}</p>\n<div class="signature"><p>{% trans \'signature\' %}</p><p>{% trans \'chairman\' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div>\n</div>\n'

export const translations = {
  ru: {
    meeting_format: 'Форма',
    meeting_date: 'Дата',
    meeting_place: 'Место',
    opening_time: 'Время открытия',
    council_members: 'ЧЛЕНЫ СОВЕТА',
    voting_results: 'Количество голосов составляет {0}% от общего числа членов Совета.',
    meeting_legality: 'СОБРАНИЕ ПРАВОМОЧНО',
    chairman_of_the_meeting: 'Председатель собрания совета: {0} {1} {2}',
    agenda: 'ПОВЕСТКА ДНЯ',
    decision_made: 'РЕШИЛИ',
    closing_time: 'Время закрытия собрания совета: {0}.',
    protocol_number: 'ПРОТОКОЛ № {0}',
    council_meeting_name: 'Собрания Совета',
    chairman_of_the_council: 'Председатель совета',
    signature: 'Документ подписан электронной подписью.',
    chairman: 'Председатель',
    birthdate: 'г.р.',
    ogrnip: 'ОГРНИП',
    entrepreneur: 'ИП',
    ogrn: 'ОГРН',
    quorum: 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    voting: 'ГОЛОСОВАНИЕ',
    in_participants: ' о приёме в пайщики',
    decision_joincoop1: 'Рассмотреть заявление',
    decision_joincoop2: 'Принять нового пайщика',
    meeting_format_value: 'заочная',
    agenda_item: '1',
    votes_for: 'ЗА',
    votes_against: 'ПРОТИВ',
    votes_abstained: 'ВОЗДЕРЖАЛСЯ',
    decision: '1',
    question: 'Вопрос',
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    member_of_the_council: 'Член совета',
  },
  // ... другие переводы
}

export const exampleData = {
  meta: {
    created_at: '12.02.2024 00:01',
  },
  coop: {
    city: 'Москва',
    full_address: 'Смольная 3-84',
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
    short_name: 'ПК "Восход"',
  },
  decision: {
    time: '00:01',
    date: '12.02.2024',
    votes_for: '3',
    votes_against: '0',
    votes_abstained: '0',
    voters_percent: '100',
    id: '1',
  },
  member: {
    is_chairman: true,
    last_name: 'Муравьев',
    first_name: 'Алексей',
    middle_name: 'Николаевич',
  },
  organization: {
    details: {
      ogrn: '2222222222',
    },
    short_name: 'ООО "Ромашка"',
  },
  type: 'organization',
  individual: {
    last_name: 'Мартин',
    first_name: 'Роберт',
    middle: {
      name: 'Иванович',
    },
    birthdate: '04.04.2000',
  },
  entrepreneur: {
    last_name: 'Мартин',
    first_name: 'Роберт',
    middle: {
      name: 'Иванович',
    },
    details: {
      ogrn: '11111111111',
    },
  },
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
