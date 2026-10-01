import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import { buildEducationOffer, educationOfferExampleData } from '../educationOfferBody'

export const registry_id = 3004

/**
 * Экземпляр оферты преподавателя ЦПП «Образование» для конкретного пайщика
 * (совет утверждает этот же шаблон в бланке, с прочерками на месте данных пайщика). Подписывает пайщик.
 * Номер и дату соглашения вычисляет бэкенд edubridge и передаёт явно.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Персональный номер соглашения. */
  /** Явно — при подписи со стола; иначе фабрика берёт из Udata */
  agreement_number?: string
  /** Дата соглашения (дд.мм.гггг). */
  agreement_created_at?: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  agreement_number: string
  agreement_created_at: string
}

export const title = 'Пользовательское соглашение (оферта) преподавателя по присоединению к ЦПП «ОБРАЗОВАНИЕ»'
export const description = 'Оферта преподавателя по ЦПП «ОБРАЗОВАНИЕ», построенная на Положении о ЦПП'

const offer = buildEducationOffer({
  templateVarsField: 'education_teacher_offer_template',
  subtitle: 'по присоединению пайщиков-преподавателей {0} «{1}» к целевой потребительской программе «ОБРАЗОВАНИЕ»',
  preambleNote: 'Пайщик соглашается с условиями ЦПП, действуя в качестве Преподавателя. Поставка Имущества Обществу и сопровождение его использования осуществляются Пайщиком на основании отдельного Договора об участии в хозяйственной деятельности с Обществом и настоящим Пользовательским соглашением не регулируются.',
  terms: {
    c2: '<strong>Участник</strong> - пайщик Общества, подтвердивший намерение участвовать в ЦПП фактом акцепта настоящего Пользовательского соглашения;',
    c14: '<strong>Преподаватель</strong> — пайщик Общества, поставляющий Имущество Обществу и сопровождающий его использование на основании отдельного Договора об участии в хозяйственной деятельности с Обществом. Взаимодействие Преподавателя с Обществом по поставке Имущества и сопровождению его использования настоящим Пользовательским соглашением не регулируется.',
  },
})

export const context = offer.context

export const translations = offer.translations

export const exampleData = educationOfferExampleData
