/**
 * Имена и реквизиты субъектов для текста документа: чистые функции без
 * хранилища (шаг 2 фабрики v2, FR19). Вход — уже прочитанные данные субъекта,
 * выход — строка или модель для шаблона.
 */
import type { Cooperative } from 'cooptypes'
import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData, externalDataTypes } from '../Models'
import type { IUserAt } from '../Sources'

/** «Фамилия Имя Отчество» физлица или представителя организации; строка — как есть. */
export function fullName(data: externalDataTypes | string): string {
  if (typeof data === 'string')
    return data

  if ('first_name' in data)
    return `${data.last_name} ${data.first_name} ${data.middle_name}`

  if ('represented_by' in data)
    return `${data.represented_by.last_name} ${data.represented_by.first_name} ${data.represented_by.middle_name}`

  return ''
}

/** ФИО физлица или краткое название организации. */
export function fullParticipantName(data: externalDataTypes): string {
  if ('first_name' in data)
    return `${data.last_name} ${data.first_name} ${data.middle_name}`
  if ('short_name' in data)
    return data.short_name
  return ''
}

export function firstLastMiddleName(data: externalDataTypes): Cooperative.Model.IFirstLastMiddleName {
  return {
    first_name: 'first_name' in data ? data.first_name : '',
    last_name: 'last_name' in data ? data.last_name : '',
    middle_name: 'middle_name' in data ? data.middle_name : '',
  }
}

/** Имя организации из кавычек краткого названия, иначе последнее слово; прописными. */
export function organizationAbbreviatedName(input: ExternalOrganizationData): string {
  const match = input.short_name.match(/["'«»]([^"'«»]+)["'«»]/)
  if (match)
    return match[1].trim().toUpperCase()

  const words = input.short_name.trim().split(/\s+/)
  const lastWord = words[words.length - 1]
  if (!lastWord)
    throw new Error(`Не удалось извлечь имя организации из: "${input.short_name}"`)

  return lastWord.toUpperCase()
}

/** Инициалы физлица в порядке имя-отчество-фамилия, прописными. */
export function personalAbbreviatedName(input: ExternalIndividualData | ExternalEntrepreneurData): string {
  return `${input.first_name[0]}${input.middle_name[0]}${input.last_name[0]}`.toUpperCase()
}

/** Общая модель пайщика для шаблонов: сокращение, имя, дата рождения или ОГРН, контакты. */
export function commonUser(input: IUserAt): Cooperative.Model.ICommonUser {
  switch (input.type) {
    case 'individual':
    case 'entrepreneur': {
      const data = input.data as ExternalEntrepreneurData | ExternalIndividualData
      return {
        abbr_full_name: personalAbbreviatedName(data),
        full_name_or_short_name: fullParticipantName(data),
        birthdate_or_ogrn: data.birthdate,
        email: data.email,
        phone: data.phone,
      }
    }

    case 'organization': {
      const data = input.data as ExternalOrganizationData
      return {
        abbr_full_name: organizationAbbreviatedName(data),
        full_name_or_short_name: fullParticipantName(data),
        birthdate_or_ogrn: data.details.ogrn,
        email: data.email,
        phone: data.phone,
      }
    }

    default:
      throw new Error(`cant extract common user data`)
  }
}

/** Короткий хэш для номера документа; строка с дефисом или пробелом — уже номер, не режется. */
export function shortHash(hash: string, length: number = 16): string {
  if (hash.includes('-') || hash.includes(' '))
    return hash
  return hash.substring(0, length).toUpperCase()
}

export function uhdContractNumber(contributor_hash: string): string {
  return `УХД-${shortHash(contributor_hash)}`
}

/** Реквизиты получателя для текста платёжного поручения по виду способа оплаты. */
export function paymentDetails(paymentMethod: any, recipientName: string): string {
  switch (paymentMethod.method_type) {
    case 'bank_transfer': {
      const bankData = paymentMethod.data as any // IBankAccount из cooptypes
      return `№ счета получателя: ${bankData.account_number}\nБанк получателя: ${bankData.bank_name}\nКорр. счет банка: ${bankData.details?.corr || ''}\nБИК ${bankData.details?.bik || ''}\nПолучатель: ${recipientName}`
    }
    case 'sbp': {
      const sbpData = paymentMethod.data as any // ISbpDetails из cooptypes
      return `СБП\nТелефон получателя: ${sbpData.phone}`
    }
    default:
      return JSON.stringify(paymentMethod.data)
  }
}
