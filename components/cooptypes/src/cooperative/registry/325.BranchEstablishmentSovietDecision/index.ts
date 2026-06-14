import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 325

/**
 * Интерфейс генерации решения совета об учреждении кооперативного участка
 */
export interface Action extends IGenerate {
  decision_id: number
  branch_name: string
  address: string
  // username избранного председателя участка; ФИО резолвит фабрика через getUser,
  // в meta (→ on-chain) уходит только username
  chairman: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  decision: IDecisionData
  branch_name: string
  address: string
  chairman_full_name: string
  vars: IVars
}

export const title = 'Решение совета об учреждении кооперативного участка'
export const description = 'Форма протокола собрания совета об учреждении кооперативного участка по заявлению председателя собрания пайщиков'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px;}table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word;}th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><h1 class="header">{% trans 'protocol_number', decision.id %}</h1><p style="text-align:center" class="subheader">{% trans 'council_meeting_name' %}</p><p style="text-align:center">{{ vars.full_abbr_genitive }} «{{ vars.name }}»</p><p style="text-align: right; padding-top: 20px;">{{ coop.city }}, {{ meta.created_at }}</p><table><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr><tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr></tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'council_members' %}</h3><table><tbody>{% for member in coop.members %}<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td></tr>{% endfor %}</tbody></table><p>{% trans 'quorum_description', decision.voters_percent %}. {% trans 'quorum_available' %}. {% trans 'meeting_legal' %}.</p><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'agenda' %}</h3><p>{% trans 'agenda_item' %}. {% trans 'agenda_question' %} «{{ branch_name }}».</p><p><strong>{% trans 'voting_results_label' %}</strong>: {% trans 'votes_for_label' %} – {{ decision.votes_for }}; {% trans 'votes_against_label' %} - {{ decision.votes_against }}; {% trans 'votes_abstained_label' %} - {{ decision.votes_abstained }}.</p><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'decision_made' %}</h3><p>{% trans 'establish_decision' %}:</p><table><tbody><tr><th>{% trans 'branch_name_label' %}</th><td>{{ branch_name }}</td></tr><tr><th>{% trans 'branch_address_label' %}</th><td>{{ address }}</td></tr><tr><th>{% trans 'chairman_label' %}</th><td>{{ chairman_full_name }}</td></tr></tbody></table><hr><p>{% trans 'closing_time', decision.time %}</p><div class="signature" style="padding-top: 30px;"><p>{% trans 'chairman_council_signature' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_digitally' %}</p></div></div>`

export const translations = {
  ru: {
    protocol_number: 'Протокол № {0}',
    council_meeting_name: 'Собрания Совета',
    meeting_format: 'Форма проведения Собрания Совета',
    meeting_format_value: 'заочное',
    meeting_date: 'Дата проведения Собрания Совета',
    opening_time: 'Время открытия Собрания Совета',
    council_members: 'Члены Совета',
    chairman_of_the_council: 'Председатель Совета',
    member_of_the_council: 'Член совета',
    quorum_description: 'Кворум составляет {0}% от общего числа членов Совета',
    quorum_available: 'Кворум для решения поставленных на повестку дня вопросов имеется',
    meeting_legal: 'Собрание правомочно',
    agenda: 'Повестка дня',
    agenda_item: '1',
    agenda_question: 'Об учреждении кооперативного участка',
    voting_results_label: 'Голосовали',
    votes_for_label: '«За»',
    votes_against_label: '«Против»',
    votes_abstained_label: '«Воздержался»',
    decision_made: 'Решили',
    establish_decision: 'Учредить кооперативный участок со следующими реквизитами',
    branch_name_label: 'Наименование кооперативного участка',
    branch_address_label: 'Адрес привязки кооперативного участка',
    chairman_label: 'Председатель кооперативного участка',
    closing_time: 'Время закрытия Собрания Совета: {0}',
    chairman_council_signature: 'Председатель Совета',
    signed_digitally: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
  },
  meta: {
    created_at: '15.03.2024 18:30',
  },
  decision: {
    id: 15,
    date: '15.03.2024',
    time: '18:30',
    votes_for: 3,
    votes_against: 0,
    votes_abstained: 0,
    voters_percent: 100,
  },
  branch_name: 'РОМАШКА',
  address: 'г. Красногорск, ул. Ленина, д. 1',
  chairman_full_name: 'Иванов Иван Иванович',
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
