import type { JSONSchemaType } from 'ajv'
import type { Cooperative } from 'cooptypes'
import type { Registry } from '../Templates/registry'
import type { CooperativeData } from '../Models/Cooperative'
import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData } from '../Models'

// Определение базового интерфейса для мета-информации
export type IMetaDocument = Cooperative.Document.IMetaDocument

export interface IGeneratedDocument {
  full_title: string
  html: string
  hash: string
  meta: IMetaDocument
  binary: Uint8Array
}

export interface NestedRecord {
  [key: string]: any
}

export type ITranslations = Record<string, NestedRecord>

export interface ITemplate<T> {
  title: string
  description: string
  model: JSONSchemaType<T> // Схема данных для шаблона
  context: string
  translations: ITranslations // Схема переводов
}

export interface ICombinedData {
  individual?: ExternalIndividualData
  organization?: ExternalOrganizationData
  entrepreneur?: ExternalEntrepreneurData
  coop?: CooperativeData
  meta: IMetaDocument
}

export type Numbers = keyof typeof Registry
export type LangType = 'ru'

export interface IMetaDocumentPartial extends Partial<IMetaDocument> {
  username: string
  coopname: string
  registry_id: number
  title: string
}

export type IGenerate = Cooperative.Document.IGenerate

export type IGenerationOptions = Cooperative.Document.IGenerationOptions

/**
 * Вход сборки бланка: документ без данных события — только шаблон из цепи и
 * реквизиты кооператива. Без `block_num` редакцию шаблона выбирает источник
 * данных (утверждённую), с ним — редакция на указанном блоке.
 */
export interface IGenerateBlank {
  coopname: string
  registry_id: number
  block_num?: number
  lang?: string
}

export interface IGeneratedBlank {
  title: string
  html: string
  meta: IMetaDocument
}
