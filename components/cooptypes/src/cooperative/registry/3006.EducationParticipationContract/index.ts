import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3006

/**
 * Экземпляр договора об участии преподавателя в хозяйственной деятельности
 * (УХД) по ЦПП «Образование». Рендерится из шаблона 3005 с подстановкой
 * ФИО; подписывает преподаватель. Номер и дату договора вычисляет бэкенд
 * edubridge и передаёт явно.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Номер договора УХД. */
  /** Явно — при подписи со стола; иначе фабрика берёт из Udata */
  contract_number?: string
  /** Дата договора (дд.мм.гггг). */
  contract_created_at?: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  contract_number: string
  contract_created_at: string
}

export const title = 'Договор об участии в хозяйственной деятельности по ЦПП «ОБРАЗОВАНИЕ»'
export const description = 'Договор УХД преподавателя по ЦПП «ОБРАЗОВАНИЕ» по утверждённому шаблону'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
h3 { margin: 0px; padding-top: 15px; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: center">
    <h1 class="header">{% trans 'CONTRACT_TITLE', contract_number %}</h1>
    <p class="subheader">{% trans 'contract_subtitle' %}</p>
  </div>
  <p style="text-align: right">{{ contract_created_at }}, {{ coop.city }}</p>

  <p>{% trans 'contract_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, common_user.full_name_or_short_name %}</p>

  <h3>{% trans 'c1' %}</h3>
  <p>{% trans 'c1_1' %}</p>
  <p>{% trans 'c1_2' %}</p>

  <h3>{% trans 'c2' %}</h3>
  <p>{% trans 'c2_1' %}</p>
  <p>{% trans 'c2_2' %}</p>
  <p>{% trans 'c2_3' %}</p>

  <h3>{% trans 'c3' %}</h3>
  <p>{% trans 'c3_1' %}</p>

  <p>{% trans 'society_label' %} {{ vars.short_abbr }} «{{ vars.name }}», {% trans 'chairman_label' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p>
  <p>{% trans 'teacher_label' %} {{ common_user.full_name_or_short_name }}</p>
  <p>{% trans 'signature_placeholder' %}</p>
  <p>{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    CONTRACT_TITLE: 'ДОГОВОР № {0}',
    contract_subtitle: 'об участии в хозяйственной деятельности по целевой потребительской программе «Образование»',
    contract_intro: '{0} «{1}» (далее Общество) в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, с одной стороны, и пайщик Общества {5} (далее Преподаватель), с другой стороны, заключили настоящий Договор о нижеследующем:',
    c1: '1. Предмет договора',
    c1_1: '<strong>1.1.</strong> Преподаватель участвует в хозяйственной деятельности Общества по ЦПП «Образование»: ведёт курсы для Слушателей на условиях, определяемых приложениями к настоящему Договору.',
    c1_2: '<strong>1.2.</strong> Условия каждого курса (наименование, расписание, ожидаемый результат, период) оформляются отдельным приложением к Договору.',
    c2: '2. Паевой взнос результатом интеллектуальной деятельности',
    c2_1: '<strong>2.1.</strong> Результаты интеллектуальной деятельности, созданные Преподавателем при ведении курса, передаются Обществу в качестве паевого взноса по заявлению Преподавателя.',
    c2_2: '<strong>2.2.</strong> Стоимость паевого взноса определяется решением Совета и фиксируется актом приёма-передачи, подписываемым Преподавателем и Председателем Совета.',
    c2_3: '<strong>2.3.</strong> Паевой взнос учитывается на лицевом счёте Преподавателя и возвращается в порядке, установленном Уставом Общества.',
    c3: '3. Срок действия',
    c3_1: '<strong>3.1.</strong> Договор вступает в силу с момента подписания и действует до его расторжения любой из сторон.',
    society_label: 'Общество:',
    chairman_label: 'Председатель Совета',
    teacher_label: 'Преподаватель:',
    signature_placeholder: 'Подписано электронной подписью.',
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
  common_user: { full_name_or_short_name: 'Петров Пётр Петрович' },
  contract_number: 'УХД-0001',
  contract_created_at: '12.06.2026',
}
