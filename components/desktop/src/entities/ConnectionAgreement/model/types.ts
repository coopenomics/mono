export interface ITariff {
  /** id конфигурации (instance_type_id провайдера) строкой. */
  id: string
  name: string
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
