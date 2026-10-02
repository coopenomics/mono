import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IMeetExtended, IVars } from '../../model'
import type { IMeetPoint } from '../../../interfaces/meet'

export const registry_id = 302

/**
 * Интерфейс генерации уведомления о проведении общего собрания
 */
export interface Action extends IGenerate {
  meet_hash: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  meet: IMeetExtended
  questions: IMeetPoint[]
  vars: IVars
  user: ICommonUser
}

export const title = 'Уведомление о проведении общего собрания'
export const description = 'Форма уведомления о проведении очередного/внеочередного общего собрания'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.about {padding: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px; }table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><div style="padding-bottom: 30px;"><h1 style="text-align:center; margin: 0px; padding-top: 15px;">{% trans 'NOTIFICATION_TITLE' %}</h1><p style="text-align: center;">{% trans 'MEETING_ABOUT' %} {% if meet.type == 'regular' %}{% trans 'annual_regular' %}{% else %}{% trans 'annual_extra' %}{% endif %} {% if coop.is_branched %}{% trans 'GENERAL_MEETING_LABEL_BRANCHED' %}{% else %}{% trans 'GENERAL_MEETING_LABEL' %}{% endif %}</p><p style="text-align: center;">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right; padding-top: 20px">{{ coop.city }}, {{ created_at }}</p></div><table class="about"><tbody><tr><th>{% trans 'MEETING_DATETIME_LABEL' %}</th><td>{{ meet.open_at_datetime }}</td></tr><tr><th>{% trans 'MEETING_FORMAT_LABEL' %}</th><td>{% trans 'MEETING_FORMAT_VALUE' %}</td></tr><tr><th>{% trans 'REGISTRATION_DATETIME_LABEL' %}</th><td>{{ meet.open_at_datetime }}</td></tr><tr><th>{% trans 'VOTING_DEADLINE_LABEL' %}</th><td>{% trans 'NO_LATER_THAN' %} {{ meet.close_at_datetime }}</td></tr></tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px; text-align: center;">{% trans 'AGENDA_QUESTIONS_LABEL' %}</h3><table><tbody>{% for question in questions %}<tr><th>{{ question.number }}.</th><td>{{ question.title }}</td></tr>{% if question.context %}<tr><th></th><td><em>{{ question.context }}</em></td></tr>{% endif %}{% endfor %}</tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px; text-align: center;">{% trans 'PROJECT_DECISIONS_LABEL' %}</h3><table><tbody>{% for question in questions %}<tr><th>{% trans 'PROJECT_DECISION_BY_QUESTION', question.number %}</th><td>{{ question.decision }}</td></tr>{% endfor %}</tbody></table><div class="signature" style="padding-top: 20px;"><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    NOTIFICATION_TITLE: 'УВЕДОМЛЕНИЕ',
    MEETING_ABOUT: 'О проведении',
    annual_regular: 'очередного',
    annual_extra: 'внеочередного',
    GENERAL_MEETING_LABEL: 'Общего Собрания Пайщиков',
    GENERAL_MEETING_LABEL_BRANCHED: 'Общего Собрания Уполномоченных',
    MEETING_DATETIME_LABEL: 'Дата и время проведения Собрания',
    MEETING_FORMAT_LABEL: 'Форма проведения собрания',
    MEETING_FORMAT_VALUE: 'заочное',
    REGISTRATION_DATETIME_LABEL: 'Дата и время регистрации участников Собрания',
    VOTING_DEADLINE_LABEL: 'Дата и время сбора заявлений пайщиков с результатом голосования',
    NO_LATER_THAN: 'не позднее',
    AGENDA_QUESTIONS_LABEL: 'ВОПРОСЫ ПОВЕСТКИ ДНЯ',
    PROJECT_DECISIONS_LABEL: 'ПРОЕКТЫ РЕШЕНИЙ',
    PROJECT_DECISION_BY_QUESTION: 'ПРОЕКТ РЕШЕНИЯ по {0} вопросу',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    is_branched: false,
    city: 'Москва',
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
    full_name_or_short_name: 'Сидоров Иван Петрович',
  },
  questions: [
    {
      number: '1',
      title: 'Отчет Председателя Совета Потребительского Кооператива и признать результаты деятельности удовлетворительными',
      context: 'Подробная информация о вопросе...',
      decision: 'Принять Отчет Председателя Совета Потребительского Кооператива и признать результаты деятельности удовлетворительными',
    },
    {
      number: '2',
      title: 'Утверждение Заключения Ревизионной Комиссии о ревизии деятельности',
      context: 'Дополнительная информация о ревизии...',
      decision: 'Утвердить Заключение Ревизионной Комиссии о ревизии деятельности',
    },
  ],
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
