import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

const rawWorkingHoursBreakSelector = {
  start: true,
  end: true,
}

const _validateWorkingHoursBreak: MakeAllFieldsRequired<ValueTypes['WorkingHoursBreak']> = rawWorkingHoursBreakSelector

export const workingHoursBreakSelector = Selector('WorkingHoursBreak')(rawWorkingHoursBreakSelector)

const rawWorkingHoursDaySelector = {
  open: true,
  close: true,
  breaks: rawWorkingHoursBreakSelector,
}

const _validateWorkingHoursDay: MakeAllFieldsRequired<ValueTypes['WorkingHoursDay']> = rawWorkingHoursDaySelector

export const workingHoursDaySelector = Selector('WorkingHoursDay')(rawWorkingHoursDaySelector)

const rawWorkingHoursSelector = {
  mon: rawWorkingHoursDaySelector,
  tue: rawWorkingHoursDaySelector,
  wed: rawWorkingHoursDaySelector,
  thu: rawWorkingHoursDaySelector,
  fri: rawWorkingHoursDaySelector,
  sat: rawWorkingHoursDaySelector,
  sun: rawWorkingHoursDaySelector,
}

const _validateWorkingHours: MakeAllFieldsRequired<ValueTypes['WorkingHours']> = rawWorkingHoursSelector

export const workingHoursSelector = Selector('WorkingHours')(rawWorkingHoursSelector)

const rawMarketplaceKUDetailsSelector = {
  coopname: true,
  coreBraname: true,
  name: true,
  addressFull: true,
  contactPhone: true,
  contactEmail: true,
  workingHours: rawWorkingHoursSelector,
  description: true,
  status: true,
  lat: true,
  lng: true,
  geocodeStatus: true,
  geocodeErrorMessage: true,
  geocodedAt: true,
  createdAt: true,
  updatedAt: true,
}

const _validateMarketplaceKUDetails: MakeAllFieldsRequired<ValueTypes['MarketplaceKUDetails']> = rawMarketplaceKUDetailsSelector

export const marketplaceKUDetailsSelector = Selector('MarketplaceKUDetails')(rawMarketplaceKUDetailsSelector)
