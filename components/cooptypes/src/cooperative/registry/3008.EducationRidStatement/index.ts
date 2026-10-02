import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  EDUCATION_ANNEX_HEAD_HTML,
  EDUCATION_DOC_STYLE,
  educationContractDocExample,
  educationContractDocTranslations,
} from '../educationContractDocs'

export const registry_id = 3008

/**
 * Заявление преподавателя о внесении паевого взноса Имуществом — результатом
 * интеллектуальной деятельности (процесс p.edu.rid, шаг `edubridge::submitrid`).
 * Приложение № 1 к договору УХД по форме владельца и заявления 1040
 * «Благороста»: ссылка на договор, описание Имущества, оценка, заверение о
 * праве собственности. Далее Совет принимает решение (3009), стороны
 * подписывают акт (3010).
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Канонический идентификатор взноса РИД on-chain. */
  rid_hash: string
  /** Идентификатор задания (assignment) в edubridge. */
  assignment_id: number
  /** Заявленная стоимость РИД, с валютой. */
  amount: string
  /** Тип РИД (eosio::name). */
  rid_type: string
  /** Ссылки и описание передаваемого результата. */
  links: string[]
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  program: ICommonProgram
  rid_hash: string
  assignment_id: number
  amount: string
  rid_type: string
  links: string[]
  /** Номер договора УХД преподавателя — фабрика берёт из Udata. */
  contract_number: string
  /** Дата договора УХД (дд.мм.гггг). */
  contract_created_at: string
  /** Вид результата словами. */
  rid_type_human: string
  rid_short_hash: string
}

export const title = 'Заявление о внесении паевого взноса результатом интеллектуальной деятельности'
export const description = 'Заявление преподавателя о внесении паевого взноса Имуществом по договору УХД ЦПП «ОБРАЗОВАНИЕ»'

export const context = `<div class="digital-document">${EDUCATION_ANNEX_HEAD_HTML}<div style="text-align: right; padding-top: 15px"><p style="margin: 0px !important">{% trans 'to_council', vars.full_abbr_genitive, vars.name %}</p><p style="margin: 0px !important">{% trans 'from_member', user.full_name_or_short_name %}</p></div><div style="text-align: center"><h1 class="header">{% trans 'statement_title', rid_short_hash %}</h1></div><p>{% trans 'body', contract_number, contract_created_at %}</p><table><tbody><tr><th>{% trans 'name_label' %}</th><td>{% trans 'name_value', rid_type_human, assignment_id %}</td></tr><tr><th>{% trans 'category_label' %}</th><td>{% trans 'property_form' %}</td></tr><tr><th>{% trans 'description_label' %}</th><td>{% trans 'description_value' %}</td></tr><tr><th>{% trans 'links_label' %}</th><td><ul>{% for link in links %}<li>{{ link }}</li>{% endfor %}</ul></td></tr><tr><th>{% trans 'guarantee_label' %}</th><td>{% trans 'guarantee_value' %}</td></tr><tr><th>{% trans 'other_label' %}</th><td>{% trans 'other_value', rid_hash %}</td></tr></tbody></table><table><tbody><tr><th style="width: 5%">{% trans 'row_number' %}</th><th style="width: 25%">{% trans 'row_name' %}</th><th style="width: 20%">{% trans 'row_form' %}</th><th style="width: 8%">{% trans 'row_unit' %}</th><th style="width: 13%">{% trans 'row_quantity' %}</th><th style="width: 14%">{% trans 'row_unit_price' %}</th><th style="width: 15%">{% trans 'row_total' %}</th></tr><tr><td>1</td><td>{% trans 'property_name', rid_type_human, rid_short_hash %}</td><td>{% trans 'property_form' %}</td><td>{% trans 'unit_piece' %}</td><td>1</td><td>{{ amount }}</td><td>{{ amount }}</td></tr><tr><td></td><td>{% trans 'total' %}</td><td></td><td></td><td>1</td><td></td><td>{{ amount }}</td></tr></tbody></table><p>{% trans 'confirmation' %}</p><p style="margin: 0px !important">{% trans 'member' %}: {{ user.full_name_or_short_name }}</p><p style="margin: 0px !important">{{ created_at }}</p><p>{% trans 'signed_electronically' %}</p><p style="margin: 0px !important"><strong>{% trans 'accepted' %}</strong></p><p style="margin: 0px !important">{% trans 'chairman_label' %}</p><p style="margin: 0px !important">{{ vars.short_abbr }} «{{ vars.name }}»</p><p style="margin: 0px !important">{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div>${EDUCATION_DOC_STYLE}`

export const translations = {
  ru: {
    ...educationContractDocTranslations,
    to_council: 'В Совет {0} «{1}»',
    from_member: 'от Пайщика {0}',
    statement_title: 'ЗАЯВЛЕНИЕ № ЗПВИ-{0}',
    body: 'В соответствии с условиями Договора об участии в хозяйственной деятельности № {0} от {1}, прошу принять от меня Паевой взнос в Общество следующим Имуществом:',
    name_label: 'Наименование',
    name_value: '{0} (задание № {1})',
    category_label: 'Категория Имущества',
    description_label: 'Описание, характеристики',
    description_value: 'Овеществленные на цифровых носителях и выраженные в денежной оценке объекты авторских прав и другие результаты интеллектуальной деятельности, включая неотъемлемое сопровождение их использования.',
    links_label: 'Ссылки на фото, видео и аудиоматериалы',
    guarantee_label: 'Гарантийные условия и срок действия',
    guarantee_value: 'Срок действия Гарантийных условий окончен; Имущество высвобождается из ответственного хранения в Обществе в соответствии с п. 3.1.7.2. Договора.',
    other_label: 'Прочие характеристики и описание',
    other_value: 'Запись на электронном носителе № {0}.',
    property_name: 'Имущество — {0}, запись на электронном носителе № {1}',
    confirmation: 'Я подтверждаю, что Имущество, которое я вношу паевым взносом в Общество, не противоречит и не нарушает законодательство РФ, принадлежит мне на праве собственности, в споре и под арестом не состоит.',
    accepted: '«ПРИНЯТО»',
  },
}

export const exampleData = {
  ...educationContractDocExample,
  meta: { created_at: '12.06.2026 12:00' },
  created_at: '12.06.2026 12:00',
  program: { name: 'ОБРАЗОВАНИЕ' },
  rid_hash: '0000abcd...',
  rid_short_hash: '0000ABCD',
  assignment_id: 7,
  amount: '15000.00 RUB',
  rid_type: 'lesson_recording',
  rid_type_human: 'Запись занятия',
  links: ['Видеозапись курса «Основы программирования», 12 занятий', 'https://example.org/course/7'],
}
