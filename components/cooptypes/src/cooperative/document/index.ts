import type { SovietContract } from '../../contracts'
import type { IAction, IExtendedAction } from '../blockchain'

export * from './decisionsRegistry'
// export * from './documentsRegistry'
export interface IGenerationOptions {
  skip_save?: boolean
  lang?: string
}

export type LangType = 'ru'

export interface IChainDocument {
  hash: string
  public_key: string
  signature: string
  meta: string
}

// Определение базового интерфейса для мета-информации
export interface IMetaDocument {
  title: string
  registry_id: number
  lang: string
  generator: string
  version: string
  coopname: string
  username: string
  created_at: string
  block_num: number
  timezone: string
  links: string[]
}

export interface ISignedDocument<T = any> {
  hash: string
  public_key: string
  signature: string
  meta: IMetaDocument & T
}

export interface IGeneratedDocument<T = any> {
  full_title: string
  html: string
  hash: string
  meta: IMetaDocument & T
  binary: Uint8Array
}

export interface ZGeneratedDocument<T = any> {
  full_title: string
  html: string
  hash: string
  meta: IMetaDocument & T
  binary: string
}

export interface IComplexStatement {
  action: IExtendedAction
  document: IGeneratedDocument
}

export interface IComplexDecision {
  action: IExtendedAction
  document: IGeneratedDocument
  votes_for: IExtendedAction[]
  votes_against: IExtendedAction[]
}

export interface IComplexAct {
  action?: IExtendedAction
  document?: IGeneratedDocument
}

export interface IComplexDocument {
  statement: IComplexStatement
  decision: IComplexDecision
  acts: IComplexAct[]
  links: IGeneratedDocument[]
}

export interface IGetComplexDocuments {
  results: IComplexDocument[]
  page: number
  limit: number
}

export interface IAgenda {
  table: SovietContract.Tables.Decisions.IDecision
  action: IAction
}

export interface IComplexAgenda extends IAgenda {
  documents: IComplexDocument
}

export interface IGetResponse<T> {
  results: T[]
  page: number
  limit: number
  totalResults: number
  totalPages: number
}

/**
 * Общий интерфейс для генерации/регенерации документа
 */
export interface IGenerate extends Omit<Partial<IMetaDocument>, 'title'> {
  registry_id: number
  coopname: string
  username: string
  [key: string]: any
}

/**
 * Зарезервированная ссылка на приватный payload документа.
 * Action конкретного документа расширяет этот интерфейс, если хочет
 * хранить персональные/приватные данные off-chain — payload лежит в
 * коллекции `doc_private_data` фабрики, on-chain публикуется только
 * `doc_data_hash`. См. раздел «Document Generation Pattern: doc_data»
 * в архитектуре.
 */
export interface IDocDataRef {
  doc_data_hash?: string
}

/**
 * Интерфейс генерации заявления на вступление в кооператив
 */
export interface IGenerateJoinCoop extends IGenerate {
  signature: string
  skip_save: boolean
}

/**
 * Интерфейс генерации решения совета
 */
export interface IGenerateJoinCoopDecision extends IGenerate {
  decision_id: number
}

/**
 * Интерфейс генерации соглашения
 */
export interface IGenerateWalletAgreement extends IGenerate {
  registry_id: number
}

export interface IDecisionData {
  id: number
  date: string
  time: string
  votes_for: number
  votes_against: number
  votes_abstained: number
  voters_percent: number
  // decision: SovietContract.Tables.Decisions.IDecision
}

export interface IProjectData {
  id: string
  title?: string
  question: string
  decision: string
}

export interface IIntellectualResult {
  quantity: number
  name: string
  currency: string
  unit_price: number
  total_price: number
  description: string
}

export interface IUHDContract {
  number: string
  date: string
}

export interface IContributionAmount {
  amount: number
  currency: string
  words: string
}

// Новые интерфейсы для обновленной версии документов
export interface ISignatureInfo {
  id: number
  signed_hash: string
  signer: string // eosio::name в виде строки
  public_key: string
  signature: string
  signed_at: string // time_point_sec в виде строки
  meta: string
}

export interface IChainDocument2 {
  version: string
  hash: string // checksum256 в виде строки
  doc_hash: string // checksum256 в виде строки
  meta_hash: string // checksum256 в виде строки
  meta: string
  signatures: ISignatureInfo[]
}

export interface ISignedDocument2<T = any> {
  version: string
  hash: string
  doc_hash: string
  meta_hash: string
  meta: IMetaDocument & T
  signatures: ISignatureInfo[]
}

// Новые интерфейсы для комплексных документов, использующие ISignedDocument2
export interface IComplexStatement2 {
  action: IExtendedAction
  document: IGeneratedDocument
  signed_document: ISignedDocument2
}

export interface IComplexDecision2 {
  action: IExtendedAction
  document: IGeneratedDocument
  signed_document: ISignedDocument2
  votes_for: IExtendedAction[]
  votes_against: IExtendedAction[]
}

export interface IComplexAct2 {
  action?: IExtendedAction
  document?: IGeneratedDocument
  signed_document?: ISignedDocument2
}

export interface IComplexDocument2 {
  statement: IComplexStatement2
  decision: IComplexDecision2
  acts: IComplexAct2[]
  links: IGeneratedDocument[]
}

export interface IGetComplexDocuments2 {
  results: IComplexDocument2[]
  page: number
  limit: number
}

export interface IComplexAgenda2 extends IAgenda {
  documents: IComplexDocument2
}
