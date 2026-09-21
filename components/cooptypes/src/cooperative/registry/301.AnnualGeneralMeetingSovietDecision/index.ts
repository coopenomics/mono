import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IMeetExtended, IVars } from '../../model'
import type { IMeetPoint } from '../../../interfaces/meet'

export const registry_id = 301

/**
 * Интерфейс генерации решения совета о созыве общего собрания
 */
export interface Action extends IGenerate {
  decision_id: number
  meet_hash: string
  is_repeated: boolean
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  decision: IDecisionData
  meet: IMeetExtended
  is_repeated: boolean
  questions: IMeetPoint[]
  vars: IVars
}

export const title = 'Решение совета о созыве общего собрания'
export const description = 'Форма протокола собрания совета о созыве очередного/внеочередного общего собрания'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.about {padding: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px; }table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><h1 class="header">{% trans 'protocol_number', decision.id %}</h1><p style="text-align:center" class="subheader">{% trans 'council_meeting_name' %}</p><p style="text-align:center">{{ vars.full_abbr_genitive }} «{{ vars.name }}»</p><p style="text-align: right; padding-top: 20px;"> {{ coop.city }}, {{ meta.created_at }}</p><table class="about"><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr><tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr></tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'council_members' %}</h3><table><tbody>{% for member in coop.members %}<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}{% if member.is_chairman %} ({% trans 'chairman_council_label' %}){% endif %}</td></tr>{% endfor %}</tbody></table><p>{% trans 'quorum_description', decision.voters_percent %}. {% trans 'quorum_available' %}. {% trans 'meeting_legal' %}.</p><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'agenda' %}</h3><p>{% trans 'agenda_item' %}. {% if is_repeated %}{% trans 'repeat_convene_meeting_description' %}{% else %}{% trans 'convene_meeting_description' %}{% endif %} {% if meet.type == 'regular' %}{% trans 'annual_regular' %}{% else %}{% trans 'annual_extra' %}{% endif %} {% if coop.is_branched %}{% trans 'general_meeting_form_branched' %}{% else %}{% trans 'general_meeting_form' %}{% endif %} {{ meet.close_at_datetime }} {% if is_repeated %}{% trans 'and_previous_agenda' %}{% else %}{% trans 'and_agenda_namely' %}{% endif %}:</p><table><tbody><tr><th>№</th><td>{% trans 'agenda_points' %}</td></tr>{% for question in questions %}<tr><th>{{ question.number }}.</th><td>{{ question.title }}</td></tr>{% if question.context %}<tr><th></th><td><em>{{ question.context }}</em></td></tr>{% endif %}{% endfor %}</tbody></table><p><strong>{% trans 'voting_results_label' %}</strong>: {% trans 'votes_for_label' %} – {{ decision.votes_for }}; {% trans 'votes_against_label' %} - {{ decision.votes_against }}; {% trans 'votes_abstained_label' %} - {{ decision.votes_abstained }}.</p><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'decision_made' %}</h3><p>{% if is_repeated %}{% trans 'repeat_convene_meeting_decision' %}{% else %}{% trans 'convene_meeting_decision' %}{% endif %} {% if meet.type == 'regular' %}{% trans 'annual_regular' %}{% else %}{% trans 'annual_extra' %}{% endif %} {% if coop.is_branched %}{% trans 'general_meeting_form_branched' %}{% else %}{% trans 'general_meeting_form' %}{% endif %} {{ meet.close_at_datetime }} {% trans 'with_agenda' %}:</p><table><tbody><tr><th>№</th><td>{% trans 'agenda_points' %}</td></tr>{% for question in questions %}<tr><th>{{ question.number }}.</th><td>{{ question.title }}</td></tr>{% if question.context %}<tr><th></th><td><em>{{ question.context }}</em></td></tr>{% endif %}{% endfor %}</tbody></table><hr><p>{% trans 'closing_time', decision.time %}</p><div class="signature"><p>{% trans 'chairman_council_signature' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_digitally' %}</p></div></div>`

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
    chairman_council_label: 'Председатель Совета',
    quorum_description: 'Кворум составляет {0}% от общего числа членов Совета',
    quorum_available: 'Кворум для решения поставленных на повестку дня вопросов имеется',
    meeting_legal: 'Собрание правомочно',
    agenda: 'Повестка дня',
    agenda_item: '1',
    agenda_points: 'Вопросы повестки дня',
    convene_meeting_description: 'О созыве',
    repeat_convene_meeting_description: 'О повторном созыве',
    annual_regular: 'очередного',
    annual_extra: 'внеочередного',
    general_meeting_form: 'общего собрания пайщиков в заочной форме с датой завершения голосования',
    general_meeting_form_branched: 'общего собрания уполномоченных в заочной форме с датой завершения голосования',
    voting_results_label: 'Голосовали',
    votes_for_label: '«За»',
    votes_against_label: '«Против»',
    votes_abstained_label: '«Воздержался»',
    decision_made: 'Решили',
    convene_meeting_decision: 'Созвать',
    repeat_convene_meeting_decision: 'Созвать повторно',
    with_agenda: 'со следующей повесткой дня',
    and_agenda_namely: 'и его повестки дня, а именно',
    and_previous_agenda: 'и его прежней повестке дня, а именно',
    closing_time: 'Время закрытия Собрания Совета: {0}',
    chairman_council_signature: 'Председатель Совета',
    signed_digitally: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
    is_branched: false,
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  meta: {
    created_at: '12.02.2024 10:30',
  },
  decision: {
    id: 2,
    date: '03.06.2025',
    time: '17:21',
    votes_for: 1,
    votes_against: 0,
    votes_abstained: 0,
    voters_percent: 100,
  },
  meet: {
    type: 'regular',
    close_at_datetime: '15 марта 2024 10:00 (Мск)',
  },
  questions: [
    {
      number: '1',
      title: 'Отчет Председателя Потребительского Кооператива о проделанной работе за период с 01.01.2023 г. по 31.12.2023 г.',
      context: 'Подробная информация о вопросе...',
    },
    {
      number: '2',
      title: 'Утверждение Заключения Ревизионной Комиссии о ревизии деятельности за период с 01.01.2023 г. по 31.12.2023 г.',
      context: 'Дополнительная информация о ревизии...',
    },
  ],
  vars: {
    full_abbr_genitive: 'Потребительского кооператива',
    name: 'ВОСХОД',
  },
  member: {
    is_chairman: '',
    last_name: '',
    first_name: '',
    middle_name: '',
  },
  is_repeated: false,
}
