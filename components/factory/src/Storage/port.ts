/**
 * Порт хранилища фабрики (шаг 5 фабрики v2, FR34–FR35).
 *
 * Фабрика не знает, где лежат данные пайщиков, собранные документы и
 * приватные данные документов: ей даётся реализация этого порта. Две
 * реализации: PostgreSQL на Kysely (узлы и набор тестов) и память
 * (отдельные проверки).
 *
 * Отбор записей описывается небольшим языком условий, которым пользуются
 * модели и поиск: равенство по полю, граница по блоку `$lte`, поиск по
 * образцу `$regex` без учёта регистра, объединения `$or` и `$and`. Язык
 * унаследован от прежнего хранилища на MongoDB (до 10.2026); реализации
 * его толкуют.
 *
 * Записи версионируются: каждая запись — строка с `block_num`; «текущая» —
 * последняя по блоку, при равном блоке — последняя вставленная. Удаление
 * помечает все версии флагом `deleted`, строки не стираются.
 */
import type { Cooperative } from 'cooptypes'
import type { IGeneratedDocument } from '../Interfaces'

/** Условие на поле: равенство, граница по числу, образец текста. */
export type FieldCondition =
  | string
  | number
  | boolean
  | null
  | undefined
  | { $lte: number }
  | { $regex: string, $options?: string }

/** Отбор: условия на поля плюс объединения. */
export interface Where {
  [field: string]: FieldCondition | Where[] | undefined
  $or?: Where[]
  $and?: Where[]
}

/** Запись хранилища: любые поля плюс служебные версии. */
export interface StoredRecord {
  [field: string]: unknown
  block_num?: number
  deleted?: boolean
}

/** Коллекции данных пайщиков и служебные коллекции фабрики. */
export type RecordCollection =
  | 'individuals'
  | 'organizations'
  | 'entrepreneurs'
  | 'paymentMethods'
  | 'vars'
  | 'projects'
  | 'udatas'
  | 'signatures'

export const RECORD_COLLECTIONS: readonly RecordCollection[] = [
  'individuals',
  'organizations',
  'entrepreneurs',
  'paymentMethods',
  'vars',
  'projects',
  'udatas',
  'signatures',
]

/** Сохранённый документ: собранный документ плюс ключ версии меты. */
export interface StoredDocument extends IGeneratedDocument {
  meta_key: string
}

/** Отбор сохранённого документа. */
export interface DocumentWhere {
  hash: string
  meta_key?: string
  block_num?: number
}

export interface DocumentPage {
  registry_id?: number
  offset: number
  limit: number
}

/** Приватные данные документа по хэшу их содержимого. */
export interface DocDataRecord<P = Record<string, unknown>> {
  hash: string
  registry_id: number
  payload: P
}

export interface IFactoryStorage {
  connect: () => Promise<void>
  disconnect: () => Promise<void>

  /** Текущая версия записи по отбору: последняя по блоку, затем по вставке. */
  findOne: <T extends StoredRecord>(collection: RecordCollection, where: Where) => Promise<T | null>
  /** Текущая версия каждой группы по отбору, страницей. */
  findLatestPerGroup: <T extends StoredRecord>(collection: RecordCollection, where: Where, groupBy: string[], page: number, limit: number) => Promise<Cooperative.Document.IGetResponse<T>>
  /** Все версии по отбору, от новых к старым. */
  findAll: <T extends StoredRecord>(collection: RecordCollection, where: Where) => Promise<T[]>
  /** Новая версия записи. */
  insert: <T extends StoredRecord>(collection: RecordCollection, record: T) => Promise<{ insertedId: string }>
  /** Пометка всех версий по отбору; возвращает число изменённых строк. */
  updateMany: (collection: RecordCollection, where: Where, set: Partial<StoredRecord>) => Promise<{ modifiedCount: number }>

  /** Сохранить документ; версия — по хэшу и ключу меты, повтор заменяет. */
  saveDocument: (document: StoredDocument) => Promise<void>
  findDocument: (where: DocumentWhere) => Promise<StoredDocument | null>
  listDocuments: (page: DocumentPage) => Promise<Array<Pick<StoredDocument, 'hash' | 'meta' | 'html'>>>
  countDocuments: (registry_id?: number) => Promise<number>

  /** Приватные данные документа: повтор того же хэша ничего не меняет. */
  saveDocData: (record: DocDataRecord) => Promise<void>
  getDocData: <P = Record<string, unknown>>(hash: string) => Promise<P | null>
}
