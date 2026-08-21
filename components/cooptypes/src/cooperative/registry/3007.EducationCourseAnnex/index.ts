import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3007

/**
 * Приложение к договору УХД преподавателя по конкретному курсу
 * (ЦПП «Образование»). Подписывает преподаватель. Фиксирует название курса,
 * расписание, ожидаемый результат и период ведения.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Номер договора УХД, к которому составлено приложение. */
  contract_number: string
  /** Название курса. */
  course_title: string
  /** Расписание занятий (свободный текст). */
  schedule: string
  /** Ожидаемый результат курса. */
  expected_result: string
  /** Начало периода ведения курса (дд.мм.гггг). */
  period_from: string
  /** Окончание периода ведения курса (дд.мм.гггг). */
  period_to: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  contract_number: string
  course_title: string
  schedule: string
  expected_result: string
  period_from: string
  period_to: string
}

export const title = 'Приложение к договору об участии в хозяйственной деятельности по курсу'
export const description = 'Приложение к договору УХД преподавателя по конкретному курсу ЦПП «ОБРАЗОВАНИЕ»'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: right">
    <p style="margin: 0">{% trans 'annex_to_contract', contract_number %}</p>
  </div>

  <div style="text-align: center">
    <h1 class="header">{% trans 'ANNEX_TITLE' %}</h1>
    <p class="subheader">{% trans 'annex_subtitle' %}</p>
  </div>

  <p>{% trans 'annex_intro', vars.full_abbr, vars.name, common_user.full_name_or_short_name %}</p>

  <p>{% trans 'course_title_label' %} {{ course_title }}</p>
  <p>{% trans 'schedule_label' %} {{ schedule }}</p>
  <p>{% trans 'expected_result_label' %} {{ expected_result }}</p>
  <p>{% trans 'period_label', period_from, period_to %}</p>

  <p>{% trans 'annex_footer' %}</p>

  <p>{% trans 'teacher_label' %} {{ common_user.full_name_or_short_name }}</p>
  <p>{% trans 'signature_placeholder' %}</p>
  <p>{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    annex_to_contract: 'Приложение к Договору УХД № {0}',
    ANNEX_TITLE: 'ПРИЛОЖЕНИЕ',
    annex_subtitle: 'об условиях ведения курса по целевой потребительской программе «Образование»',
    annex_intro: '{0} «{1}» (далее Общество) и Преподаватель {2} согласовали условия ведения курса:',
    course_title_label: 'Курс:',
    schedule_label: 'Расписание:',
    expected_result_label: 'Ожидаемый результат:',
    period_label: 'Период ведения курса: с {0} по {1}.',
    annex_footer: 'Настоящее Приложение является неотъемлемой частью Договора об участии в хозяйственной деятельности.',
    teacher_label: 'Преподаватель:',
    signature_placeholder: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: { city: 'Москва' },
  vars: {
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
  },
  common_user: { full_name_or_short_name: 'Петров Пётр Петрович' },
  contract_number: 'УХД-0001',
  course_title: 'Основы программирования',
  schedule: 'вторник и четверг, 18:00',
  expected_result: 'слушатели выполняют итоговый проект',
  period_from: '01.09.2026',
  period_to: '31.12.2026',
}
