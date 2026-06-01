// Типы marketplace-детализации существующих в core кооперативных участков.
// Зеркало KuDetailsDTO из controller'а; SDK обёртки в @coopenomics/sdk
// (Mutations.Marketplace.DetailKU/SetKUStatus/RetryKUGeocode +
// Queries.Marketplace.ListKUDetails).

export type KuDetailsStatus = 'ACTIVE' | 'INACTIVE'
export type GeocodeStatus = 'PENDING' | 'OK' | 'FAILED'

export interface IWorkingHoursBreak {
  start: string
  end: string
}

export interface IWorkingHoursDay {
  open: string
  close: string
  breaks: IWorkingHoursBreak[]
}

export interface IWorkingHours {
  mon?: IWorkingHoursDay
  tue?: IWorkingHoursDay
  wed?: IWorkingHoursDay
  thu?: IWorkingHoursDay
  fri?: IWorkingHoursDay
  sat?: IWorkingHoursDay
  sun?: IWorkingHoursDay
}

export interface IMarketplaceKUDetails {
  coopname: string
  coreBraname: string
  // Реквизиты участка резолвятся бэкендом живьём из организации участка
  // (единый источник правды), поэтому nullable.
  name?: string
  addressFull?: string
  contactPhone?: string
  contactEmail?: string
  workingHours: IWorkingHours
  description?: string
  status: KuDetailsStatus
  lat?: number
  lng?: number
  geocodeStatus: GeocodeStatus
  geocodeErrorMessage?: string
  geocodedAt?: string
  createdAt: string
  updatedAt: string
}

export interface IDetailKUInput {
  coopname: string
  coreBraname: string
  workingHours: IWorkingHours
  description?: string
}

export interface ISetKUStatusInput {
  coopname: string
  coreBraname: string
  status: KuDetailsStatus
}

export interface IListMarketplaceKUInput {
  coopname: string
  onlyActive?: boolean
}
