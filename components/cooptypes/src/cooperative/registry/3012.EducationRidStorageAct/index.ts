import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  EDUCATION_ANNEX_HEAD_HTML,
  EDUCATION_DOC_STYLE,
  educationContractDocExample,
  educationContractDocTranslations,
} from '../educationContractDocs'

export const registry_id = 3012

/**
 * Акт передачи материалов занятия на ответственное хранение (ЦПП
 * «Образование», процесс p.edu.rid).
 *
 * Преподаватель подписывает акт вместе с отчётом по занятию: кооператив
 * принимает материалы как имущество и держит их весь гарантийный срок курса,
 * а паевым взносом они становятся позже — по заявлению преподавателя (3008),
 * решению совета (3009) и акту приёма-передачи (3010). Уходит параметром
 * `act` действия `edubridge::holdrid`; денежно ему соответствует операция
 * o.edu.hold (ISSUE в w.edu.hold, Дт 08 / Кт 76).
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Канонический идентификатор материалов on-chain. */
  rid_hash: string
  /** Оценка материалов, с валютой. */
  amount: string
  /** Вид результата (eosio::name). */
  rid_type: string
  /** Название курса, по которому проведено занятие. */
  course_title: string
  /** Номер занятия в программе курса. */
  lesson_number: number
  /** Тема занятия. */
  lesson_topic: string
  /** Дата и время занятия. */
  held_at: string
  /** Длительность занятия, минут. */
  duration_minutes: number
  /** Перечень материалов: ссылки на записи, конспекты, задания. */
  materials: string[]
  /** Дата окончания гарантийного срока по материалам. */
  hold_until: string
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
  course_title: string
  lesson_number: number
  lesson_topic: string
  held_at: string
  duration_minutes: number
  materials: string[]
  hold_until: string
  /** Номер договора УХД преподавателя — фабрика берёт из Udata. */
  contract_number: string
  /** Дата договора УХД (дд.мм.гггг). */
  contract_created_at: string
  /** Вид результата словами. */
  rid_type_human: string
}

export const title = 'Акт передачи материалов занятия на ответственное хранение'
export const description = 'Акт приема-передачи Имущества преподавателя на ответственное хранение по договору УХД ЦПП «ОБРАЗОВАНИЕ»'

export const context = `<div class="digital-document">${EDUCATION_ANNEX_HEAD_HTML}<div style="text-align: center; padding-top: 15px"><h1 class="header">{% trans 'act_title', rid_short_hash %}</h1><p class="subheader">{% trans 'act_subtitle', contract_number, contract_created_at %}</p></div><p style="margin: 0px !important">{% trans 'city', coop.city %}</p><p>{% trans 'date', created_at %}</p><p>{% trans 'act_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, user.full_name_or_short_name, contract_number, contract_created_at %}</p><table><tbody><tr><th style="width: 5%">{% trans 'row_number' %}</th><th style="width: 25%">{% trans 'row_name' %}</th><th style="width: 20%">{% trans 'row_form' %}</th><th style="width: 8%">{% trans 'row_unit' %}</th><th style="width: 13%">{% trans 'row_quantity' %}</th><th style="width: 14%">{% trans 'row_unit_price' %}</th><th style="width: 15%">{% trans 'row_total' %}</th></tr><tr><td>1</td><td>{% trans 'property_name', rid_type_human, rid_short_hash %}</td><td>{% trans 'property_form' %}</td><td>{% trans 'unit_piece' %}</td><td>1</td><td>{{ amount }}</td><td>{{ amount }}</td></tr><tr><td></td><td>{% trans 'total' %}</td><td></td><td></td><td>1</td><td></td><td>{{ amount }}</td></tr></tbody></table><table><tbody><tr><th>{% trans 'course_label' %}</th><td>{{ course_title }}</td></tr><tr><th>{% trans 'lesson_label' %}</th><td>{% trans 'lesson_value', lesson_number, lesson_topic %}</td></tr><tr><th>{% trans 'held_at_label' %}</th><td>{% trans 'held_at_value', held_at, duration_minutes %}</td></tr><tr><th>{% trans 'materials_label' %}</th><td><ul>{% for material in materials %}<li>{{ material }}</li>{% endfor %}</ul></td></tr></tbody></table><p>{% trans 'storage_note', hold_until %}</p><p>{% trans 'contribution_note' %}</p><p>{% trans 'guarantee_note' %}</p><table><tbody><tr><th>{% trans 'transferred' %}</th><td>{% trans 'member' %}: {{ user.full_name_or_short_name }}</td><td>{% trans 'signed_electronically' %}</td></tr></tbody></table></div>${EDUCATION_DOC_STYLE}`

export const translations = {
  ru: {
    ...educationContractDocTranslations,
    act_title: 'АКТ № АППИОХ-{0}',
    act_subtitle: 'приема-передачи Имущества в соответствии с дополнительными условиями по ответственному хранению Имущества согласно Договора об участии в хозяйственной деятельности № {0} от {1}',
    city: 'г. {0}',
    date: 'Дата: {0}',
    act_intro: '{0} «{1}» (далее «Общество») в лице Председателя Совета Общества {2} {3} {4}, и Пайщик {5}, составили настоящий Акт о том, что Пайщик передал, а Общество получило от Пайщика, в соответствии с дополнительными условиями по ответственному хранению Имущества согласно Договора об участии в хозяйственной деятельности № {6} от {7}, следующее Имущество:',
    property_name: 'Имущество — {0}, запись на электронном носителе № {1}',
    course_label: 'Курс',
    lesson_label: 'Занятие',
    lesson_value: '№ {0}, {1}',
    held_at_label: 'Дата и длительность',
    held_at_value: '{0}, {1} минут',
    materials_label: 'Состав материалов (ссылки на фото, видео и аудиоматериалы)',
    storage_note: 'Общество принимает Имущество на ответственное хранение на срок действия Гарантийных условий — до {0} включительно — и обеспечивает его сохранность в течение этого срока (п. 3.1.7.1. Договора).',
    contribution_note: 'По окончании срока действия Гарантийных условий Пайщик направляет в Общество заявление на внесение Паевого взноса Имуществом, высвобождаемым из ответственного хранения; Паевой взнос оформляется решением Совета Общества и Актом приема-передачи Имущества (пп. 3.1.7.2., 3.1.8. и 3.1.9. Договора).',
    guarantee_note: 'При наступлении Гарантийного случая, подтвержденного в течение срока хранения, Имущество высвобождается из ответственного хранения и возвращается Пайщику; Паевой взнос по нему не оформляется (п. 4.1. Договора).',
    transferred: 'ПЕРЕДАНО:',
  },
}

export const exampleData = {
  ...educationContractDocExample,
  meta: { created_at: '12.06.2026 12:00' },
  created_at: '12.06.2026 12:00',
  program: { name: 'ОБРАЗОВАНИЕ' },
  rid_hash: '0000abcd...',
  rid_short_hash: '0000ABCD',
  amount: '1500.00 RUB',
  rid_type: 'lesson_recording',
  rid_type_human: 'Запись занятия',
  course_title: 'Математика, 7 класс',
  lesson_number: 3,
  lesson_topic: 'Линейные уравнения',
  held_at: '12.06.2026 10:00',
  duration_minutes: 45,
  materials: ['https://cloud.example/lesson-3.mp4', 'https://cloud.example/lesson-3.pdf'],
  hold_until: '26.06.2026',
}
