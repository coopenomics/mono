import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawEntrepreneurLookupSelector = {
  last_name: true,
  first_name: true,
  middle_name: true,
  city: true,
  details: {
    inn: true,
    ogrn: true,
  },
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['EntrepreneurLookupResult']> = rawEntrepreneurLookupSelector

export const entrepreneurLookupSelector = Selector('EntrepreneurLookupResult')(rawEntrepreneurLookupSelector)
