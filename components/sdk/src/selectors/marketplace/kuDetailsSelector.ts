import { Selector } from '../../zeus/index'

export const workingHoursBreakSelector = Selector('WorkingHoursBreak')({
  start: true,
  end: true,
})

export const workingHoursDaySelector = Selector('WorkingHoursDay')({
  open: true,
  close: true,
  breaks: workingHoursBreakSelector,
})

export const workingHoursSelector = Selector('WorkingHours')({
  mon: workingHoursDaySelector,
  tue: workingHoursDaySelector,
  wed: workingHoursDaySelector,
  thu: workingHoursDaySelector,
  fri: workingHoursDaySelector,
  sat: workingHoursDaySelector,
  sun: workingHoursDaySelector,
})

export const marketplaceKUDetailsSelector = Selector('MarketplaceKUDetails')({
  coopname: true,
  coreBraname: true,
  addressFull: true,
  contactPhone: true,
  contactEmail: true,
  workingHours: workingHoursSelector,
  description: true,
  status: true,
  lat: true,
  lng: true,
  geocodeStatus: true,
  geocodeErrorMessage: true,
  geocodedAt: true,
  createdAt: true,
  updatedAt: true,
})
