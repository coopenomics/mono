export interface ITariff {
  /** Код тарифа сетки; у конфигурации сервера (старый провайдер) — instance_type_id строкой. */
  id: string
  /** Код тарифа сетки провайдера — уходит провайдеру при подписании соглашения. */
  code?: string
  name: string
  /** Предел числа пайщиков тарифа. */
  membersLimit?: number
  /** Цена тарифа в месяц, ₽ (сервер, поддержка, приложение, документооборот). */
  monthlyTotal?: number
  /** Цена тарифа за год, ₽; пусто — годовая оплата недоступна. */
  annualTotal?: number | null
  /** Выбранный период оплаты: month | year. */
  billingPeriod?: 'month' | 'year'
  /** Срок ответа поддержки платформы. */
  supportResponse?: string
  /** Объём документооборота на месяц, AXON. */
  docflowAxon?: number
  /** Суточный расход AXON при 30 днях: объём / 30. */
  dailyAxon?: number
  /** Отпускная цена с символом валюты: «1 660 ₽». */
  price: string
  /** Конфигурация сервера: «2 CPU · 4 ГБ RAM · 60 GB NVMe». */
  specs?: string
  /** Пробный период хостинга, дней (0 ₽ на этот срок). */
  trialDays?: number
  /** Ссылки в каталог провайдера — поедут в setup подписки. */
  instanceTypeId?: number
  subscriptionTypeId?: number
  additionalCosts?: string[]
}

export interface ICooperativeFormData {
  /** Чем занимается кооператив — уходит в `description` записи registrator.coops. */
  description: string
  announce: string
  initial: string
  minimum: string
  org_initial: string
  org_minimum: string
}

export interface IConnectionAgreementState {
  currentStep: number
  selectedTariff: ITariff | null
  isInitialized: boolean
  document?: any
  signedDocument?: any
  coop?: any
  formData?: ICooperativeFormData
  hasMatrixAccount?: boolean
}
