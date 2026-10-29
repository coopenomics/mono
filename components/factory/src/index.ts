export * from './Interfaces'
export * from './DataSource'
export * from './Templates'
export * from './Schema'
export * from './Storage'
export { documentMetaKey } from './Utils/documentMetaKey'
export * from './Builder/version'
export { formatCreatedAt, isIsoCreatedAt, isLegacyCreatedAt, nowCreatedAt, parseCreatedAt, splitCreatedAt } from './Utils/documentCreatedAt'

import { type Cooperative as CooperativeModel, DraftContract } from 'cooptypes'
import type { IDocumentFilter, IGeneratedDocument, externalDataTypes, externalDataTypesArrays, internalFilterTypes } from './Interfaces'
import type { IGenerate, IGenerateBlank, IGeneratedBlank, IGenerationOptions } from './Interfaces/Documents'
import * as Actions from './Actions'
import { type BuilderSet, buildFactories } from './Builder/registry'
import { type BuilderVersion, FIRST_BUILDER_VERSION, isBuilderVersion, latestMinorOf, templateBuilderMajor } from './Builder/version'

import { DocDataService, type ISearchResult, SearchService } from './Services/Databazor'
import type { DocumentPage, IFactoryStorage, StoredDocument, Where } from './Storage'
import type { ExternalIndividualData } from './Models/Individual'
import { Individual } from './Models/Individual'
import type { IChainDataSource } from './DataSource'
import { ChainRpcDataSource } from './DataSource'
import { getEnvVar } from './config'
import type { ExternalEntrepreneurData, ExternalOrganizationData, IVars } from './Models'
import { Entrepreneur, Organization, Vars } from './Models'
import { Cooperative, type CooperativeData } from './Models/Cooperative'

import type { DocFactory } from './Factory'
import type { PaymentData } from './Models/PaymentMethod'
import { PaymentMethod } from './Models/PaymentMethod'
import { type ExternalProjectData, Project } from './Models/Project'
import { type ExternalUdata, Udata } from './Models/Udata'

export type dataTypes = 'individual' | 'entrepreneur' | 'organization' | 'paymentMethod' | 'vars' | 'project' | 'udata'

export type { ExternalOrganizationData as IOrganizationData } from './Models'
export type { ExternalIndividualData as IIndividualData } from './Models'
export type { ExternalEntrepreneurData as IEntrepreneurData } from './Models'
export type { CooperativeData as ICooperativeData } from './Models'
export type { ExternalProjectData as IExternalProjectData } from './Models'
export type { ExternalUdata as IUdata } from './Models'

// Экспортируем интерфейс результатов поиска
export type { ISearchResult } from './Services/Databazor'

export interface IGenerator {
  /** Хранилище фабрики — реализация порта (PostgreSQL узла либо память). */
  connect: (storage: IFactoryStorage) => Promise<void>
  disconnect: () => Promise<void>
  generate: (data: IGenerate, options?: IGenerationOptions) => Promise<IGeneratedDocument>
  /** Бланк документа без данных события: поля, для которых нет данных, — прочерком. */
  generateBlank: (data: IGenerateBlank) => Promise<IGeneratedBlank>
  getDocument: (filter: IDocumentFilter) => Promise<IGeneratedDocument>

  /**
   * Сохранить приватные данные документа off-chain; возвращает hash для
   * публикации on-chain как `doc_data_hash`. См. раздел
   * «Document Generation Pattern: doc_data» в архитектуре.
   */
  saveDocData: <P extends Record<string, unknown>>(payload: P, registry_id: number) => Promise<{ hash: string }>

  /** Прочитать приватный payload по `doc_data_hash`. null — если запись удалена. */
  getDocData: <P = Record<string, unknown>>(hash: string) => Promise<P | null>

  constructCooperative: (username: string, block_num?: number) => Promise<CooperativeData | null>
  save: ((type: 'individual', data: ExternalIndividualData) => Promise<{ insertedId: string }>) & ((type: 'entrepreneur', data: ExternalEntrepreneurData) => Promise<{ insertedId: string }>) & ((type: 'organization', data: ExternalOrganizationData) => Promise<{ insertedId: string }>) & ((type: 'paymentMethod', data: PaymentData) => Promise<{ insertedId: string }>) & ((type: 'vars', data: IVars) => Promise<{ insertedId: string }>) & ((type: 'project', data: ExternalProjectData) => Promise<{ insertedId: string }>) & ((type: 'udata', data: ExternalUdata) => Promise<{ insertedId: string }>)
  get: (type: dataTypes, filter: Where) => Promise<externalDataTypes | null>
  del: (type: dataTypes, filter: Where) => Promise<{ modifiedCount: number }>

  list: (type: dataTypes, filter: Where) => Promise<CooperativeModel.Document.IGetResponse<internalFilterTypes>>

  getHistory: (type: 'individual' | 'entrepreneur' | 'organization' | 'paymentMethod' | 'vars' | 'project' | 'udata', filter: Where) => Promise<externalDataTypesArrays>

  // Новый метод поиска
  search: (query: string) => Promise<ISearchResult[]>
}

export { DocumentNotApprovedError } from './errors'

/** Для номера реестра нет фабрики документа — такой документ генератор не собирает. */
export class UnknownDocumentFactoryError extends Error {
  constructor(public readonly registry_id: number) {
    super(`Фабрика для документа #${registry_id} не найдена.`)
    this.name = 'UnknownDocumentFactoryError'
  }
}

/**
 * Нужной версии сборщика на узле нет: мета документа называет версию, которой
 * в пакете фабрики нет, или редакция шаблона объявляет `major` без сборщика.
 */
export class UnknownBuilderVersionError extends Error {
  constructor(public readonly registry_id: number, public readonly builder: string) {
    super(`Версия сборщика ${builder} для документа #${registry_id} на узле не найдена.`)
    this.name = 'UnknownBuilderVersionError'
  }
}

export class Generator implements IGenerator {
  /**
   * Откуда брать данные цепи. Не задан — читаем прямо из цепи по адресу из
   * окружения: так генерация работает у инструментов развёртывания, у которых
   * своей базы нет. Узел передаёт сюда собственную реализацию — с историей
   * версий шаблонов и историей действий, которых у цепи не спросить.
   */
  private givenDataSource?: IChainDataSource
  private chainDataSource?: IChainDataSource

  constructor(dataSource?: IChainDataSource) {
    this.givenDataSource = dataSource
  }

  /**
   * Адрес цепи спрашиваем только тогда, когда за данными действительно идут.
   * Генератор создают и там, где до цепи дело не доходит: сборка шаблонов из
   * локальных исходников, поиск по хранилищу, набор тестов документов. Пока
   * источник не передали, фабрики получают вот этот переходник — он поднимет
   * чтение из цепи при первом же запросе, а до тех пор переменная окружения не
   * нужна.
   */
  private get dataSource(): IChainDataSource {
    if (this.givenDataSource) return this.givenDataSource

    return {
      getTableRows: (query) => this.chainSource().getTableRows(query),
      getActions: (query) => this.chainSource().getActions(query),
      getCurrentBlock: () => this.chainSource().getCurrentBlock(),
    }
  }

  private chainSource(): IChainDataSource {
    if (!this.chainDataSource)
      this.chainDataSource = new ChainRpcDataSource(getEnvVar('CHAIN_URL'))

    return this.chainDataSource
  }

  // Сборщики по номеру реестра и версии (шаг 7: у вида несколько версий)
  private builders!: Record<number, BuilderSet>

  // Определение хранилища
  public storage!: IFactoryStorage

  // Сервис поиска
  private searchService!: SearchService

  // Сервис приватных данных документов (off-chain payload + on-chain hash)
  private docDataService!: DocDataService

  // Метод подключения к хранилищу
  async connect(storage: IFactoryStorage): Promise<void> {
    this.storage = storage

    // Инициализация сервиса поиска
    this.searchService = new SearchService(this.storage)

    // Инициализация сервиса приватных данных документов
    this.docDataService = new DocDataService(this.storage)

    // Реестр сборщиков собирается из экспортов Actions по номеру реестра
    // шаблона; расхождения с реестром шаблонов — ошибка здесь, при старте.
    this.builders = buildFactories(Actions as Record<string, unknown>, this.storage)

    // Источник данных раздаётся фабрикам одним местом — иначе его пришлось бы
    // тянуть через конструктор каждой из десятков фабрик выше.
    for (const set of Object.values(this.builders)) {
      for (const factory of set.values())
        factory.setDataSource(this.dataSource)
    }

    await this.storage.connect()
  }

  // Метод отключения от хранилища
  async disconnect(): Promise<void> {
    await this.storage.disconnect()
  }

  /**
   * Сборщик вида документа нужной версии; без версии — последняя `1.x`
   * (для проверок и наборов тестов). Неизвестный вид или версия — ошибка.
   */
  factoryFor(registry_id: number, version?: string): DocFactory<IGenerate> {
    const set = this.builders[registry_id]
    if (!set)
      throw new UnknownDocumentFactoryError(registry_id)
    const chosen = version ?? latestMinorOf(set.keys(), 1) ?? FIRST_BUILDER_VERSION
    const factory = set.get(chosen as BuilderVersion)
    if (!factory)
      throw new UnknownBuilderVersionError(registry_id, chosen)
    return factory
  }

  /** Версии сборщика вида документа, известные узлу. */
  builderVersions(registry_id: number): BuilderVersion[] {
    return [...(this.builders[registry_id]?.keys() ?? [])]
  }

  /**
   * Какой версией собирать (шаг 7, решение 6 PRD):
   * - мета документа называет версию (`builder`) — ровно её: пересборка
   *   подписанного документа и сборка заданной версией;
   * - пересборка документа до оси версий (дата есть, версии нет) — `1.0`;
   * - новая сборка — последний `minor` того `major`, который объявляет
   *   действующая редакция шаблона ключом `x-builder` (нет ключа — `1`).
   */
  private async chooseVersion(set: BuilderSet, data: IGenerate): Promise<BuilderVersion> {
    const named = (data as { builder?: unknown }).builder
    if (named !== undefined && named !== null) {
      if (!isBuilderVersion(named) || !set.has(named))
        throw new UnknownBuilderVersionError(data.registry_id, String(named))
      return named
    }
    if ((data as { created_at?: string }).created_at)
      return FIRST_BUILDER_VERSION

    const any = set.values().next().value as DocFactory<IGenerate>
    const template = await any.getTemplate<unknown>(DraftContract.contractName.production, data.registry_id, data.block_num)
    const major = templateBuilderMajor(template.model)
    const latest = latestMinorOf(set.keys(), major)
    if (!latest)
      throw new UnknownBuilderVersionError(data.registry_id, `${major}.x`)
    return latest
  }

  // Метод генерации документа
  async generate(data: IGenerate, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const set = this.builders[data.registry_id]
    if (!set)
      throw new UnknownDocumentFactoryError(data.registry_id)

    const version = await this.chooseVersion(set, data)
    return await set.get(version)!.generateDocument(data, options)
  }

  // Бланк от версии не зависит: мета бланка не подписывается и версию не несёт.
  async generateBlank(data: IGenerateBlank): Promise<IGeneratedBlank> {
    return await this.factoryFor(data.registry_id).generateBlank(data)
  }

  async getDocument(filter: IDocumentFilter): Promise<IGeneratedDocument> {
    const document = await this.storage.findDocument({ hash: filter.hash, meta_key: filter.meta_key, block_num: filter.block_num })
    return document as IGeneratedDocument
  }

  /** Сохранённые документы узла порцией — для аудита пересборки. */
  async listDocuments(page: DocumentPage): Promise<Array<Pick<StoredDocument, 'hash' | 'meta' | 'html'>>> {
    return this.storage.listDocuments(page)
  }

  async countDocuments(registry_id?: number): Promise<number> {
    return this.storage.countDocuments(registry_id)
  }

  async saveDocData<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }> {
    return this.docDataService.save(payload, registry_id)
  }

  async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    return this.docDataService.get<P>(hash)
  }

  async save(type: 'individual', data: ExternalIndividualData): Promise<{ insertedId: string }>
  async save(type: 'entrepreneur', data: ExternalEntrepreneurData): Promise<{ insertedId: string }>
  async save(type: 'organization', data: ExternalOrganizationData): Promise<{ insertedId: string }>
  async save(type: 'paymentMethod', data: PaymentData): Promise<{ insertedId: string }>
  async save(type: 'vars', data: IVars): Promise<{ insertedId: string }>
  async save(type: 'project', data: ExternalProjectData): Promise<{ insertedId: string }>
  async save(type: 'udata', data: ExternalUdata): Promise<{ insertedId: string }>

  async save(type: dataTypes, data: externalDataTypes): Promise<{ insertedId: string }> {
    const model = this.getModel(type, data)
    return model.save()
  }

  async update(type: 'vars', filter: Where, data: Partial<IVars>): Promise<{ modifiedCount: number }> {
    const model = this.getModel(type) as Vars
    return model.update(filter, data)
  }

  async del(type: dataTypes, filter: Where): Promise<{ modifiedCount: number }> {
    const model = this.getModel(type)
    return model.del(filter)
  }

  // Универсальные методы получения одного объекта
  async get(type: dataTypes, filter: Where): Promise<externalDataTypes | null> {
    const model = this.getModel(type)
    return model.getOne(filter)
  }

  // Универсальные методы получения списка объектов
  async list(type: dataTypes, filter: Where): Promise<CooperativeModel.Document.IGetResponse<externalDataTypes>> {
    const model = this.getModel(type)
    return model.getMany(filter)
  }

  // // Универсальные методы получения истории
  async getHistory(type: 'individual' | 'entrepreneur' | 'organization' | 'paymentMethod' | 'vars' | 'project' | 'udata', filter: Where): Promise<externalDataTypesArrays> {
    const model = this.getModel(type)
    return model.getHistory(filter)
  }

  // Вспомогательный метод для получения модели
  getModel(type: 'individual' | 'entrepreneur' | 'organization' | 'paymentMethod' | 'vars' | 'project' | 'udata', data?: externalDataTypes) {
    switch (type) {
      case 'individual':
        return new Individual(this.storage, data as ExternalIndividualData)
      case 'entrepreneur':
        return new Entrepreneur(this.storage, data as ExternalEntrepreneurData)
      case 'organization':
        return new Organization(this.storage, data as ExternalOrganizationData)
      case 'paymentMethod':
        return new PaymentMethod(this.storage, data as PaymentData)
      case 'vars':
        return new Vars(this.storage, data as IVars)
      case 'project':
        return new Project(this.storage, data as ExternalProjectData)
      case 'udata':
        return new Udata(this.storage, data as ExternalUdata)

      default:
        throw new Error(`Unknown type: ${type}`)
    }
  }

  async constructCooperative(username: string, block_num?: number): Promise<CooperativeData | null> {
    return new Cooperative(this.storage, this.dataSource).getOne(username, block_num)
  }

  // Новый метод поиска
  async search(query: string): Promise<ISearchResult[]> {
    return this.searchService.search(query)
  }
}
