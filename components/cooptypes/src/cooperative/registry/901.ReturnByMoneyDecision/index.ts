import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 901

/**
 * Интерфейс генерации решения совета по возврату паевого взноса
 */
export interface Action extends IGenerate {
  decision_id: number
  payment_hash: string // Хэш платежа
  quantity: string
  currency: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  decision: IDecisionData
  user: ICommonUser
  quantity: string
  currency: string
  vars: IVars
}

export const title = 'Решение совета о возврате паевого взноса'
export const description = 'Форма решения совета о возврате паевого взноса денежными средствами'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;}.about {padding: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px; }table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30%;}</style><div class="digital-document"><h1 class="header">{% trans 'protocol_number', decision.id %}</h1><p style="text-align:center" class="subheader">{% trans 'council_meeting_name' %} {{vars.full_abbr_genitive}} "{{vars.name}}"</p><p style="text-align: right; padding-bottom: 20px;"> {{ meta.created_at }}, {{ coop.city }}</p><table class="about" style="margin-bottom: 20px;"><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'meeting_place' %}</th><td>{{ coop.full_address }}</td></tr><tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr><tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr></tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'council_members' %}</h3><table style="margin-bottom: 20px;"><tbody>{% for member in coop.members %}<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td></tr>{% endfor %}</tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'meeting_legality' %}</h3><p style="padding-bottom: 20px;">{% trans 'voting_results', decision.voters_percent %} {% trans 'quorum' %} {% trans 'chairman_of_the_meeting', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'agenda' %}</h3><p style="padding-bottom: 20px;">{% trans 'return_application_consideration', user.full_name_or_short_name, quantity, currency %}</p><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'voting' %}</h3><p style="padding-bottom: 20px;">{% trans 'vote_results' %} {% trans 'votes_for_label' %} – {{ decision.votes_for }}; {% trans 'votes_against_label' %} - {{ decision.votes_against }}; {% trans 'votes_abstained_label' %} - {{ decision.votes_abstained }}.</p><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'decision_made' %}</h3><p style="padding-bottom: 20px;">{% trans 'return_decision_text', quantity, currency %}</p><hr><p style="padding-top: 20px;">{% trans 'closing_time', decision.time %}</p><div class="signature" style="padding-top: 20px;"><p>{% trans 'signature' %}</p><p>{% trans 'chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div></div>`

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
    quorum: 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    voting: 'ГОЛОСОВАНИЕ',
    meeting_format_value: 'заочная',
    member_of_the_council: 'Член совета',
    return_application_consideration: 'Рассмотрение заявления на частичный возврат паевого взноса пайщика {0}. Стоимость права требования в качестве возврата паевового взноса в соответствии с условиями ЦПП "ЦИФРОВОЙ КОШЕЛЕК": {1} {2}.',
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    votes_for_label: '«За»',
    votes_against_label: '«Против»',
    votes_abstained_label: '«Воздержался»',
    return_decision_text: 'Вернуть паевой взнос пайщика денежными средствами в соответствии с соглашением новации и согласно ст. 414 ГК РФ по реквизитам, указанным в заявлении.',
  },
}

export const exampleData = {
  meta: {
    created_at: '18.03.2025 14:30',
  },
  coop: {
    city: 'Москва',
    full_address: 'г. Москва, ул. Центральная, д. 1',
    chairman: {
      last_name: 'Петров',
      first_name: 'Петр',
      middle_name: 'Петрович',
    },
  },
  decision: {
    time: '14:30',
    date: '18.03.2025',
    votes_for: '5',
    votes_against: '0',
    votes_abstained: '1',
    voters_percent: '100',
    id: '5',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
  member: {
    is_chairman: '',
    last_name: '',
    first_name: '',
    middle_name: '',
  },
  quantity: '1000',
  currency: 'RUB',
}
