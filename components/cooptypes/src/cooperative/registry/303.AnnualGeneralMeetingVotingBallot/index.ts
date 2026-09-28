import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IMeetExtended, IVars } from '../../model'
import type { IMeetPoint } from '../../../interfaces/meet'

export const registry_id = 303

/**
 * Интерфейс ответа с голосованием
 */
export interface IAnswer {
  number: string
  id: string
  vote: 'for' | 'against' | 'abstained'
}

/**
 * Интерфейс вопроса собрания
 */
export interface IQuestion extends IMeetPoint {
  id: string
  number: string
}

/**
 * Интерфейс генерации заявления с бюллетенем для голосования
 */
export interface Action extends IGenerate {
  meet_hash: string
  username: string
  answers: IAnswer[]
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  meet: IMeetExtended
  user: ICommonUser
  answers: IAnswer[]
  questions: IQuestion[]
  vars: IVars
}

export const title = 'Заявление с бюллетенем для голосования на общем собрании'
export const description = 'Форма заявления пайщика с бюллетенем для голосования на очередном/внеочередном общем собрании'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.about {padding: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px; }table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}ul {list-style: none;padding: 0;}li {margin: 5px 0;}</style><div class="digital-document"><div style="text-align: right; font-weight: bold;">{% if meet.type == 'regular' %}{% trans 'annual_regular_label' %}{% else %}{% trans 'annual_extra_label' %}{% endif %} {% if coop.is_branched %}{% trans 'GENERAL_MEETING_LABEL_BRANCHED' %}{% else %}{% trans 'GENERAL_MEETING_LABEL' %}{% endif %}</div><div style="text-align: right; font-weight: bold;">{{vars.full_abbr_genitive}} «{{vars.name}}»</div><div style="text-align: right;">{% if coop.is_branched %}{% trans 'FROM_AUTHORIZED_LABEL' %}{% else %}{% trans 'FROM_PARTICIPANT_LABEL' %}{% endif %} {{ user.full_name_or_short_name }}</div><div style="text-align: right; padding-bottom: 20px;">{{ coop.city }}, {{ created_at }}</div><h1 style="text-align:center; margin: 0px; padding-top: 15px;">{% trans 'APPLICATION_TITLE' %}</h1><p>{% trans 'REQUEST_VOTE_COUNT_START' %} {% if meet.type == 'regular' %}{% trans 'annual_regular_word' %}{% else %}{% trans 'annual_extra_word' %}{% endif %} {% trans 'GENERAL_MEETING_TEXT' %} {% if coop.is_branched %}{% trans 'AUTHORIZED_WORD' %}{% else %}{% trans 'PARTICIPANT_WORD' %}{% endif %} {{vars.full_abbr_genitive}} «{{vars.name}}» {{meet.open_at_datetime}}, {% trans 'namely_text' %}:</p>{% for question in questions %}{% for answer in answers %}{% if answer.id == question.id %}<h3 style="padding-top: 30px; padding-bottom: 10px; text-align: center;">{% trans 'DECISION_BY_QUESTION', question.number %}</h3><table><tbody><tr><th>{% trans 'decision_text' %}</th><td>{{ question.decision }}</td></tr>{% if question.context %}<tr><th>{% trans 'context_label' %}</th><td><em>{{ question.context }}</em></td></tr>{% endif %}<tr><th></th><td><table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border: none; margin-top: 10px;"><tr><td style="border: none; width: 80px; padding: 5px;"><span style="font-size: 34px; margin-right: 8px;">{% if answer.vote == 'for' %}<span style="font-weight: bold;">☒</span>{% else %}☐{% endif %}</span><span>{% trans 'vote_for' %}</span></td><td style="border: none; width: 120px; padding: 5px;"><span style="font-size: 34px; margin-right: 8px;">{% if answer.vote == 'against' %}<span style="font-weight: bold;">☒</span>{% else %}☐{% endif %}</span><span>{% trans 'vote_against' %}</span></td><td style="border: none; width: 150px; padding: 5px;"><span style="font-size: 34px; margin-right: 8px;">{% if answer.vote == 'abstained' %}<span style="font-weight: bold;">☒</span>{% else %}☐{% endif %}</span><span>{% trans 'vote_abstained' %}</span></td><td style="border: none;"></td></tr></table></td></tr></tbody></table>{% endif %}{% endfor %}{% endfor %}<div class="signature" style="padding-top: 30px;"><p>{% if coop.is_branched %}{% trans 'AUTHORIZED_SIGNATURE_LABEL' %}{% else %}{% trans 'PARTICIPANT_SIGNATURE_LABEL' %}{% endif %} {{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    annual_regular_label: 'Очередному',
    annual_extra_label: 'Внеочередному',
    annual_regular: 'очередного',
    annual_extra: 'внеочередного',
    annual_regular_word: 'очередного',
    annual_extra_word: 'внеочередного',
    GENERAL_MEETING_LABEL: 'Общему Собранию Пайщиков',
    GENERAL_MEETING_LABEL_BRANCHED: 'Общему Собранию Уполномоченных',
    GENERAL_MEETING_LABEL_LOWER: 'Общего Собрания Пайщиков',
    GENERAL_MEETING_LABEL_LOWER_BRANCHED: 'Общего Собрания Уполномоченных',
    GENERAL_MEETING_TEXT: 'Общего Собрания',
    PARTICIPANT_WORD: 'Пайщиков',
    AUTHORIZED_WORD: 'Уполномоченных',
    FROM_PARTICIPANT_LABEL: 'От Пайщика',
    FROM_AUTHORIZED_LABEL: 'От Уполномоченного',
    APPLICATION_TITLE: 'ЗАЯВЛЕНИЕ',
    REQUEST_VOTE_COUNT_START: 'Прошу учесть мой голос при голосовании по Повестке дня',
    namely_text: 'а именно',
    DECISION_BY_QUESTION: 'РЕШЕНИЕ по {0} вопросу',
    decision_text: 'Текст решения',
    context_label: 'Дополнительная информация',
    vote_for: 'За',
    vote_against: 'Против',
    vote_abstained: 'Воздержался',
    PARTICIPANT_SIGNATURE_LABEL: 'Пайщик',
    AUTHORIZED_SIGNATURE_LABEL: 'Уполномоченный',
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
    open_at_datetime: '15.03.2024 10:00 (Мск)',
  },
  user: {
    full_name_or_short_name: 'Сидоров Иван Петрович',
  },
  answers: [
    {
      id: '1',
      number: '1',
      vote: 'for',
    },
    {
      id: '2',
      number: '2',
      vote: 'against',
    },
  ],
  questions: [
    {
      id: '1',
      number: '1',
      title: 'Отчет Председателя Совета Потребительского Кооператива и признать результаты деятельности удовлетворительными',
      context: 'Подробная информация о вопросе...',
      decision: 'Принять Отчет Председателя Совета Потребительского Кооператива и признать результаты деятельности удовлетворительными',
    },
    {
      id: '2',
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
