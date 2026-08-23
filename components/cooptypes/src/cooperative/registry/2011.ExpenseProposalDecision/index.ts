import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import type { IExpenseItem, IExpenseProposalHeader } from '../2010.ExpenseProposalStatement'

export const registry_id = 2011

export type ExpenseProposalDecisionKind = 'approve' | 'decline'

/** Резолюция совета по СЗ: утвердить / отказать (+ причина отказа). */
export interface IExpenseProposalDecisionBody {
  kind: ExpenseProposalDecisionKind
  reason?: string
}

export interface Action extends IGenerate {
  proposal_hash: string
  /** Идентификатор решения совета (повестка) — источник данных голосования */
  decision_id: number
  proposal: IExpenseProposalHeader
  items: IExpenseItem[]
  resolution: IExpenseProposalDecisionBody
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  /** Данные собрания совета (кворум, голоса) — канон протоколов решений */
  decision: IDecisionData
  proposal_hash: string
  /** Короткий идентификатор СЗ (первые 16 символов хэша, uppercase) */
  proposal_short_hash: string
  proposal: IExpenseProposalHeader
  items: IExpenseItem[]
  resolution: IExpenseProposalDecisionBody
}

export const title = 'Протокол решения совета о расходах'
export const description = 'Протокол собрания совета по служебной записке-смете о расходах. Структура — канон протоколов решений совета (кворум, голоса, повестка); меняется только содержание вопроса и принятого решения.'

// Вёрстка — точная копия канона протоколов решений совета (600.FreeDecision):
// форма/место/дата/время, члены совета, правомочность, повестка, голосование,
// РЕШИЛИ, подпись председателя. Отличается только содержание вопроса повестки
// и принятого решения (смета расходов по СЗ).
export const context = '<style> \nh1 {\nmargin: 0px; \ntext-align:center;\n}\nh3{\nmargin: 0px;\npadding-top: 15px;\n}\n.about {\npadding: 20px;\n}\n.about p{\nmargin: 0px;\n}\n.signature {\npadding-top: 20px;\n}\n.digital-document {\npadding: 20px;\nwhite-space: pre-wrap;\n}\n.subheader {\npadding-bottom: 20px; \n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\nth, td {\n  border: 1px solid #ccc;\n  padding: 8px;\n  text-align: left;\n  word-wrap: break-word; \n  overflow-wrap: break-word; \n}\nth {\n  background-color: #f4f4f4;\n  width: 30%;\n}\n</style>\n\n<div class="digital-document"><h1 class="header">{% trans \'protocol_number\', decision.id %}</h1>\n<p style="text-align:center" class="subheader">{% trans \'council_meeting_name\' %} {{vars.full_abbr_genitive}} "{{vars.name}}"</p>\n<p style="text-align: right"> {{ meta.created_at }}, {{ coop.city }}</p>\n<table class="about">\n<tbody>\n<tr>\n<th>{% trans \'meeting_format\' %}</th>\n<td>{% trans \'meeting_format_value\' %}</td>\n</tr>\n<tr>\n<th>{% trans \'meeting_place\' %}</th>\n<td>{{ coop.full_address }}</td>\n</tr>\n<tr>\n<th>{% trans \'meeting_date\' %}</th>\n<td>{{ decision.date }}</td>\n</tr>\n<tr>\n<th>{% trans \'opening_time\' %}</th>\n<td>{{ decision.time }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'council_members\' %}</h3>\n<table>\n<tbody>\n{% for member in coop.members %}\n<tr>\n<th>{% if member.is_chairman %}{% trans \'chairman_of_the_council\' %}{% else %}{% trans \'member_of_the_council\' %}{% endif %}</th>\n<td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td>\n</tr>\n{% endfor %}\n</tbody>\n</table>\n<h3>{% trans \'meeting_legality\' %} </h3>\n<p>{% trans \'voting_results\', decision.voters_percent %} {% trans \'quorum\' %} {% trans \'chairman_of_the_meeting\', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p>\n<h3>{% trans \'agenda\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td>{% trans \'question\' %}</td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% trans \'question_body\', proposal_short_hash, proposal.total_amount %} {% trans \'question_purpose\' %}: {{ proposal.description }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'voting\' %}</h3>\n<p>{% trans \'vote_results\' %} </p><table>\n<tbody>\n<tr>\n<th>{% trans \'votes_for\' %}</th>\n<td>{{ decision.votes_for }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_against\' %}</th>\n<td>{{ decision.votes_against }}</td>\n</tr>\n<tr>\n<th>{% trans \'votes_abstained\' %}</th>\n<td>{{ decision.votes_abstained }}</td>\n</tr>\n</tbody>\n</table>\n<h3>{% trans \'decision_made\' %}</h3>\n<table>\n<tbody>\n<tr>\n<th>№</th>\n<td>{% trans \'decision\' %}</td>\n</tr>\n<tr>\n<th>1</th>\n<td>{% if resolution.kind == \'approve\' %}<p>{% trans \'decision_approve\', proposal_short_hash, proposal.total_amount %}{% if proposal.deadline %} {% trans \'decision_deadline\', proposal.deadline %}{% endif %}{% trans \'decision_namely\' %}:</p>{% for item in items %}<p>{{ item.number }}. {{ item.description }} — {{ item.amount }} ({% if item.mechanics == \'ADVANCE\' %}{% trans \'mech_advance\' %}{% else %}{% trans \'mech_direct\' %}{% endif %})</p>{% endfor %}{% else %}<p>{% trans \'decision_decline\', proposal_short_hash %}{% if resolution.reason %} {% trans \'decline_reason\' %}: {{ resolution.reason }}{% endif %}</p>{% endif %}</td>\n</tr>\n</tbody>\n</table>\n<hr>\n<p>{% trans \'closing_time\', decision.time %}</p>\n<div class="signature"><p>{% trans \'signature\' %}</p><p>{% trans \'chairman\' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div></div>\n'

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
    question_body: 'Рассмотрение служебной записки-сметы о расходах № {0} на общую сумму {1}.',
    question_purpose: 'Цель расходов',
    decision_approve: 'Утвердить расходы по служебной записке № {0} в общей сумме {1}',
    decision_deadline: 'со сроком исполнения до {0}',
    decision_namely: ', а именно',
    mech_advance: 'аванс под отчёт',
    mech_direct: 'оплата по счёту',
    decision_decline: 'Отказать в утверждении расходов по служебной записке № {0}.',
    decline_reason: 'Основание отказа',
  },
}

export const exampleData = {
  meta: {
    created_at: '03.06.2026 11:00',
  },
  coop: {
    city: 'Москва',
    full_address: 'г. Москва, ул. Смольная, д. 3, оф. 84',
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  decision: {
    time: '11:00',
    date: '03.06.2026',
    votes_for: '3',
    votes_against: '0',
    votes_abstained: '0',
    voters_percent: '100',
    id: '15',
  },
  member: {
    is_chairman: true,
    last_name: 'Муравьев',
    first_name: 'Алексей',
    middle_name: 'Николаевич',
  },
  vars: {
    full_abbr_genitive: 'потребительского кооператива',
    name: 'ВОСХОД',
  },
  proposal_hash: '55c470039a8c53ce1b4b6e842fe8063ab3d5b85ba2ba8ab0ae6e30be3ad328b7',
  proposal_short_hash: '55C470039A8C53CE',
  proposal: {
    description: 'Закупка хостинга и бухгалтерских услуг на июнь 2026',
    total_amount: '15000.00 RUB',
    items_count: 2,
    source_wallet: 'w.cap.bla',
    deadline: '30.06.2026',
    fund_name: 'Фонду хозяйственной деятельности',
  },
  items: [
    { number: '1', description: 'Аренда серверов Yandex Cloud', amount: '12000.00 RUB', recipient_type: 'ORG', mechanics: 'DIRECT' },
    { number: '2', description: 'Канцелярия для офиса', amount: '3000.00 RUB', recipient_type: 'SELF', mechanics: 'ADVANCE' },
  ],
  resolution: {
    kind: 'approve',
  },
}
