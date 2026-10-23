import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IMeetExtended, IQuestionExtended, IVars } from '../../model'

export const registry_id = 304

/**
 * Интерфейс генерации протокола решения общего собрания
 */
export interface Action extends IGenerate {
  meet_hash: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  decision: IDecisionData
  meet: IMeetExtended
  questions: IQuestionExtended[]
  vars: IVars
}

export const title = 'Протокол решения общего собрания'
export const description = 'Форма протокола решения очередного/внеочередного общего собрания'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.about {padding: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px; }table {width: 100%;border-collapse: collapse;margin-bottom: 20px;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><h1 class="header" style="text-align:center;">{% if coop.is_branched %}{% trans 'protocol_number_authorized', decision.id %}{% else %}{% trans 'protocol_number_regular', decision.id %}{% endif %}</h1><p style="text-align:center" class="subheader">{% if meet.type == 'regular' %}{% trans 'annual_regular' %}{% else %}{% trans 'annual_extra' %}{% endif %} {% if coop.is_branched %}{% trans 'general_meeting_name_branched' %}{% else %}{% trans 'general_meeting_name' %}{% endif %}</p><p style="text-align:center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right"> {{ coop.city }}, {{ created_at }}</p><table class="about"><tbody><tr><th>{% trans 'meeting_datetime' %}</th><td>{{ meet.open_at_datetime }}</td></tr><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'registration_datetime' %}</th><td>{{ meet.open_at_datetime }}</td></tr><tr><th>{% trans 'voting_deadline' %}</th><td>{% trans 'no_later_than' %} {{ meet.close_at_datetime }}</td></tr></tbody></table><p>{% trans 'quorum_available' %} {% if coop.is_branched %}{% trans 'meeting_legal_for_decisions_branched' %}{% else %}{% trans 'meeting_legal_for_decisions' %}{% endif %} {% trans 'quorum_percent' %} {{ meet.current_quorum_percent }}% {% if coop.is_branched %}{% trans 'from_total_authorized' %}{% else %}{% trans 'from_total_participants' %}{% endif %}.</p><h3 style="padding-top: 20px; padding-bottom: 10px; text-align: center;">{% trans 'agenda' %}</h3><table><tbody>{% for question in questions %}<tr><th>{{ question.number }}</th><td>{{ question.title }}</td></tr>{% if question.context %}<tr><th></th><td><em>{{ question.context }}</em></td></tr>{% endif %}{% endfor %}</tbody></table>{% for question in questions %}<h3 style="padding-top: 30px; padding-bottom: 10px; text-align: center;">{% trans 'decided_by_question', question.number %}:</h3><p>{{ question.decision }}</p><table><tbody><tr><th>{% trans 'votes_for' %}</th><td>{{ question.counter_votes_for }} ({{ question.votes_for_percent }}%)</td></tr><tr><th>{% trans 'votes_against' %}</th><td>{{ question.counter_votes_against }} ({{ question.votes_against_percent }}%)</td></tr><tr><th>{% trans 'votes_abstained' %}</th><td>{{ question.counter_votes_abstained }} ({{ question.votes_abstained_percent }}%)</td></tr><tr><th>{% trans 'decision_status' %}</th><td>{% if question.is_accepted %}{% trans 'decision_accepted' %}{% else %}{% trans 'decision_rejected' %}{% endif %}</td></tr></tbody></table>{% endfor %}<p style="padding-top: 20px;">{% trans 'closing_time', meet.close_at_datetime %}</p><div class="signature" style="padding-top: 30px;"><p>{% trans 'chairman_meeting_signature' %} {{ meet.presider_full_name }}</p><p>{% trans 'signed_digitally' %}</p><p>{% trans 'secretary_meeting_signature' %} {{ meet.secretary_full_name }}</p><p>{% trans 'signed_digitally' %}</p></div></div>`

export const translations = {
  ru: {
    protocol_number_regular: 'Протокол № ОС-{0}',
    protocol_number_authorized: 'Протокол № ОСУ-{0}',
    annual_regular: 'очередного',
    annual_extra: 'внеочередного',
    general_meeting_name: 'Общего собрания пайщиков',
    general_meeting_name_branched: 'Общего собрания уполномоченных',
    meeting_datetime: 'Дата и время проведения Собрания',
    meeting_format: 'Форма проведения собрания',
    meeting_format_value: 'заочное',
    registration_datetime: 'Дата и время регистрации участников Собрания',
    voting_deadline: 'Дата и время сбора заявлений (бюллетений) пайщиков с результатом голосования',
    no_later_than: 'не позднее',
    quorum_available: 'Кворум имеется.',
    meeting_legal_for_decisions: 'Общее собрание пайщиков правомочно для проведения и принятия решений по вопросам повестки дня.',
    meeting_legal_for_decisions_branched: 'Общее собрание уполномоченных правомочно для проведения и принятия решений по вопросам повестки дня.',
    agenda: 'Повестка дня',
    decided_by_question: 'РЕШИЛИ по {0} вопросу',
    votes_for: '"За"',
    votes_against: '"Против"',
    votes_abstained: '"Воздержался"',
    votes_total: 'Всего голосов',
    decision_status: 'Статус решения',
    decision_accepted: 'ПРИНЯТО',
    decision_rejected: 'ОТКЛОНЕНО',
    closing_time: 'Время закрытия собрания: {0}',
    chairman_meeting_signature: 'Председатель Собрания',
    secretary_meeting_signature: 'Секретарь Собрания',
    signed_digitally: 'подписано электронной подписью',
    quorum_percent: 'Кворум составляет',
    from_total_participants: 'от общего числа пайщиков',
    from_total_authorized: 'от общего числа уполномоченных',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
    is_branched: false,
  },
  meta: {
    created_at: '15.03.2024 15:00',
  },
  decision: {
    id: 'ОС-15-03-2024',
  },
  meet: {
    type: 'regular',
    open_at_datetime: '15.03.2024 10:00',
    close_at_datetime: '18.03.2024 15:00',
    presider_full_name: 'Иванов Петр Сидорович',
    secretary_full_name: 'Петрова Анна Викторовна',
    current_quorum_percent: 71,
  },
  questions: [
    {
      number: '1',
      title: 'Отчет Председателя Потребительского Кооператива о проделанной работе за период с 01.01.2023 г. по 31.12.2023 г.',
      context: 'Подробная информация о вопросе...',
      decision: 'Принять Отчет Председателя Совета и признать результаты деятельности удовлетворительными',
      counter_votes_for: '15',
      counter_votes_against: '0',
      counter_votes_abstained: '0',
      votes_total: 15,
      votes_for_percent: 100,
      votes_against_percent: 0,
      votes_abstained_percent: 0,
      is_accepted: true,
    },
    {
      number: '2',
      title: 'Утверждение Заключения Ревизионной Комиссии о ревизии деятельности за период с 01.01.2023 г. по 31.12.2023 г.',
      context: 'Дополнительная информация о ревизии...',
      decision: 'Утвердить Заключение Ревизионной Комиссии о ревизии деятельности',
      counter_votes_for: '15',
      counter_votes_against: '0',
      counter_votes_abstained: '0',
      votes_total: 15,
      votes_for_percent: 100,
      votes_against_percent: 0,
      votes_abstained_percent: 0,
      is_accepted: true,
    },
  ],
  vars: {
    full_abbr_genitive: 'Потребительского кооператива',
    name: 'ВОСХОД',
  },
}
