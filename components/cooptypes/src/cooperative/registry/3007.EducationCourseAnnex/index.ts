import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  EDUCATION_DOC_STYLE,
  educationContractDocExample,
  educationContractDocTranslations,
  educationRequisitesHtml,
} from '../educationContractDocs'

export const registry_id = 3007

/**
 * Приложение к договору УХД преподавателя по конкретному курсу
 * (ЦПП «Образование»), по форме приложения 1002 «Благороста»: стороны,
 * ссылка на договор с номером и датой, условия курса, реквизиты и подписи.
 * Подписывает преподаватель, вторую подпись ставит председатель.
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
  /** Дата договора УХД (дд.мм.гггг) — фабрика берёт из Udata. */
  contract_created_at: string
}

export const title = 'Приложение к договору об участии в хозяйственной деятельности по курсу'
export const description = 'Приложение к договору УХД преподавателя по конкретному курсу ЦПП «ОБРАЗОВАНИЕ»'

export const context = `<div class="digital-document"><div style="text-align: center"><h1 class="header">{% trans 'annex_title' %}</h1><p class="subheader">{% trans 'annex_subtitle', contract_number %}</p></div><p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p><p>{% trans 'annex_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, common_user.full_name_or_short_name, contract_number, contract_created_at %}</p><p>{% trans 'clause_1' %}</p><table><tbody><tr><th>{% trans 'course_label' %}</th><td>{{ course_title }}</td></tr><tr><th>{% trans 'schedule_label' %}</th><td>{{ schedule }}</td></tr><tr><th>{% trans 'expected_result_label' %}</th><td>{{ expected_result }}</td></tr><tr><th>{% trans 'period_label' %}</th><td>{% trans 'period_value', period_from, period_to %}</td></tr></tbody></table><p>{% trans 'clause_2' %}</p><p>{% trans 'clause_3' %}</p><div style="text-align: center"><h3>{% trans 'requisites_title' %}</h3></div>${educationRequisitesHtml('common_user')}</div>${EDUCATION_DOC_STYLE}`

export const translations = {
  ru: {
    ...educationContractDocTranslations,
    annex_title: 'ПРИЛОЖЕНИЕ',
    annex_subtitle: 'к Договору об участии в хозяйственной деятельности № {0}',
    annex_intro: '{0} «{1}» в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, далее именуемый «Общество», и {5}, далее именуемый(-ая) «Пайщик», совместно именуемые «Стороны», составили настоящее Приложение (далее — Приложение) к Договору об участии в хозяйственной деятельности № {6} от {7} (далее — Договор) о нижеследующем:',
    clause_1: '<strong>1.</strong> В соответствии с условиями Договора Пайщик принимает на себя обязательства, связанные с ведением курса, на следующих условиях:',
    course_label: 'Курс',
    schedule_label: 'Расписание',
    expected_result_label: 'Ожидаемый результат',
    period_label: 'Период ведения курса',
    period_value: 'с {0} по {1}',
    clause_2: '<strong>2.</strong> Настоящее Приложение использует термины и определения Договора (Раздел 1).',
    clause_3: '<strong>3.</strong> Настоящее Приложение является неотъемлемой частью Договора и вступает в силу с момента его подписания Сторонами.',
  },
}

export const exampleData = {
  ...educationContractDocExample,
  meta: { created_at: '12.06.2026 12:00' },
  common_user: educationContractDocExample.user,
  course_title: 'Основы программирования',
  schedule: 'вторник и четверг, 18:00',
  expected_result: 'слушатели выполняют итоговый проект',
  period_from: '01.09.2026',
  period_to: '31.12.2026',
}
