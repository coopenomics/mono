import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  EDUCATION_DOC_STYLE,
  educationContractDocExample,
  educationContractDocTranslations,
} from '../educationContractDocs'

export const registry_id = 3009

/**
 * Протокол совета о приёме паевого взноса результатом интеллектуальной
 * деятельности преподавателя (ЦПП «Образование», процесс p.edu.rid).
 * Документ-Решение совета по Заявлению 3008; подписывается председателем
 * через стандартный sov.decision-flow и уходит параметром `decision`
 * действия `edubridge::acceptrid` (либо `declinerid`).
 */
export interface Action extends IGenerate {
  registry_id: number
  /** ID решения в soviet.decisions. */
  decision_id: number
  /** Канонический идентификатор взноса РИД on-chain. */
  rid_hash: string
  /** Принимаемая стоимость РИД, с валютой. */
  amount: string
  /** Вид результата (eosio::name); в протокол идёт его название. */
  rid_type?: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  decision: IDecisionData
  user: ICommonUser
  program: ICommonProgram
  rid_hash: string
  amount: string
  /** Номер договора УХД преподавателя — фабрика берёт из Udata. */
  contract_number: string
  /** Дата договора УХД (дд.мм.гггг). */
  contract_created_at: string
  /** Вид результата словами. */
  rid_type_human: string
  rid_short_hash: string
}

export const title = 'Протокол совета о приёме паевого взноса результатом интеллектуальной деятельности'
export const description = 'Протокол решения совета о приёме паевого взноса преподавателя Имуществом по договору УХД ЦПП «ОБРАЗОВАНИЕ»'

export const context = `<div class="digital-document"><div style="text-align: center"><h1 class="header">{% trans 'protocol_number', decision.id %}</h1><p class="subheader">{% trans 'council_meeting_name', vars.full_abbr_genitive, vars.name %}</p></div><p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p><table><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'meeting_place' %}</th><td>{{ coop.full_address }}</td></tr><tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr><tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr></tbody></table><h3>{% trans 'council_members' %}</h3><table><tbody>{% for member in coop.members %}<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td></tr>{% endfor %}</tbody></table><h3>{% trans 'meeting_legality' %}</h3><p>{% trans 'voting_results', decision.voters_percent %} {% trans 'quorum' %} {% trans 'chairman_of_the_meeting', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}</p><h3>{% trans 'agenda' %}</h3><table><tbody><tr><th style="width: 6%">№</th><td>{% trans 'question' %}</td></tr><tr><th style="width: 6%">1</th><td>{% trans 'agenda_item', user.full_name_or_short_name, rid_short_hash, contract_number, contract_created_at %}</td></tr></tbody></table><h3>{% trans 'heard' %}</h3><p>{% trans 'heard_text', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, user.full_name_or_short_name, rid_short_hash, contract_number, contract_created_at %}</p><h3>{% trans 'voting' %}</h3><p>{% trans 'vote_results' %}</p><table><tbody><tr><th>{% trans 'votes_for' %}</th><td>{{ decision.votes_for }}</td></tr><tr><th>{% trans 'votes_against' %}</th><td>{{ decision.votes_against }}</td></tr><tr><th>{% trans 'votes_abstained' %}</th><td>{{ decision.votes_abstained }}</td></tr></tbody></table><h3>{% trans 'decision_made' %}</h3><p>{% trans 'decision_text', user.full_name_or_short_name, rid_short_hash, contract_number, contract_created_at %}</p><table><tbody><tr><th style="width: 5%">{% trans 'row_number' %}</th><th style="width: 25%">{% trans 'row_name' %}</th><th style="width: 20%">{% trans 'row_form' %}</th><th style="width: 8%">{% trans 'row_unit' %}</th><th style="width: 13%">{% trans 'row_quantity' %}</th><th style="width: 14%">{% trans 'row_unit_price' %}</th><th style="width: 15%">{% trans 'row_total' %}</th></tr><tr><td>1</td><td>{% trans 'property_name', rid_type_human, rid_short_hash %}</td><td>{% trans 'property_form' %}</td><td>{% trans 'unit_piece' %}</td><td>1</td><td>{{ amount }}</td><td>{{ amount }}</td></tr><tr><td></td><td>{% trans 'total' %}</td><td></td><td></td><td>1</td><td></td><td>{{ amount }}</td></tr></tbody></table><p>{% trans 'closing_time', decision.time %}</p><p style="margin: 0px !important">{% trans 'signature' %}</p><p style="margin: 0px !important">{% trans 'chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div>${EDUCATION_DOC_STYLE}`

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
    agenda_item: 'Заявление пайщика {0} № ЗПВИ-{1} на внесение паевого взноса Имуществом в соответствии с условиями Договора об участии в хозяйственной деятельности № {2} от {3}.',
    heard: 'СЛУШАЛИ',
    heard_text: '{0} {1} {2} с предложением принять паевой взнос Имуществом от пайщика {3} согласно его заявления № ЗПВИ-{4} в соответствии с условиями Договора об участии в хозяйственной деятельности № {5} от {6}.',
    voting: 'ГОЛОСОВАНИЕ',
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    votes_for: 'ЗА',
    votes_against: 'ПРОТИВ',
    votes_abstained: 'ВОЗДЕРЖАЛСЯ',
    decision_made: 'РЕШИЛИ',
    decision_text: '1. Принять паевой взнос Имуществом от пайщика {0} согласно его заявления № ЗПВИ-{1} в соответствии с условиями Договора об участии в хозяйственной деятельности № {2} от {3}, поручить Председателю Совета подписать акт приема-передачи Имущества и произвести соответствующее начисление на баланс пайщика:',
    property_name: 'Имущество — {0}, запись на электронном носителе № {1}',
    closing_time: 'Время закрытия собрания совета: {0}.',
    signature: 'Документ подписан электронной подписью.',
    chairman: 'Председатель',
  },
}

export const exampleData = {
  ...educationContractDocExample,
  meta: { created_at: '12.06.2026 12:00' },
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
  program: { name: 'ОБРАЗОВАНИЕ' },
  rid_hash: '0000abcd...',
  rid_short_hash: '0000ABCD',
  rid_type_human: 'Запись занятия',
  amount: '15000.00 RUB',
}
