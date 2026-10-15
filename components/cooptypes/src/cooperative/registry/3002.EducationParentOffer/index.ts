import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import { buildEducationOffer, educationOfferExampleData } from '../educationOfferBody'

export const registry_id = 3002

/**
 * Экземпляр оферты ученика ЦПП «Образование» для конкретного пайщика
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

export const title = 'Пользовательское соглашение (оферта) ученика по присоединению к ЦПП «ОБРАЗОВАНИЕ»'
export const description = 'Оферта ученика по ЦПП «ОБРАЗОВАНИЕ», построенная на Положении о ЦПП'

const offer = buildEducationOffer({
  templateVarsField: 'education_parent_offer_template',
  subtitle: 'по присоединению пайщиков {0} «{1}» к целевой потребительской программе «ОБРАЗОВАНИЕ»',
  terms: {
    c2: '<strong>Участник</strong> - пайщик Общества, подтвердивший намерение участвовать в ЦПП фактом акцепта настоящего Пользовательского соглашения;',
  },
  extraFinalClauses: [
    'Акцептом настоящего Пользовательского соглашения Участник дает согласие на передачу адреса электронной почты Участника или несовершеннолетнего члена его семьи, для которого подключается Подписка, специализированному ресурсу, где обеспечивается использование Имущества, для организации доступа к Имуществу.',
  ],
})

export const context = offer.context

export const translations = offer.translations

export const exampleData = educationOfferExampleData
