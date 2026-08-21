import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3008

/**
 * Заявление преподавателя о внесении паевого взноса результатом
 * интеллектуальной деятельности (РИД) по ЦПП «Образование»
 * (процесс p.edu.rid, шаг `edubridge::submitrid`). Подписывает преподаватель;
 * далее Совет принимает решение (3009) и стороны подписывают акт (3010).
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
}

export const title = 'Заявление о внесении паевого взноса результатом интеллектуальной деятельности'
export const description = 'Заявление преподавателя о внесении паевого взноса результатом интеллектуальной деятельности по ЦПП «Образование»'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: right">
    <p style="margin: 0">{% trans 'v_soviet' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
    <p style="margin: 0">{% trans 'from_member' %} {{ user.full_name_or_short_name }}</p>
  </div>

  <div style="text-align: center">
    <h1 class="header">{% trans 'statement_title' %}</h1>
    <p class="subheader">{% trans 'statement_subheader', program.name %}</p>
  </div>

  <p>{% trans 'body', amount, program.name, assignment_id, rid_type %}</p>

  <p>{% trans 'links_label' %}</p>
  {% for link in links %}
  <p>{{ link }}</p>
  {% endfor %}

  <p>{% trans 'rid_hash_label' %} {{ rid_hash }}</p>

  <p>{% trans 'signature' %}</p>
  <p>{{ user.full_name_or_short_name }}</p>
  <p>{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_member: 'от пайщика',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о внесении паевого взноса результатом интеллектуальной деятельности по Целевой Потребительской Программе «{0}»',
    body: 'Прошу принять в паевой фонд в качестве моего паевого взноса стоимостью {0} результат интеллектуальной деятельности, созданный мной по Целевой Потребительской Программе «{1}» (задание № {2}, тип результата: {3}).',
    links_label: 'Описание и ссылки на передаваемый результат:',
    rid_hash_label: 'Идентификатор взноса:',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: { full_name_or_short_name: 'Петров Пётр Петрович' },
  program: { name: 'ОБРАЗОВАНИЕ' },
  rid_hash: '0000abcd...',
  assignment_id: 7,
  amount: '15000.00 RUB',
  rid_type: 'lesson',
  links: ['Видеозапись курса «Основы программирования», 12 занятий', 'https://example.org/course/7'],
}
