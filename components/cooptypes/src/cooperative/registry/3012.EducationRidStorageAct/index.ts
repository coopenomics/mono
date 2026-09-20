import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

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
}

export const title = 'Акт передачи материалов занятия на ответственное хранение'
export const description = 'Акт передачи преподавателем материалов проведённого занятия кооперативу на ответственное хранение на срок гарантии по ЦПП «Образование»'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid currentColor; padding: 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
ul { margin: 0; padding-left: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: center">
    <h1 class="header">{% trans 'act_title', rid_short_hash %}</h1>
    <p class="subheader">{% trans 'act_subtitle', program.name %}</p>
  </div>
  <p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>

  <p>{% trans 'act_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, user.full_name_or_short_name %}</p>

  <table>
    <tbody>
      <tr>
        <th>{% trans 'course_label' %}</th>
        <td>{{ course_title }}</td>
      </tr>
      <tr>
        <th>{% trans 'lesson_label' %}</th>
        <td>{% trans 'lesson_value', lesson_number, lesson_topic %}</td>
      </tr>
      <tr>
        <th>{% trans 'held_at_label' %}</th>
        <td>{% trans 'held_at_value', held_at, duration_minutes %}</td>
      </tr>
      <tr>
        <th>{% trans 'rid_type_label' %}</th>
        <td>{{ rid_type }}</td>
      </tr>
      <tr>
        <th>{% trans 'materials_label' %}</th>
        <td>
          <ul>
            {% for material in materials %}<li>{{ material }}</li>{% endfor %}
          </ul>
        </td>
      </tr>
      <tr>
        <th>{% trans 'rid_hash_label' %}</th>
        <td>{{ rid_hash }}</td>
      </tr>
      <tr>
        <th>{% trans 'amount_label' %}</th>
        <td>{{ amount }}</td>
      </tr>
    </tbody>
  </table>

  <p>{% trans 'storage_note', hold_until %}</p>
  <p>{% trans 'contribution_note' %}</p>
  <p>{% trans 'guarantee_note' %}</p>

  <table>
    <tbody>
      <tr>
        <th>{% trans 'transferred' %}</th>
        <td>{% trans 'teacher_label' %} {{ user.full_name_or_short_name }}</td>
        <td>{% trans 'signature_placeholder' %}</td>
      </tr>
    </tbody>
  </table>
</div>
`

export const translations = {
  ru: {
    act_title: 'АКТ № ОХ-{0}',
    act_subtitle: 'передачи материалов занятия на ответственное хранение по Целевой Потребительской Программе «{0}»',
    act_intro: '{0} «{1}» (далее Общество) в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, с одной стороны, и пайщик Общества {5} (далее Преподаватель), с другой стороны, составили настоящий Акт о том, что Преподаватель передал, а Общество приняло на ответственное хранение материалы проведённого занятия:',
    course_label: 'Курс',
    lesson_label: 'Занятие',
    lesson_value: '№ {0}, {1}',
    held_at_label: 'Дата и длительность',
    held_at_value: '{0}, {1} минут',
    rid_type_label: 'Вид результата',
    materials_label: 'Состав материалов',
    rid_hash_label: 'Идентификатор материалов',
    amount_label: 'Оценка материалов',
    storage_note: 'Общество принимает материалы на ответственное хранение до {0} включительно и обеспечивает их сохранность в течение этого срока.',
    contribution_note: 'Право собственности на материалы сохраняется за Преподавателем. Паевым взносом материалы становятся по заявлению Преподавателя и решению Совета, принятому по истечении срока хранения, и оформляются отдельным актом приёма-передачи.',
    guarantee_note: 'Гарантийный случай, подтверждённый в течение срока хранения, прекращает хранение: материалы возвращаются Преподавателю, паевой взнос по ним не оформляется.',
    transferred: 'ПЕРЕДАЛ',
    teacher_label: 'Преподаватель',
    signature_placeholder: 'Подписано электронной подписью',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: {
    city: 'Москва',
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
    short_abbr: 'ПК',
  },
  user: { full_name_or_short_name: 'Петров Пётр Петрович' },
  program: { name: 'ОБРАЗОВАНИЕ' },
  rid_hash: '0000abcd...',
  rid_short_hash: '0000ABCD',
  amount: '1500.00 RUB',
  rid_type: 'lesson',
  course_title: 'Математика, 7 класс',
  lesson_number: 3,
  lesson_topic: 'Линейные уравнения',
  held_at: '12.06.2026 10:00',
  duration_minutes: 45,
  materials: ['https://cloud.example/lesson-3.mp4', 'https://cloud.example/lesson-3.pdf'],
  hold_until: '26.06.2026',
}
