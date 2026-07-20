export * from './Interfaces'
export * from './Templates'
export * from './Schema'

import type { Filter, InsertOneResult, UpdateResult } from 'mongodb'
import type { Cooperative as CooperativeModel } from 'cooptypes'
import type { IFilterDocuments, IGeneratedDocument, Numbers, externalDataTypes, externalDataTypesArrays, internalFilterTypes } from './Interfaces'
import type { IGenerate, IGenerationOptions } from './Interfaces/Documents'
import * as Actions from './Actions'

import { DocDataService, type ISearchResult, MongoDBConnector, SearchService } from './Services/Databazor'
import type { ExternalIndividualData } from './Models/Individual'
import { Individual } from './Models/Individual'
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
  connect: (mongoUri: string) => Promise<void>
  disconnect: () => Promise<void>
  generate: (data: IGenerate, options?: IGenerationOptions) => Promise<IGeneratedDocument>
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

export class Generator implements IGenerator {
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

    // Инициализация фабрик документов
    this.factories = {
      [Actions.WalletAgreement.Template.registry_id]: new Actions.WalletAgreement.Factory(this.storage), // 1
      [Actions.RegulationElectronicSignature.Template.registry_id]: new Actions.RegulationElectronicSignature.Factory(this.storage), // 2
      [Actions.PrivacyPolicy.Template.registry_id]: new Actions.PrivacyPolicy.Factory(this.storage), // 3
      [Actions.UserAgreement.Template.registry_id]: new Actions.UserAgreement.Factory(this.storage), // 4
      [Actions.CoopenomicsAgreement.Template.registry_id]: new Actions.CoopenomicsAgreement.Factory(this.storage), // 50
      [Actions.ConvertToAxonStatement.Template.registry_id]: new Actions.ConvertToAxonStatement.Factory(this.storage), // 51
      [Actions.ParticipantApplication.Template.registry_id]: new Actions.ParticipantApplication.Factory(this.storage), // 100
      [Actions.ParticipantExitApplication.Template.registry_id]: new Actions.ParticipantExitApplication.Factory(this.storage), // 200
      [Actions.DecisionOfParticipantExit.Template.registry_id]: new Actions.DecisionOfParticipantExit.Factory(this.storage), // 201
      [Actions.SelectBranchStatement.Template.registry_id]: new Actions.SelectBranchStatement.Factory(this.storage), // 101

      // общее собрание
      [Actions.AnnualGeneralMeetingAgenda.Template.registry_id]: new Actions.AnnualGeneralMeetingAgenda.Factory(this.storage), // 300
      [Actions.AnnualGeneralMeetingSovietDecision.Template.registry_id]: new Actions.AnnualGeneralMeetingSovietDecision.Factory(this.storage), // 301
      [Actions.AnnualGeneralMeetingNotification.Template.registry_id]: new Actions.AnnualGeneralMeetingNotification.Factory(this.storage), // 302
      [Actions.AnnualGeneralMeetingVotingBallot.Template.registry_id]: new Actions.AnnualGeneralMeetingVotingBallot.Factory(this.storage), // 303
      [Actions.AnnualGeneralMeetingDecision.Template.registry_id]: new Actions.AnnualGeneralMeetingDecision.Factory(this.storage), // 304

      [Actions.DecisionOfParticipantApplication.Template.registry_id]: new Actions.DecisionOfParticipantApplication.Factory(this.storage), // 501
      [Actions.ProjectFreeDecision.Template.registry_id]: new Actions.ProjectFreeDecision.Factory(this.storage), // 599
      [Actions.FreeDecision.Template.registry_id]: new Actions.FreeDecision.Factory(this.storage), // 600

      [Actions.SosediAgreement.Template.registry_id]: new Actions.SosediAgreement.Factory(this.storage), // 699

      [Actions.AssetContributionStatement.Template.registry_id]: new Actions.AssetContributionStatement.Factory(this.storage), // 700
      [Actions.ReturnByAssetStatement.Template.registry_id]: new Actions.ReturnByAssetStatement.Factory(this.storage), // 800
      [Actions.ReturnByAssetDecision.Template.registry_id]: new Actions.ReturnByAssetDecision.Factory(this.storage), // 801
      [Actions.ReturnByAssetAct.Template.registry_id]: new Actions.ReturnByAssetAct.Factory(this.storage), // 802
      [Actions.ReturnByMoney.Template.registry_id]: new Actions.ReturnByMoney.Factory(this.storage), // 900
      [Actions.ReturnByMoneyDecision.Template.registry_id]: new Actions.ReturnByMoneyDecision.Factory(this.storage), // 901

      // ЦПП ГЕНЕРАТОР
      [Actions.GeneratorProgramTemplate.Template.registry_id]: new Actions.GeneratorProgramTemplate.Factory(this.storage), // 994
      [Actions.GeneratorOfferTemplate.Template.registry_id]: new Actions.GeneratorOfferTemplate.Factory(this.storage), // 995
      [Actions.GeneratorOffer.Template.registry_id]: new Actions.GeneratorOffer.Factory(this.storage), // 996

      // ЦПП БЛАГОРОСТ
      [Actions.GenerationContractTemplate.Template.registry_id]: new Actions.GenerationContractTemplate.Factory(this.storage), // 997
      [Actions.BlagorostProgramTemplate.Template.registry_id]: new Actions.BlagorostProgramTemplate.Factory(this.storage), // 998
      [Actions.BlagorostOfferTemplate.Template.registry_id]: new Actions.BlagorostOfferTemplate.Factory(this.storage), // 999
      [Actions.BlagorostOffer.Template.registry_id]: new Actions.BlagorostOffer.Factory(this.storage), // 1000

      [Actions.AssetContributionDecision.Template.registry_id]: new Actions.AssetContributionDecision.Factory(this.storage), // 701
      [Actions.AssetContributionAct.Template.registry_id]: new Actions.AssetContributionAct.Factory(this.storage), // 702
      [Actions.GenerationContract.Template.registry_id]: new Actions.GenerationContract.Factory(this.storage), // 1001
      [Actions.ProjectGenerationContract.Template.registry_id]: new Actions.ProjectGenerationContract.Factory(this.storage), // 1002
      [Actions.ComponentGenerationContract.Template.registry_id]: new Actions.ComponentGenerationContract.Factory(this.storage), // 1003
      [Actions.StorageAgreement.Template.registry_id]: new Actions.StorageAgreement.Factory(this.storage), // 1004
      [Actions.BlagorostAgreement.Template.registry_id]: new Actions.BlagorostAgreement.Factory(this.storage), // 1007
      [Actions.InitProjectStatement.Template.registry_id]: new Actions.InitProjectStatement.Factory(this.storage), // 1005
      [Actions.InitProjectDecision.Template.registry_id]: new Actions.InitProjectDecision.Factory(this.storage), // 1006

      [Actions.ExpenseStatement.Template.registry_id]: new Actions.ExpenseStatement.Factory(this.storage), // 1010
      [Actions.ExpenseDecision.Template.registry_id]: new Actions.ExpenseDecision.Factory(this.storage), // 1011

      // Шасси расходов — программные расходы (служебные записки)
      [Actions.ExpenseProposalStatement.Template.registry_id]: new Actions.ExpenseProposalStatement.Factory(this.storage), // 2010
      [Actions.ExpenseProposalDecision.Template.registry_id]: new Actions.ExpenseProposalDecision.Factory(this.storage), // 2011

      [Actions.GenerationMoneyInvestStatement.Template.registry_id]: new Actions.GenerationMoneyInvestStatement.Factory(this.storage), // 1020
      [Actions.GenerationMoneyReturnUnusedStatement.Template.registry_id]: new Actions.GenerationMoneyReturnUnusedStatement.Factory(this.storage), // 1025

      [Actions.CapitalizationMoneyInvestStatement.Template.registry_id]: new Actions.CapitalizationMoneyInvestStatement.Factory(this.storage), // 1030

      [Actions.ResultContributionStatement.Template.registry_id]: new Actions.ResultContributionStatement.Factory(this.storage), // 1040
      [Actions.ResultContributionDecision.Template.registry_id]: new Actions.ResultContributionDecision.Factory(this.storage), // 1041
      [Actions.ResultContributionAct.Template.registry_id]: new Actions.ResultContributionAct.Factory(this.storage), // 1042

      [Actions.GetLoanStatement.Template.registry_id]: new Actions.GetLoanStatement.Factory(this.storage), // 1050
      [Actions.GetLoanDecision.Template.registry_id]: new Actions.GetLoanDecision.Factory(this.storage), // 1051

      [Actions.GenerationPropertyInvestStatement.Template.registry_id]: new Actions.GenerationPropertyInvestStatement.Factory(this.storage), // 1060
      [Actions.GenerationPropertyInvestDecision.Template.registry_id]: new Actions.GenerationPropertyInvestDecision.Factory(this.storage), // 1061
      [Actions.GenerationPropertyInvestAct.Template.registry_id]: new Actions.GenerationPropertyInvestAct.Factory(this.storage), // 1062

      [Actions.CapitalizationPropertyInvestStatement.Template.registry_id]: new Actions.CapitalizationPropertyInvestStatement.Factory(this.storage), // 1070
      [Actions.CapitalizationPropertyInvestDecision.Template.registry_id]: new Actions.CapitalizationPropertyInvestDecision.Factory(this.storage), // 1071
      [Actions.CapitalizationPropertyInvestAct.Template.registry_id]: new Actions.CapitalizationPropertyInvestAct.Factory(this.storage), // 1072

      [Actions.GenerationConvertStatement.Template.registry_id]: new Actions.GenerationConvertStatement.Factory(this.storage), // 1080

      [Actions.CapitalizationToMainWalletConvertStatement.Template.registry_id]: new Actions.CapitalizationToMainWalletConvertStatement.Factory(this.storage), // 1090
    }
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
      throw new Error(`Фабрика для документа #${data.registry_id} не найдена.`)

    // синтезируем документ
    return await factory.generateDocument(data, options)
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
    return new Cooperative(this.storage).getOne(username, block_num)
  }

  // Новый метод поиска
  async search(query: string): Promise<ISearchResult[]> {
    return this.searchService.search(query)
  }
}
