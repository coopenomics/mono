import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  EDUCATION_DOC_STYLE,
  educationContractDocExample,
  educationContractDocTranslations,
} from '../educationContractDocs'

export const registry_id = 3013

/**
 * Заявление пайщика-ученика об аннулировании Подписки по Гарантийным условиям
 * (ЦПП «Образование», пункт 4.4.2 Положения). Называет Подписку, дату её
 * подключения, списанную стоимость, срок Гарантийных условий и причину.
 * Далее Совет принимает решение (3014) и возвращает стоимость на баланс ЦК.
 * Приложением к договору УХД документ не является — шапки приложения нет.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Идентификатор заявления об аннулировании Подписки. */
  claim_hash: string
  /** Наименование Подписки (курса). */
  course_title: string
  /** Дата подключения Подписки (дд.мм.гггг). */
  subscribed_at: string
  /** Уплаченная стоимость Подписки, с валютой. */
  amount: string
  /** Дата окончания Гарантийных условий (дд.мм.гггг). */
  guarantee_until: string
  /** Причина аннулирования Подписки. */
  reason: string
  /** Ссылки на материалы, подтверждающие причину; список может быть пустым. */
  links: string[]
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  claim_hash: string
  /** Короткий номер заявления — фабрика берёт первые 8 символов claim_hash. */
  claim_short_hash: string
  course_title: string
  subscribed_at: string
  amount: string
  guarantee_until: string
  reason: string
  links: string[]
}

export const title = 'Заявление об аннулировании Подписки по Гарантийным условиям'
export const description = 'Заявление пайщика об аннулировании Подписки по Гарантийным условиям ЦПП «ОБРАЗОВАНИЕ»'

export const context = `<div class="digital-document"><div style="text-align: right"><p style="margin: 0px !important">{% trans 'to_council', vars.full_abbr_genitive, vars.name %}</p><p style="margin: 0px !important">{% trans 'from_member', user.full_name_or_short_name %}</p></div><div style="text-align: center"><h1 class="header">{% trans 'statement_title', claim_short_hash %}</h1><p class="subheader">{% trans 'statement_subtitle' %}</p></div><p>{% trans 'body', vars.education_provision.protocol_number, vars.education_provision.protocol_day_month_year %}</p><table><tbody><tr><th>{% trans 'subscription_label' %}</th><td>{{ course_title }}</td></tr><tr><th>{% trans 'subscribed_at_label' %}</th><td>{{ subscribed_at }}</td></tr><tr><th>{% trans 'amount_label' %}</th><td>{{ amount }}</td></tr><tr><th>{% trans 'guarantee_label' %}</th><td>{% trans 'guarantee_value', guarantee_until %}</td></tr></tbody></table><p>{% trans 'reason_label' %}</p><p>{{ reason }}</p>{% if links.length %}<p>{% trans 'links_label' %}</p><ul>{% for link in links %}<li>{{ link }}</li>{% endfor %}</ul>{% endif %}<p>{% trans 'request' %}</p><p style="margin: 0px !important">{% trans 'member' %}: {{ user.full_name_or_short_name }}</p><p style="margin: 0px !important">{{ created_at }}</p><p>{% trans 'signed_electronically' %}</p></div>${EDUCATION_DOC_STYLE}`

export const translations = {
  ru: {
    ...educationContractDocTranslations,
    to_council: 'В Совет {0} «{1}»',
    from_member: 'от Пайщика {0}',
    statement_title: 'ЗАЯВЛЕНИЕ № ЗАП-{0}',
    statement_subtitle: 'об аннулировании Подписки по Гарантийным условиям',
    body: 'В соответствии с пунктом 4.4.2 Положения о целевой потребительской программе «ОБРАЗОВАНИЕ», утверждённого решением Совета Общества (протокол от {1} № {0}) (далее — Положение), прошу аннулировать Подписку:',
    subscription_label: 'Наименование Подписки',
    subscribed_at_label: 'Дата подключения Подписки',
    amount_label: 'Стоимость Подписки, списанная в соответствии с пунктом 4.2.2 Положения',
    guarantee_label: 'Срок действия Гарантийных условий',
    guarantee_value: 'до {0}',
    reason_label: 'Причина аннулирования Подписки:',
    links_label: 'Материалы, подтверждающие причину:',
    request: 'Прошу возвратить стоимость Подписки на баланс моего ЦК в соответствии с пунктом 4.4.4 Положения.',
  },
}

export const exampleData = {
  ...educationContractDocExample,
  meta: { created_at: '12.06.2026 12:00' },
  created_at: '12.06.2026 12:00',
  vars: {
    ...educationContractDocExample.vars,
    education_provision: { protocol_number: 'СС-01-09-26', protocol_day_month_year: '01 сентября 2026 г.' },
  },
  claim_hash: '0000abcd...',
  claim_short_hash: '0000ABCD',
  course_title: 'Основы программирования',
  subscribed_at: '01.06.2026',
  amount: '1000.00 RUB',
  guarantee_until: '15.06.2026',
  reason: 'Содержание занятий не соответствует заявленной программе курса.',
  links: ['https://example.org/course/7/program', 'https://example.org/course/7/lesson-2'],
}
