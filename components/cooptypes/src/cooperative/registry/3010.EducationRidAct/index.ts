import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

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
}

export const title = 'Акт приёма-передачи паевого взноса результатом интеллектуальной деятельности'
export const description = 'Акт приёма-передачи паевого взноса преподавателя результатом интеллектуальной деятельности по ЦПП «Образование» (подписывают преподаватель и председатель)'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid currentColor; padding: 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
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
        <th>{% trans 'rid_type_label' %}</th>
        <td>{{ rid_type }}</td>
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

  <p>{% trans 'no_claims' %}</p>
  <p>{% trans 'accounting_note', amount %}</p>

  <table>
    <tbody>
      <tr>
        <th>{% trans 'transferred' %}</th>
        <td>{% trans 'teacher_label' %} {{ user.full_name_or_short_name }}</td>
        <td>{% trans 'signature_placeholder' %}</td>
      </tr>
      <tr>
        <th>{% trans 'received' %}</th>
        <td>{% trans 'chairman_label' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</td>
        <td>{% trans 'signature_placeholder' %}</td>
      </tr>
    </tbody>
  </table>
</div>
`

export const translations = {
  ru: {
    act_title: 'АКТ № АПП-{0}',
    act_subtitle: 'приёма-передачи паевого взноса результатом интеллектуальной деятельности по Целевой Потребительской Программе «{0}»',
    act_intro: '{0} «{1}» (далее Общество) в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, с одной стороны, и пайщик Общества {5} (далее Преподаватель), с другой стороны, составили настоящий Акт о том, что Преподаватель передал, а Общество приняло в качестве паевого взноса результат интеллектуальной деятельности:',
    rid_type_label: 'Тип результата',
    rid_hash_label: 'Идентификатор взноса',
    amount_label: 'Стоимость',
    no_claims: 'Претензий по составу и качеству переданного результата Общество не имеет.',
    accounting_note: 'Паевой взнос в размере {0} учитывается на лицевом счёте Преподавателя с момента подписания настоящего Акта обеими сторонами.',
    transferred: 'ПЕРЕДАЛ',
    received: 'ПРИНЯЛ',
    teacher_label: 'Преподаватель',
    chairman_label: 'Председатель Совета',
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
  amount: '15000.00 RUB',
  rid_type: 'lesson',
}
