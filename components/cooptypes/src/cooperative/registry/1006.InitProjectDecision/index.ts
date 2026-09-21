import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 1006

/**
 * Интерфейс генерации решения совета по инициализации проекта
 */
export interface Action extends IGenerate {
  decision_id: number
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  is_component: boolean
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  coop: ICooperativeData
  meta: IMetaDocument
  decision: IDecisionData
  vars: IVars
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  is_component: boolean
}

export const title = 'Протокол решения совета об инициализации проекта'
export const description = 'Форма протокола решения совета об инициализации проекта или компонента'
export const context = '<style> \nh1 {\nmargin: 0px; \ntext-align:center;\n}\nh3{\nmargin: 0px;\npadding-top: 15px;\n}\n.about {\npadding: 20px;\n}\n.about p{\nmargin: 0px;\n}\n.signature {\npadding-top: 20px;\n}\n.digital-document {\npadding: 20px;\nwhite-space: pre-wrap;\n}\n.subheader {\npadding-bottom: 20px; \n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid #ccc;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word; \n  overflow-wrap: break-word; \n}\nth {\n  background-color: #f4f4f4;\n  width: 30%;\n}\n</style>\n\n<div class="digital-document"><h1 class="header">{% trans \'protocol_number\', decision.id %}</h1>\n<p style="text-align:center" class="subheader">{% trans \'council_meeting_name\' %} {{vars.full_abbr_genitive}} "{{vars.name}}"</p>\n<p style="text-align: right"> {{ meta.created_at }}, {{ coop.city }}</p>\n<table class="about">\n<tbody>\n<tr>\n<th>{% trans \'meeting_format\' %}</th>\n<td>{% trans \'meeting_format_value\' %}</td>\n</tr>\n<tr>\n<th>{% trans \'meeting_place\' %}</th>\n<td>{{ coop.full_address }}</td>\n</tr>\n<tr>\n<th>{% trans \'meeting_date\' %}</th>\n<td>{{ decision.date }}</td>\n</tr>\n<tr>\n<th>{% trans \'opening_time\' %}</th>\n<td>{{ decision.time }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'council_members\' %}</h3>\n<table>\n<tbody>\n{% for member in coop.members %}\n<tr>\n<th>{% if member.is_chairman %}{% trans \'chairman_of_the_council\' %}{% else %}{% trans \'member_of_the_council\' %}{% endif %}</th>\n<td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td>\n</tr>\n{% endfor %}\n</tbody>\n</table>\n<h3>{% trans \'meeting_legality\' %} </h3>\n<p>{% trans \'voting_results\', decision.voters_percent %} {% trans \'quorum\' %} {% trans \'chairman_of_the_meeting\', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p>\n<h3>{% trans \'agenda\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td>{% trans \'question\' %}</td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% if is_component %}{% trans \'init_component_question\', component_name, component_hash, project_name, project_hash %}{% else %}{% trans \'init_project_question\', project_name, project_hash %}{% endif %}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'voting\' %}</h3>\n<p>{% trans \'vote_results\' %} </p><table>\n<tbody>\n<tr>\n<th>{% trans \'votes_for\' %}</th>\n<td>{{ decision.votes_for }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_against\' %}</th>\n<td>{{ decision.votes_against }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_abstained\' %}</th>\n<td>{{ decision.votes_abstained }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'decision_made\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td>{% trans \'decision\' %}</td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% if is_component %}{% trans \'init_component_decision\', component_name, component_hash, project_name, project_hash %}{% else %}{% trans \'init_project_decision\', project_name, project_hash %}{% endif %}</td>\n</tr>\n</tbody>\n</table>\n<hr>\n<p>{% trans \'closing_time\', decision.time %}</p>\n<div class="signature"><p>{% trans \'signature\' %}</p><p>{% trans \'chairman\' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div></div>\n'

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
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    decision_made: 'РЕШИЛИ',
    closing_time: 'Время закрытия собрания совета: {0}.',
    protocol_number: 'ПРОТОКОЛ № {0}',
    council_meeting_name: 'Собрания Совета',
    chairman_of_the_council: 'Председатель совета',
    signature: 'Документ подписан электронной подписью.',
    chairman: 'Председатель',
    quorum: 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    voting: 'ГОЛОСОВАНИЕ',
    meeting_format_value: 'Заочная',
    member_of_the_council: 'Член совета',
    question: 'Вопрос',
    votes_for: 'ЗА',
    votes_against: 'ПРОТИВ',
    votes_abstained: 'ВОЗДЕРЖАЛСЯ',
    decision: 'Решение',
    init_component_question: 'Об инициализации компонента "{0}" (№{1}) как составной части проекта "{2}" (№{3})',
    init_project_question: 'Об инициализации проекта "{0}" (№{1})',
    init_component_decision: 'Инициализировать компонент "{0}" (№{1}) как составную часть проекта "{2}" (№{3})',
    init_project_decision: 'Инициализировать проект "{0}" (№{1})',
  },
  // ... другие переводы
}

export const exampleData = {
  meta: {
    created_at: '12.02.2024 00:01',
  },
  project_name: 'Проект цифровой платформы',
  project_hash: 'B2C3D4E5F6789ABC',
  component_name: 'Компонент разработки',
  component_hash: 'A1B2C3D4E5F6789A',
  is_component: true,
  coop: {
    city: 'Москва',
    full_address: 'Смольная 3-84',
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
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
  vars: {
    full_abbr_genitive: 'потребительского кооператива',
    name: 'ВОСХОД',
  },
}
