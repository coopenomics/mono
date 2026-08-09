import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 322

/**
 * Волеизъявление пайщика по вопросу повестки
 */
export interface IAnswer {
  number: string
  id: string
  vote: 'for' | 'against' | 'abstained'
}

/**
 * Вопрос собрания участка
 */
export interface IQuestion {
  id: string
  number: string
  title: string
  context?: string
  decision: string
}

/**
 * Интерфейс генерации бюллетеня для голосования на собрании пайщиков участка.
 * Вопросы повестки передаются вместе с данными (источник — проекция решения).
 */
export interface Action extends IGenerate {
  hash: string
  username: string
  answers: IAnswer[]
  questions: IQuestion[]
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  answers: IAnswer[]
  questions: IQuestion[]
  vars: IVars
}

export const title = 'Бюллетень для голосования на собрании пайщиков кооперативного участка'
export const description = 'Форма заявления пайщика с бюллетенем для голосования на собрании пайщиков кооперативного участка'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.digital-document {padding: 20px;white-space: pre-wrap;}table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><div style="text-align: right;">{% trans 'FROM_PARTICIPANT_LABEL' %} {{ user.full_name_or_short_name }}</div><div style="text-align: right; padding-bottom: 20px;">{{ coop.city }}, {{ meta.created_at }}</div><h1 style="text-align:center;">{% trans 'BALLOT_TITLE' %}</h1><p>{% trans 'REQUEST_VOTE_TEXT', vars.name %}:</p>{% for question in questions %}{% for answer in answers %}{% if answer.id == question.id %}<h3 style="padding-top: 30px; padding-bottom: 10px; text-align: center;">{% trans 'DECISION_BY_QUESTION', question.number %}</h3><table><tbody><tr><th>{% trans 'decision_text' %}</th><td>{{ question.decision }}</td></tr>{% if question.context %}<tr><th>{% trans 'context_label' %}</th><td><em>{{ question.context }}</em></td></tr>{% endif %}<tr><th></th><td><table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border: none; margin-top: 10px;"><tr><td style="border: none; width: 80px; padding: 5px;"><span style="font-size: 34px; margin-right: 8px;">{% if answer.vote == 'for' %}<span style="font-weight: bold;">☒</span>{% else %}☐{% endif %}</span><span>{% trans 'vote_for' %}</span></td><td style="border: none; width: 120px; padding: 5px;"><span style="font-size: 34px; margin-right: 8px;">{% if answer.vote == 'against' %}<span style="font-weight: bold;">☒</span>{% else %}☐{% endif %}</span><span>{% trans 'vote_against' %}</span></td><td style="border: none; width: 150px; padding: 5px;"><span style="font-size: 34px; margin-right: 8px;">{% if answer.vote == 'abstained' %}<span style="font-weight: bold;">☒</span>{% else %}☐{% endif %}</span><span>{% trans 'vote_abstained' %}</span></td><td style="border: none;"></td></tr></table></td></tr></tbody></table>{% endif %}{% endfor %}{% endfor %}<div class="signature" style="padding-top: 30px;"><p>{% trans 'PARTICIPANT_SIGNATURE_LABEL' %} {{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    BALLOT_TITLE: 'БЮЛЛЕТЕНЬ ДЛЯ ГОЛОСОВАНИЯ',
    FROM_PARTICIPANT_LABEL: 'От Пайщика',
    REQUEST_VOTE_TEXT: 'Прошу учесть мой голос при голосовании по вопросам повестки собрания пайщиков кооперативного участка потребительского кооператива «{0}», а именно',
    DECISION_BY_QUESTION: 'РЕШЕНИЕ по {0} вопросу',
    decision_text: 'Текст решения',
    context_label: 'Дополнительная информация',
    vote_for: 'За',
    vote_against: 'Против',
    vote_abstained: 'Воздержался',
    PARTICIPANT_SIGNATURE_LABEL: 'Пайщик',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
  },
  meta: {
    created_at: '12.02.2024 10:30',
  },
  user: {
    full_name_or_short_name: 'Сидоров Иван Петрович',
  },
  answers: [
    { id: '1', number: '1', vote: 'for' },
    { id: '2', number: '2', vote: 'for' },
  ],
  questions: [
    {
      id: '1',
      number: '1',
      title: 'Об организации кооперативного участка «РОМАШКА»',
      context: 'Учреждение кооперативного участка с привязкой к указанному адресу.',
      decision: 'Организовать кооперативный участок «РОМАШКА»',
    },
    {
      id: '2',
      number: '2',
      title: 'Об избрании председателя кооперативного участка',
      context: 'Избрание председателя из числа участников собрания.',
      decision: 'Избрать председателем кооперативного участка Иванова Петра Сидоровича',
    },
  ],
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
