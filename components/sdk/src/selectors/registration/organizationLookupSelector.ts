import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawOrganizationLookupSelector = {
  short_name: true,
  full_name: true,
  type: true,
  represented_by: {
    last_name: true,
    first_name: true,
    middle_name: true,
    position: true,
  },
  city: true,
  full_address: true,
  details: {
    inn: true,
    ogrn: true,
    kpp: true,
  },
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['OrganizationLookupResult']> = rawOrganizationLookupSelector

export const organizationLookupSelector = Selector('OrganizationLookupResult')(rawOrganizationLookupSelector)
