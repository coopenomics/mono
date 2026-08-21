import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 3005

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

/**
 * Шаблон договора об участии преподавателя в хозяйственной деятельности
 * (УХД) по ЦПП «Образование» для утверждения Советом. ФИО и номер прочерки.
 * Аналог 997.GenerationContractTemplate. РЫБА.
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
}

export const title = 'Договор об участии в хозяйственной деятельности по ЦПП «ОБРАЗОВАНИЕ»'
export const description = 'Шаблон договора УХД преподавателя по ЦПП «ОБРАЗОВАНИЕ» для утверждения Советом'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
h3 { margin: 0px; padding-top: 15px; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: center">
    <h1 class="header">{% trans 'CONTRACT_TITLE' %}</h1>
    <p class="subheader">{% trans 'contract_subtitle' %}</p>
  </div>

  <p>{% trans 'contract_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}</p>

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
  <p>{% trans 'teacher_label' %} ______</p>
</div>
`

export const translations = {
  ru: {
    CONTRACT_TITLE: 'ДОГОВОР № ______',
    contract_subtitle: 'об участии в хозяйственной деятельности по целевой потребительской программе «Образование»',
    contract_intro: '{0} «{1}» (далее Общество) в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, с одной стороны, и пайщик Общества ______ (далее Преподаватель), с другой стороны, заключили настоящий Договор о нижеследующем:',
    c1: '1. Предмет договора',
    c1_1: '<strong>1.1.</strong> Преподаватель участвует в хозяйственной деятельности Общества по ЦПП «Образование»: ведёт курсы для Слушателей на условиях, определяемых приложениями к настоящему Договору.',
    c1_2: '<strong>1.2.</strong> Условия каждого курса (наименование, расписание, ожидаемый результат, период) оформляются отдельным приложением к Договору.',
    c2: '2. Паевой взнос результатом интеллектуальной деятельности',
    c2_1: '<strong>2.1.</strong> Результаты интеллектуальной деятельности, созданные Преподавателем при ведении курса, передаются Обществу в качестве паевого взноса по заявлению Преподавателя.',
    c2_2: '<strong>2.2.</strong> Стоимость паевого взноса определяется решением Совета и фиксируется актом приёма-передачи, подписываемым Преподавателем и Председателем Совета.',
    c2_3: '<strong>2.3.</strong> Паевой взнос учитывается на лицевом счёте Преподавателя и возвращается в порядке, установленном Уставом Общества.',
    c3: '3. Срок действия',
    c3_1: '<strong>3.1.</strong> Договор вступает в силу с момента подписания и действует до его расторжения любой из сторон с уведомлением за ______ дней.',
    society_label: 'Общество:',
    chairman_label: 'Председатель Совета',
    teacher_label: 'Преподаватель:',
  },
}

export const exampleData = {
  coop: {
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
}
