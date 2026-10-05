import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  EDUCATION_DOC_STYLE,
  educationContractDocExample,
  educationContractDocTranslations,
} from '../educationContractDocs'

export const registry_id = 3014

/**
 * Протокол совета об аннулировании Подписки по Гарантийным условиям
 * (ЦПП «Образование», пункты 4.4.2 и 4.4.4 Положения).
 * Документ-Решение совета по Заявлению 3013; подписывается председателем
 * через стандартный sov.decision-flow. Форма — как у протокола 3009,
 * таблицы имущества нет: решение возвращает стоимость Подписки на баланс ЦК.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** ID решения в soviet.decisions. */
  decision_id: number
  /** Идентификатор заявления об аннулировании Подписки. */
  claim_hash: string
  /** Наименование Подписки (курса). */
  course_title: string
  /** Возвращаемая стоимость Подписки, с валютой. */
  amount: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  decision: IDecisionData
  /** Пайщик-ученик, подавший заявление. */
  user: ICommonUser
  claim_hash: string
  /** Короткий номер заявления — фабрика берёт первые 8 символов claim_hash. */
  claim_short_hash: string
  course_title: string
  amount: string
}

export const title = 'Протокол совета об аннулировании Подписки по Гарантийным условиям'
export const description = 'Протокол решения совета об аннулировании Подписки пайщика по Гарантийным условиям ЦПП «ОБРАЗОВАНИЕ»'

export const context = `<div class="digital-document"><div style="text-align: center"><h1 class="header">{% trans 'protocol_number', decision.id %}</h1><p class="subheader">{% trans 'council_meeting_name', vars.full_abbr_genitive, vars.name %}</p></div><p style="text-align: right">{{ created_at }}, {{ coop.city }}</p><table><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'meeting_place' %}</th><td>{{ coop.full_address }}</td></tr><tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr><tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr></tbody></table><h3>{% trans 'council_members' %}</h3><table><tbody>{% for member in coop.members %}<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td></tr>{% endfor %}</tbody></table><h3>{% trans 'meeting_legality' %}</h3><p>{% trans 'voting_results', decision.voters_percent %} {% trans 'quorum' %} {% trans 'chairman_of_the_meeting', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}</p><h3>{% trans 'agenda' %}</h3><table><tbody><tr><th style="width: 6%">№</th><td>{% trans 'question' %}</td></tr><tr><th style="width: 6%">1</th><td>{% trans 'agenda_item', user.full_name_or_short_name, claim_short_hash, course_title %}</td></tr></tbody></table><h3>{% trans 'heard' %}</h3><p>{% trans 'heard_text', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, user.full_name_or_short_name, claim_short_hash, course_title %}</p><h3>{% trans 'voting' %}</h3><p>{% trans 'vote_results' %}</p><table><tbody><tr><th>{% trans 'votes_for' %}</th><td>{{ decision.votes_for }}</td></tr><tr><th>{% trans 'votes_against' %}</th><td>{{ decision.votes_against }}</td></tr><tr><th>{% trans 'votes_abstained' %}</th><td>{{ decision.votes_abstained }}</td></tr></tbody></table><h3>{% trans 'decision_made' %}</h3><p>{% trans 'decision_text', user.full_name_or_short_name, claim_short_hash, course_title, amount %}</p><p>{% trans 'closing_time', decision.time %}</p><p style="margin: 0px !important">{% trans 'signature' %}</p><p style="margin: 0px !important">{% trans 'chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div>${EDUCATION_DOC_STYLE}`

export const translations = {
  ru: {
    ...educationContractDocTranslations,
    protocol_number: 'ПРОТОКОЛ № {0}',
    council_meeting_name: 'Собрания Совета {0} «{1}»',
    meeting_format: 'Форма',
    meeting_format_value: 'Заочная',
    meeting_place: 'Место',
    meeting_date: 'Дата',
    opening_time: 'Время открытия',
    council_members: 'ЧЛЕНЫ СОВЕТА',
    chairman_of_the_council: 'Председатель совета',
    member_of_the_council: 'Член совета',
    meeting_legality: 'СОБРАНИЕ ПРАВОМОЧНО',
    voting_results: 'Количество голосов составляет {0}% от общего числа членов Совета.',
    quorum: 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    chairman_of_the_meeting: 'Председатель собрания совета: {0} {1} {2}.',
    agenda: 'ПОВЕСТКА ДНЯ',
    question: 'Вопрос',
    agenda_item: 'Заявление пайщика {0} № ЗАП-{1} об аннулировании Подписки «{2}» по Гарантийным условиям в соответствии с пунктом 4.4.2 Положения о целевой потребительской программе «ОБРАЗОВАНИЕ».',
    heard: 'СЛУШАЛИ',
    heard_text: '{0} {1} {2} с предложением удовлетворить заявление пайщика {3} № ЗАП-{4} об аннулировании Подписки «{5}» по Гарантийным условиям.',
    voting: 'ГОЛОСОВАНИЕ',
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    votes_for: 'ЗА',
    votes_against: 'ПРОТИВ',
    votes_abstained: 'ВОЗДЕРЖАЛСЯ',
    decision_made: 'РЕШИЛИ',
    decision_text: '1. Удовлетворить заявление пайщика {0} № ЗАП-{1}: аннулировать Подписку «{2}» и возвратить на баланс ЦК пайщика списанную стоимость Подписки в размере {3} в соответствии с пунктом 4.4.4 Положения о целевой потребительской программе «ОБРАЗОВАНИЕ».',
    closing_time: 'Время закрытия собрания совета: {0}.',
    signature: 'Документ подписан электронной подписью.',
    chairman: 'Председатель',
  },
}

export const exampleData = {
  ...educationContractDocExample,
  meta: { created_at: '12.06.2026 12:00' },
  created_at: '12.06.2026 12:00',
  coop: {
    ...educationContractDocExample.coop,
    full_address: 'Смольная 3-84',
    short_name: 'ПК "Восход"',
  },
  decision: {
    id: '43',
    date: '12.06.2026',
    time: '12:00',
    votes_for: '3',
    votes_against: '0',
    votes_abstained: '0',
    voters_percent: '100',
  },
  claim_hash: '0000abcd...',
  claim_short_hash: '0000ABCD',
  course_title: 'Основы программирования',
  amount: '1000.00 RUB',
}
