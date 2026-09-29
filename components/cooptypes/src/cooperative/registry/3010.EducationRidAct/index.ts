import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  EDUCATION_ANNEX_HEAD_HTML,
  EDUCATION_DOC_STYLE,
  educationContractDocExample,
  educationContractDocTranslations,
} from '../educationContractDocs'

export const registry_id = 3010

/**
 * Акт приёма-передачи паевого взноса результатом интеллектуальной
 * деятельности преподавателя (ЦПП «Образование», процесс p.edu.rid).
 *
 * Двухподписный документ по канону marketplace/capital: первым акт
 * подписывает преподаватель (`username` из IGenerate, ФИО через
 * getUser → user), вторым председатель Совета (ФИО из coop.chairman),
 * подписывающий тот же документ по хэшу. Уходит параметром `act` действия
 * `edubridge::acceptrid`; денежно ему соответствует операция o.edu.rid
 * (ISSUE в w.wal.share, Дт 04 / Кт 80).
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Канонический идентификатор взноса РИД on-chain. */
  rid_hash: string
  /** Стоимость принимаемого РИД, с валютой. */
  amount: string
  /** Тип РИД (eosio::name). */
  rid_type: string
  /** Номер протокола совета, которым принят взнос. */
  decision_id?: number
  /** Дата протокола совета (дд.мм.гггг). */
  decision_date?: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  program: ICommonProgram
  rid_hash: string
  rid_short_hash: string
  amount: string
  rid_type: string
  /** Номер договора УХД преподавателя — фабрика берёт из Udata. */
  contract_number: string
  /** Дата договора УХД (дд.мм.гггг). */
  contract_created_at: string
  /** Вид результата словами. */
  rid_type_human: string
  decision_id?: number
  decision_date?: string
}

export const title = 'Акт приёма-передачи паевого взноса результатом интеллектуальной деятельности'
export const description = 'Акт приёма-передачи Имущества преподавателя паевым взносом по договору УХД ЦПП «ОБРАЗОВАНИЕ» (подписывают преподаватель и председатель)'

export const context = `<div class="digital-document">${EDUCATION_ANNEX_HEAD_HTML}<div style="text-align: center; padding-top: 15px"><h1 class="header">{% trans 'act_title', rid_short_hash %}</h1><p class="subheader">{% trans 'act_subtitle', contract_number, contract_created_at %}</p></div><p style="margin: 0px !important">{% trans 'city', coop.city %}</p><p>{% trans 'date', meta.created_at %}</p><p>{% trans 'act_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, user.full_name_or_short_name, contract_number, contract_created_at %}{% if decision_id %}{% trans 'act_intro_protocol', decision_id, decision_date %}{% endif %} {% trans 'act_intro_property' %}</p><table><tbody><tr><th style="width: 5%">{% trans 'row_number' %}</th><th style="width: 25%">{% trans 'row_name' %}</th><th style="width: 20%">{% trans 'row_form' %}</th><th style="width: 8%">{% trans 'row_unit' %}</th><th style="width: 13%">{% trans 'row_quantity' %}</th><th style="width: 14%">{% trans 'row_unit_price' %}</th><th style="width: 15%">{% trans 'row_total' %}</th></tr><tr><td>1</td><td>{% trans 'property_name', rid_type_human, rid_short_hash %}</td><td>{% trans 'property_form' %}</td><td>{% trans 'unit_piece' %}</td><td>1</td><td>{{ amount }}</td><td>{{ amount }}</td></tr><tr><td></td><td>{% trans 'total' %}</td><td></td><td></td><td>1</td><td></td><td>{{ amount }}</td></tr></tbody></table><p>{% trans 'no_claims' %}</p><table><tbody><tr><th>{% trans 'transferred' %}</th><td>{% trans 'member' %}: {{ user.full_name_or_short_name }}</td><td>{% trans 'signed_electronically' %}</td></tr><tr><th>{% trans 'received' %}</th><td>{% trans 'chairman_label' %} {{ vars.short_abbr }} «{{ vars.name }}» {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</td><td>{% trans 'signed_electronically' %}</td></tr></tbody></table></div>${EDUCATION_DOC_STYLE}`

export const translations = {
  ru: {
    ...educationContractDocTranslations,
    act_title: 'АКТ № АППИ-{0}',
    act_subtitle: 'приема-передачи Имущества в соответствии с условиями Договора об участии в хозяйственной деятельности № {0} от {1}',
    city: 'г. {0}',
    date: 'Дата: {0}',
    act_intro: '{0} «{1}» (далее «Общество») в лице Председателя Совета Общества {2} {3} {4}, и Пайщик {5}, составили настоящий Акт о том, что Пайщик передал, а Общество получило от Пайщика, в соответствии с условиями Договора об участии в хозяйственной деятельности № {6} от {7}',
    act_intro_protocol: ' и Протоколом Совета № {0} от {1}',
    act_intro_property: 'следующее Имущество:',
    property_name: 'Имущество — {0}, запись на электронном носителе № {1}',
    no_claims: 'Претензий по качеству Имущества Общество не имеет.',
    transferred: 'ПЕРЕДАНО:',
    received: 'ПОЛУЧЕНО:',
  },
}

export const exampleData = {
  ...educationContractDocExample,
  meta: { created_at: '12.06.2026 12:00' },
  program: { name: 'ОБРАЗОВАНИЕ' },
  rid_hash: '0000abcd...',
  rid_short_hash: '0000ABCD',
  amount: '15000.00 RUB',
  rid_type: 'lesson_recording',
  rid_type_human: 'Запись занятия',
  decision_id: 43,
  decision_date: '12.06.2026',
}
