import type { SovietContract } from '../../contracts'
import type { ICooperative } from '../../contracts/registrator/tables/cooperatives'
import type { IMeet, IQuestion } from '../../interfaces/meet'
import type { IIndividualData, IOrganizationData } from '../users'
import type { IBankAccount } from '../payments'

export interface ICooperativeData extends IOrganizationData, ICooperative {
  members: MembersData[]
  chairman: IIndividualData
  totalMembers: number
  defaultBankAccount: IBankAccount
}

export interface MembersData extends SovietContract.Interfaces.IBoardMember, IIndividualData {
  is_chairman: boolean
}

export interface IAnnounce {
  phone: string
  email: string
}

export interface IContacts {
  full_name: string
  full_address: string
  details: { inn: string, ogrn: string, kpp: string }
  phone: string
  email: string
  chairman: {
    first_name: string
    last_name: string
    middle_name: string
  }
}

export interface IVars {
  block_num?: number
  deleted?: boolean

  coopname: string
  full_abbr: string
  full_abbr_genitive: string
  full_abbr_dative: string
  short_abbr: string
  website: string
  name: string
  confidential_link: string
  confidential_email: string
  contact_email: string
  passport_request: 'yes' | 'no'
  wallet_agreement?: {
    protocol_number: string
    protocol_day_month_year: string
  }
  signature_agreement?: {
    protocol_number: string
    protocol_day_month_year: string
  }
  privacy_agreement?: {
    protocol_number: string
    protocol_day_month_year: string
  }
  user_agreement?: {
    protocol_number: string
    protocol_day_month_year: string
  }
  participant_application?: { // Заявление на вступление
    protocol_number: string
    protocol_day_month_year: string
  }
  coopenomics_agreement?: { // Оферта на подключение кооператива
    protocol_number: string
    protocol_day_month_year: string
  }
  // Благорост
  blagorost_program?: { // Положение о программе "Благорост"
    protocol_number: string
    protocol_day_month_year: string
  }
  blagorost_offer_template?: { // Шаблон оферты "Благорост"
    protocol_number: string
    protocol_day_month_year: string
  }
  generator_program?: { // Положение о программе "Гененатор"
    protocol_number: string
    protocol_day_month_year: string
  }
  generator_offer_template?: { // Шаблон оферты "Генератора"
    protocol_number: string
    protocol_day_month_year: string
  }
  generation_contract_template?: { // Шаблон договора участия в хозяйственной деятельности
    protocol_number: string
    protocol_day_month_year: string
  }
  // Стол заказов
  marketplace_program?: { // Положение о ЦПП «СТОЛ ЗАКАЗОВ»
    protocol_number: string
    protocol_day_month_year: string
  }
  marketplace_offer_template?: { // Шаблон публичной оферты ЦПП «СТОЛ ЗАКАЗОВ»
    protocol_number: string
    protocol_day_month_year: string
  }
  // Образование
  education_provision?: { // Положение о ЦПП «ОБРАЗОВАНИЕ»
    protocol_number: string
    protocol_day_month_year: string
  }
  education_parent_offer_template?: { // Шаблон оферты родителя-слушателя
    protocol_number: string
    protocol_day_month_year: string
  }
  education_teacher_offer_template?: { // Шаблон оферты преподавателя
    protocol_number: string
    protocol_day_month_year: string
  }
  education_contract_template?: { // Шаблон договора участия в хозяйственной деятельности (образование)
    protocol_number: string
    protocol_day_month_year: string
  }

}

/**
 * Используется для генераций документов в кооплейсе
 */
export interface ICommonRequest {
  hash: string
  title: string
  unit_of_measurement: string
  units: number
  unit_cost: string
  total_cost: string
  currency: string
  type: string
  program_id: number
}

export interface ICommonUser {
  full_name_or_short_name: string
  birthdate_or_ogrn: string
  abbr_full_name: string
  email: string
  phone: string
}

export interface IFirstLastMiddleName {
  first_name: string
  last_name: string
  middle_name: string
}

export interface ICommonProgram {
  name: string
}

/**
 * Расширенный интерфейс IMeet с полями для форматированных дат
 */
export interface IMeetExtended extends IMeet {
  close_at_datetime: string
  open_at_datetime: string
  presider_full_name: string
  secretary_full_name: string
}

/**
 * Расширенный интерфейс IQuestion с вычисленными результатами
 */
export interface IQuestionExtended extends IQuestion {
  votes_total?: number
  votes_for_percent?: number
  votes_against_percent?: number
  votes_abstained_percent?: number
  is_accepted?: boolean
}

/**
 * Ключи для пользовательских данных кооператива
 * Определяет типы данных, которые могут сохраняться для пользователей
 */
export enum UdataKey {
  /** Данные договора УХД участника */
  BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER = 'blagorost_contributor_contract_number',

  /** Дата создания договора УХД участника */
  BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT = 'blagorost_contributor_contract_created_at',

  /** Данные соглашения программы генератор */
  GENERATOR_AGREEMENT_NUMBER = 'generator_agreement_number',

  /** Дата создания соглашения генератора */
  GENERATOR_AGREEMENT_CREATED_AT = 'generator_agreement_created_at',

  /** Данные соглашения программы благороста */
  BLAGOROST_AGREEMENT_NUMBER = 'blagorost_agreement_number',

  /** Дата создания соглашения благороста */
  BLAGOROST_AGREEMENT_CREATED_AT = 'blagorost_agreement_created_at',

  /** Хеш дополнительного соглашения по хранению имущества */
  BLAGOROST_STORAGE_AGREEMENT_NUMBER = 'blagorost_storage_agreement_number',

  /** Дата создания дополнительного соглашения по хранению имущества */
  BLAGOROST_STORAGE_AGREEMENT_CREATED_AT = 'blagorost_storage_agreement_created_at',

  /** Номер оферты ЦПП «Стол заказов» (Эпик 1 / Story 1.7 / 1.11) */
  MARKETPLACE_AGREEMENT_NUMBER = 'marketplace_agreement_number',

  /** Дата создания оферты ЦПП «Стол заказов» */
  MARKETPLACE_AGREEMENT_CREATED_AT = 'marketplace_agreement_created_at',

  /** Номер оферты родителя-слушателя ЦПП «Образование» */
  EDUCATION_PARENT_AGREEMENT_NUMBER = 'education_parent_agreement_number',

  /** Дата оферты родителя-слушателя ЦПП «Образование» */
  EDUCATION_PARENT_AGREEMENT_CREATED_AT = 'education_parent_agreement_created_at',

  /** Номер оферты преподавателя ЦПП «Образование» */
  EDUCATION_TEACHER_AGREEMENT_NUMBER = 'education_teacher_agreement_number',

  /** Дата оферты преподавателя ЦПП «Образование» */
  EDUCATION_TEACHER_AGREEMENT_CREATED_AT = 'education_teacher_agreement_created_at',

  /** Номер договора участия в хозяйственной деятельности (образование) */
  EDUCATION_CONTRACT_NUMBER = 'education_contract_number',

  /** Дата договора участия в хозяйственной деятельности (образование) */
  EDUCATION_CONTRACT_CREATED_AT = 'education_contract_created_at',
}

/**
 * Пользовательские данные кооператива
 * Хранит различные типы данных пользователей с версионностью по блокам
 */
export interface IUdata {
  /** Название кооператива */
  coopname: string

  /** Имя пользователя */
  username: string

  /** Ключ данных (определяет тип сохраняемой информации) */
  key: UdataKey

  /** Строковое значение данных */
  value: string

  /** Дополнительные метаданные (опционально) */
  metadata?: Record<string, any>

  /** Флаг мягкого удаления */
  deleted?: boolean

  /** Номер блока для версионности */
  block_num?: number
}
