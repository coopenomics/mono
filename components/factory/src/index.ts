export * from './Interfaces'
export * from './DataSource'
export * from './Templates'
export * from './Schema'
export { documentMetaKey } from './Utils/documentMetaKey'
export { formatCreatedAt, isIsoCreatedAt, isLegacyCreatedAt, nowCreatedAt, parseCreatedAt, splitCreatedAt } from './Utils/documentCreatedAt'

import type { Filter, InsertOneResult, UpdateResult } from 'mongodb'
import type { Cooperative as CooperativeModel } from 'cooptypes'
import type { IFilterDocuments, IGeneratedDocument, Numbers, externalDataTypes, externalDataTypesArrays, internalFilterTypes } from './Interfaces'
import type { IGenerate, IGenerateBlank, IGeneratedBlank, IGenerationOptions } from './Interfaces/Documents'
import * as Actions from './Actions'

import { DocDataService, type ISearchResult, MongoDBConnector, SearchService } from './Services/Databazor'
import type { ExternalIndividualData } from './Models/Individual'
import { Individual } from './Models/Individual'
import type { IChainDataSource } from './DataSource'
import { ChainRpcDataSource } from './DataSource'
import { getEnvVar } from './config'
import type { ExternalEntrepreneurData, ExternalOrganizationData, IVars } from './Models'
import { Entrepreneur, Organization, Vars } from './Models'
import { Cooperative, type CooperativeData } from './Models/Cooperative'

import type { DocFactory } from './Factory'
import { buildFactories } from './Builder/registry'
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
  connect: (mongoUri: string) => Promise<void>
  disconnect: () => Promise<void>
  generate: (data: IGenerate, options?: IGenerationOptions) => Promise<IGeneratedDocument>
  /** Бланк документа без данных события: поля, для которых нет данных, — прочерком. */
  generateBlank: (data: IGenerateBlank) => Promise<IGeneratedBlank>
  getDocument: (filter: Filter<IFilterDocuments>) => Promise<IGeneratedDocument>

  /**
   * Сохранить приватные данные документа off-chain; возвращает hash для
   * публикации on-chain как `doc_data_hash`. См. раздел
   * «Document Generation Pattern: doc_data» в архитектуре.
   */
  saveDocData: <P extends Record<string, unknown>>(payload: P, registry_id: number) => Promise<{ hash: string }>

  /** Прочитать приватный payload по `doc_data_hash`. null — если запись удалена. */
  getDocData: <P = Record<string, unknown>>(hash: string) => Promise<P | null>

  constructCooperative: (username: string, block_num?: number) => Promise<CooperativeData | null>
  save: ((type: 'individual', data: ExternalIndividualData) => Promise<InsertOneResult>) & ((type: 'entrepreneur', data: ExternalEntrepreneurData) => Promise<InsertOneResult>) & ((type: 'organization', data: ExternalOrganizationData) => Promise<InsertOneResult>) & ((type: 'paymentMethod', data: PaymentData) => Promise<InsertOneResult>) & ((type: 'vars', data: IVars) => Promise<InsertOneResult>) & ((type: 'project', data: ExternalProjectData) => Promise<InsertOneResult>) & ((type: 'udata', data: ExternalUdata) => Promise<InsertOneResult>)
  get: (type: dataTypes, filter: Filter<internalFilterTypes>) => Promise<externalDataTypes | null>
  del: (type: dataTypes, filter: Filter<internalFilterTypes>) => Promise<UpdateResult>

  list: (type: dataTypes, filter: Filter<internalFilterTypes>) => Promise<CooperativeModel.Document.IGetResponse<internalFilterTypes>>

  getHistory: (type: 'individual' | 'entrepreneur' | 'organization' | 'paymentMethod' | 'vars' | 'project' | 'udata', filter: Filter<internalFilterTypes>) => Promise<externalDataTypesArrays>

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

  // Определение фабрик
  factories!: {
    [K in Numbers]: DocFactory<IGenerate>
  }

  // Определение хранилища
  public storage!: MongoDBConnector

  // Сервис поиска
  private searchService!: SearchService

  // Сервис приватных данных документов (off-chain payload + on-chain hash)
  private docDataService!: DocDataService

  // Метод подключения к хранилищу
  async connect(mongoUri: string): Promise<void> {
    this.storage = new MongoDBConnector(mongoUri)

    // Инициализация сервиса поиска
    this.searchService = new SearchService(this.storage)

    // Инициализация сервиса приватных данных документов
    this.docDataService = new DocDataService(this.storage)

    // Реестр сборщиков собирается из экспортов Actions по номеру реестра
    // шаблона; расхождения с реестром шаблонов — ошибка здесь, при старте.
    this.factories = buildFactories(Actions as Record<string, unknown>, this.storage) as Generator['factories']

    // Источник данных раздаётся фабрикам одним местом — иначе его пришлось бы
    // тянуть через конструктор каждой из десятков фабрик выше.
    for (const factory of Object.values(this.factories))
      factory.setDataSource(this.dataSource)

    await this.storage.connect()
  }

  // Метод отключения от хранилища
  async disconnect(): Promise<void> {
    await this.storage.disconnect()
  }

  // Метод генерации документа
  async generate(data: IGenerate, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const factory = this.factories[data.registry_id as Numbers] // Get the factory

    if (!factory)
      throw new UnknownDocumentFactoryError(data.registry_id)

    // синтезируем документ
    return await factory.generateDocument(data, options)
  }

  async generateBlank(data: IGenerateBlank): Promise<IGeneratedBlank> {
    const factory = this.factories[data.registry_id as Numbers]

    if (!factory)
      throw new UnknownDocumentFactoryError(data.registry_id)

    return await factory.generateBlank(data)
  }

  async getDocument(filter: Filter<IFilterDocuments>): Promise<IGeneratedDocument> {
    return await this.storage.getDocument(filter)
  }

  async saveDocData<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }> {
    return this.docDataService.save(payload, registry_id)
  }

  async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    return this.docDataService.get<P>(hash)
  }

  async save(type: 'individual', data: ExternalIndividualData): Promise<InsertOneResult>
  async save(type: 'entrepreneur', data: ExternalEntrepreneurData): Promise<InsertOneResult>
  async save(type: 'organization', data: ExternalOrganizationData): Promise<InsertOneResult>
  async save(type: 'paymentMethod', data: PaymentData): Promise<InsertOneResult>
  async save(type: 'vars', data: IVars): Promise<InsertOneResult>
  async save(type: 'project', data: ExternalProjectData): Promise<InsertOneResult>
  async save(type: 'udata', data: ExternalUdata): Promise<InsertOneResult>

  async save(type: dataTypes, data: externalDataTypes): Promise<InsertOneResult> {
    const model = this.getModel(type, data)
    return model.save()
  }

  async update(type: 'vars', filter: Filter<IVars>, data: Partial<IVars>): Promise<UpdateResult> {
    const model = this.getModel(type) as Vars
    return model.update(filter, data)
  }

  async del(type: dataTypes, filter: Filter<internalFilterTypes>): Promise<UpdateResult> {
    const model = this.getModel(type)
    return model.del(filter)
  }

  // Универсальные методы получения одного объекта
  async get(type: dataTypes, filter: Filter<internalFilterTypes>): Promise<externalDataTypes | null> {
    const model = this.getModel(type)
    return model.getOne(filter)
  }

  // Универсальные методы получения списка объектов
  async list(type: dataTypes, filter: Filter<internalFilterTypes>): Promise<CooperativeModel.Document.IGetResponse<externalDataTypes>> {
    const model = this.getModel(type)
    return model.getMany(filter)
  }

  // // Универсальные методы получения истории
  async getHistory(type: 'individual' | 'entrepreneur' | 'organization' | 'paymentMethod' | 'vars' | 'project' | 'udata', filter: Filter<internalFilterTypes>): Promise<externalDataTypesArrays> {
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
