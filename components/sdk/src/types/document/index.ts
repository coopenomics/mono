import type { Cooperative } from 'cooptypes'
import type { IMetaDocument as DocsIMetaDocument, ZGeneratedDocument } from '@coopenomics/docs-templates'
import type { Zeus } from '../..'
/**
 * Интерфейс для метаданных документа.
 */
export type IMetaDocument = DocsIMetaDocument

/**
 * Интерфейс для сгенерированного документа, который требуется подписать.
 */
export type IGeneratedDocument<T = any> = ZGeneratedDocument<T>

/**
 * Интерфейс для информации о подписи в документе.
 */
export type ISignatureInfoInput = Zeus.ModelTypes['SignatureInfoInput']
export type ISignatureInfo = Zeus.ModelTypes['SignatureInfo']

/**
 * Интерфейс для подписанного документа.
 */
export type ISignedDocument = Zeus.ModelTypes['SignedDigitalDocument']
export type ISignedDocumentInput = Zeus.ModelTypes['SignedDigitalDocumentInput']
/**
 * Интерфейс для подписанного документа.
 */
export type ISignedChainDocument = Cooperative.Document.IChainDocument2
