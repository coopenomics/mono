import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 323

/**
 * Вопрос протокола собрания участка с результатами голосования
 */
export interface IBranchProtocolQuestion {
  number: string
  title: string
  context?: string
  decision: string
  counter_votes_for: string
  counter_votes_against: string
  counter_votes_abstained: string
  votes_for_percent: number
  votes_against_percent: number
  votes_abstained_percent: number
  is_accepted: boolean
}

/**
 * Интерфейс генерации протокола решения собрания пайщиков участка.
 * Протокол утверждается единственной подписью председателя собрания.
 * Данные собрания и результаты голосования передаются вместе с данными
 * (источник — проекция решения).
 */
export interface Action extends IGenerate {
  hash: string
  protocol_number: string
  // username председателя собрания; ФИО фабрика резолвит через getUser на момент генерации
  // и не публикует в meta (чувствительные данные на чейн не уходят)
  chairman: string
  open_at_datetime: string
  close_at_datetime: string
  current_quorum_percent: number
  questions: IBranchProtocolQuestion[]
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  protocol_number: string
  chairman_full_name: string
  open_at_datetime: string
  close_at_datetime: string
  current_quorum_percent: number
  questions: IBranchProtocolQuestion[]
  vars: IVars
}

export const title = 'Протокол решения собрания пайщиков'
export const description = 'Форма протокола решения собрания пайщиков потребительского кооператива, утверждаемого председателем собрания'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.digital-document {padding: 20px;white-space: pre-wrap;}table {width: 100%;border-collapse: collapse;margin-bottom: 20px;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><h1 class="header" style="text-align:center;">{% trans 'protocol_number', protocol_number %}</h1><p style="text-align:center" class="subheader">{% trans 'meeting_name' %}</p><p style="text-align:center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right"> {{ coop.city }}, {{ meta.created_at }}</p><table><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'opening_datetime' %}</th><td>{{ open_at_datetime }}</td></tr><tr><th>{% trans 'closing_datetime' %}</th><td>{{ close_at_datetime }}</td></tr></tbody></table><p>{% trans 'quorum_available' %} {% trans 'quorum_percent' %} {{ current_quorum_percent }}% {% trans 'from_total_participants' %}.</p><h3 style="padding-top: 20px; padding-bottom: 10px; text-align: center;">{% trans 'agenda' %}</h3><table><tbody>{% for question in questions %}<tr><th>{{ question.number }}</th><td>{{ question.title }}</td></tr>{% if question.context %}<tr><th></th><td><em>{{ question.context }}</em></td></tr>{% endif %}{% endfor %}</tbody></table>{% for question in questions %}<h3 style="padding-top: 30px; padding-bottom: 10px; text-align: center;">{% trans 'decided_by_question', question.number %}:</h3><p>{{ question.decision }}</p><table><tbody><tr><th>{% trans 'votes_for' %}</th><td>{{ question.counter_votes_for }} ({{ question.votes_for_percent }}%)</td></tr><tr><th>{% trans 'votes_against' %}</th><td>{{ question.counter_votes_against }} ({{ question.votes_against_percent }}%)</td></tr><tr><th>{% trans 'votes_abstained' %}</th><td>{{ question.counter_votes_abstained }} ({{ question.votes_abstained_percent }}%)</td></tr><tr><th>{% trans 'decision_status' %}</th><td>{% if question.is_accepted %}{% trans 'decision_accepted' %}{% else %}{% trans 'decision_rejected' %}{% endif %}</td></tr></tbody></table>{% endfor %}<p style="padding-top: 20px;">{% trans 'closing_time', close_at_datetime %}</p><div class="signature" style="padding-top: 30px;"><p>{% trans 'chairman_meeting_signature' %} {{ chairman_full_name }}</p><p>{% trans 'signed_digitally' %}</p></div></div>`

export const translations = {
  ru: {
    protocol_number: 'Протокол № КУ-{0}',
    meeting_name: 'Собрания пайщиков',
    meeting_format: 'Форма проведения собрания',
    meeting_format_value: 'заочное',
    opening_datetime: 'Дата и время открытия собрания',
    closing_datetime: 'Дата и время закрытия собрания',
    quorum_available: 'Кворум имеется. Собрание правомочно для принятия решений по вопросам повестки дня.',
    quorum_percent: 'Кворум составляет',
    from_total_participants: 'от общего числа участников собрания',
    agenda: 'Повестка дня',
    decided_by_question: 'РЕШИЛИ по {0} вопросу',
    votes_for: '"За"',
    votes_against: '"Против"',
    votes_abstained: '"Воздержался"',
    decision_status: 'Статус решения',
    decision_accepted: 'ПРИНЯТО',
    decision_rejected: 'ОТКЛОНЕНО',
    closing_time: 'Время закрытия собрания: {0}',
    chairman_meeting_signature: 'Председатель собрания',
    signed_digitally: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
  },
  meta: {
    created_at: '15.03.2024 15:00',
  },
  protocol_number: '15-03-2024',
  chairman_full_name: 'Иванов Петр Сидорович',
  open_at_datetime: '15.03.2024 10:00',
  close_at_datetime: '15.03.2024 18:00',
  current_quorum_percent: 100,
  questions: [
    {
      number: '1',
      title: 'Об организации кооперативного участка «РОМАШКА»',
      context: 'Учреждение кооперативного участка с привязкой к указанному адресу.',
      decision: 'Организовать кооперативный участок «РОМАШКА»',
      counter_votes_for: '5',
      counter_votes_against: '0',
      counter_votes_abstained: '0',
      votes_for_percent: 100,
      votes_against_percent: 0,
      votes_abstained_percent: 0,
      is_accepted: true,
    },
  ],
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
