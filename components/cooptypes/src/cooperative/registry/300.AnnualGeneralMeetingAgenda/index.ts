import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 300

// Локальные интерфейсы для данных собрания (берутся из ICreateMeet)
interface IAgendaMeet {
  type: 'regular' | 'extra'
  open_at_datetime: string
  close_at_datetime: string
}

interface IAgendaQuestion {
  number: string
  title: string
  context?: string
  decision: string
}

/**
 * Интерфейс генерации предложения повестки дня
 */
export interface Action extends IGenerate {
  meet: IAgendaMeet
  questions: IAgendaQuestion[]
  is_repeated: boolean
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  meet: IAgendaMeet
  questions: IAgendaQuestion[]
  is_repeated: boolean
  user: ICommonUser
  vars: IVars
}

export const title = 'Предложение повестки дня общего собрания'
export const description = 'Форма предложения повестки дня очередного/внеочередного общего собрания'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.about {padding: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px; }table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><div style="padding-bottom: 30px;"><h1 style="text-align:center">{% trans 'AGENDA_PROPOSAL_TITLE' %}</h1><p style="text-align:center">{% if is_repeated %}{% trans 'REPEATED' %} {% endif %}{% if meet.type == 'regular' %}{% trans 'ANNUAL_REGULAR' %}{% else %}{% trans 'ANNUAL_extra' %}{% endif %} {% if coop.is_branched %}{% trans 'GENERAL_MEETING_REPRESENTATIVES' %}{% else %}{% trans 'GENERAL_MEETING_SHAREHOLDERS' %}{% endif %}</p><p style="text-align:center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right; padding-top: 20px">{{ coop.city }}, {{ created_at }}</p></div><table class="about"><tbody><tr><th>{% trans 'MEETING_DATETIME_LABEL' %}</th><td>{{ meet.open_at_datetime }}</td></tr><tr><th>{% trans 'MEETING_FORMAT_LABEL' %}</th><td>{% trans 'MEETING_FORMAT_VALUE' %}</td></tr><tr><th>{% trans 'REGISTRATION_DATETIME' %}</th><td>{{ meet.open_at_datetime }}</td></tr><tr><th>{% trans 'VOTING_DEADLINE' %}</th><td>{% trans 'NO_LATER_THAN' %} {{ meet.close_at_datetime }}</td></tr></tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'AGENDA_QUESTIONS' %}</h3><table><tbody>{% for question in questions %}<tr><th>{{ question.number }}.</th><td>{{ question.title }}</td></tr>{% if question.context %}<tr><th></th><td><em>{{ question.context }}</em></td></tr>{% endif %}{% endfor %}</tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'PROJECT_DECISIONS' %}</h3><table><tbody>{% for question in questions %}<tr><th>{% trans 'PROJECT_DECISION_LABEL' %} {{ question.number }}</th><td>{{ question.decision }}</td></tr>{% endfor %}</tbody></table><div class="signature"><div style="padding-top: 20px;"><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div></div>`

export const translations = {
  ru: {
    AGENDA_PROPOSAL_TITLE: 'ПРЕДЛОЖЕНИЕ ПОВЕСТКИ',
    ANNUAL_REGULAR: 'ОЧЕРЕДНОГО',
    ANNUAL_extra: 'ВНЕОЧЕРЕДНОГО',
    REPEATED: 'ПОВТОРНОГО',
    GENERAL_MEETING_SHAREHOLDERS: 'СОБРАНИЯ ПАЙЩИКОВ',
    GENERAL_MEETING_REPRESENTATIVES: 'СОБРАНИЯ УПОЛНОМОЧЕННЫХ',
    MEETING_DATETIME_LABEL: 'Дата и время проведения Собрания',
    MEETING_FORMAT_LABEL: 'Форма проведения собрания',
    MEETING_FORMAT_VALUE: 'заочное',
    REGISTRATION_DATETIME: 'Дата и время регистрации участников Собрания',
    VOTING_DEADLINE: 'Дата и время сбора заявлений пайщиков с результатом голосования',
    NO_LATER_THAN: 'не позднее',
    AGENDA_QUESTIONS: 'ВОПРОСЫ ПОВЕСТКИ ДНЯ',
    PROJECT_DECISIONS: 'ПРОЕКТЫ РЕШЕНИЙ',
    PROJECT_DECISION_LABEL: 'ПРОЕКТ РЕШЕНИЯ по вопросу',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

// Пример данных для редактора шаблонов
export const exampleData = {
  coop: {
    city: 'Москва',
    is_branched: false,
  },
  meta: {
    created_at: '12.02.2024 10:30',
  },
  meet: {
    type: 'regular',
    open_at_datetime: '12.03.2024 10:00 (Мск)',
    close_at_datetime: '15.03.2024 10:00 (Мск)',
  },
  user: {
    full_name_or_short_name: 'Иванов Петр Сидорович',
  },
  questions: [
    {
      number: '1',
      title: 'Отчет Председателя Потребительского Кооператива о проделанной работе за период с 01.01.2023 г. по 31.12.2023 г.',
      context: 'Подробная информация об отчете приведена в документе...',
      decision: 'Принять Отчет Председателя Совета и признать результаты деятельности удовлетворительными',
    },
    {
      number: '2',
      title: 'Утверждение Заключения Ревизионной Комиссии о ревизии деятельности за период с 01.01.2023 г. по 31.12.2023 г.',
      context: 'Заключение Ревизионной Комиссии содержит...',
      decision: 'Утвердить Заключение Ревизионной Комиссии о ревизии деятельности',
    },
  ],
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
  is_repeated: false,
}
