/**
 * Слой источников данных фабрики: «прочитать на блок».
 *
 * Шаг 1 фабрики v2 (компонент 71, задача 5A8-N). До него каждое чтение —
 * шаблон из цепи, пайщик из MongoDB, голоса из действий — лежало в своём
 * методе `DocFactory`, а действия сверх того сами открывали модели поверх
 * хранилища (`new Udata(this.storage)`) и держали ветку локальных шаблонов
 * `process.env.SOURCE === 'local'`. Здесь всё чтение собрано в одном
 * классе. Каждое чтение принимает номер блока и отдаёт состояние на этот
 * блок: так документ пересобирается по своим метаданным тем же, каким был.
 *
 * Границы класса: только чтение и только сырые данные. Форматирование
 * имён, расчёт процентов по голосам и вёрстка остаются в `DocFactory`;
 * шаг 2 переносит их в чистые помощники. Хранилище (MongoDB) и цепь
 * (`IChainDataSource`) — две реализации за одним фасадом; шаг 5 заменит
 * хранилище на порты контроллера, не меняя вызывающих.
 */
import type { Cooperative, MeetContract } from 'cooptypes'
import { DraftContract, SovietContract } from 'cooptypes'
import type { JSONSchemaType } from 'ajv'
import type { IBankAccount, ITemplate, ITranslations, externalDataTypes } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { IChainDataSource } from '../DataSource'
import {
  type ExternalUdata,
  Individual,
  type InternalProjectData,
  type IVars,
  Organization,
  PaymentMethod,
  type PaymentData,
  Project,
  Udata,
  Vars,
} from '../Models'
import type { CooperativeData } from '../Models/Cooperative'
import { Cooperative as CooperativeModel } from '../Models/Cooperative'
import { Entrepreneur } from '../Models/Entrepreneur'
import { DocDataService } from '../Services/DocData'
import DataService from '../Services/Databazor/DataService'
import { Registry } from '../Templates/registry'
import type { IOrganizationData } from '..'

export interface IUserAt { type: string, data: externalDataTypes }

export interface IUdataFilter {
  coopname: string
  username: string
  key: string
  block_num?: number
}

export interface IPaymentMethodFilter {
  username: string
  method_id?: string
  method_type?: string
  is_default?: boolean
  block_num?: number
}

/** Подпись пайщика под заявлением на вступление, коллекция `signatures`. */
export interface ISignatureRecord {
  username: string
  block_num: number
  signature: string
}

/** Голоса по решению совета, посчитанные по действиям цепи. */
export interface IDecisionVotes {
  votes_for: number
  votes_against: number
}

/** Отбор «не новее блока» для хранилища: без блока — последнее состояние. */
function upTo(block_num?: number): { block_num?: { $lte: number } } {
  return block_num ? { block_num: { $lte: block_num } } : {}
}

export class FactorySources {
  private readonly docData: DocDataService

  /**
   * Цепь передаётся функцией, а не значением: `Generator` проставляет
   * источник цепи фабрикам после их создания, и слой источников обязан видеть
   * тот источник, который задан на момент чтения.
   */
  constructor(
    private readonly storage: MongoDBConnector,
    private readonly chainSource: () => IChainDataSource,
  ) {
    this.docData = new DocDataService(storage)
  }

  private get chain(): IChainDataSource {
    return this.chainSource()
  }

  /**
   * Текст, схема и переводы шаблона в редакции на блок.
   *
   * `SOURCE=local` — разработка и набор тестов: тексты берутся из реестра
   * пакета, а не из цепи. Раньше эту ветку держал каждый сборщик отдельно.
   */
  async template<T>(scope: string, registry_id: number, block_num?: number): Promise<ITemplate<T>> {
    if (process.env.SOURCE === 'local') {
      const entry = (Registry as Record<number, { Template: ITemplate<unknown> } | undefined>)[registry_id]
      if (!entry)
        throw new Error(`Локальный шаблон ${registry_id} не найден в реестре пакета`)
      return entry.Template as ITemplate<T>
    }

    const draft = (await this.chain.getTableRows<DraftContract.Tables.Drafts.IDraft>({
      code: DraftContract.contractName.production,
      scope,
      table: DraftContract.Tables.Drafts.tableName,
      filter: { registry_id: String(registry_id) },
      ...(block_num ? { block_num } : {}),
      limit: 1,
    }))[0]

    if (!draft)
      throw new Error(`Шаблон ${registry_id} не найден${block_num ? ` на блоке ${block_num}` : ''}`)

    const translations = await this.chain.getTableRows<DraftContract.Tables.Translations.ITranslation>({
      code: DraftContract.contractName.production,
      scope,
      table: DraftContract.Tables.Translations.tableName,
      filter: { draft_id: String(draft.registry_id) },
      ...(block_num ? { block_num } : {}),
    })

    if (!translations.length)
      throw new Error(`Ни один перевод шаблона ${registry_id} не найден${block_num ? ` на блоке ${block_num}` : ''}`)

    /**
     * На один язык может прийти несколько записей — перевод могли завести
     * заново под другим идентификатором. Источник отдаёт строки от свежих
     * блоков к старым, поэтому первая встреченная запись языка и есть
     * актуальная: иначе документ собрался бы по устаревшей редакции текста.
     */
    const byLang = new Map<string, unknown>()
    for (const translation of translations) {
      if (!byLang.has(translation.lang))
        byLang.set(translation.lang, JSON.parse(translation.data))
    }

    return {
      title: draft.title,
      description: draft.description,
      model: JSON.parse(draft.model) as JSONSchemaType<T>,
      context: draft.context,
      translations: Object.fromEntries(byLang.entries()) as ITranslations,
    }
  }

  async cooperative(username: string, block_num?: number): Promise<CooperativeData> {
    const coop = await new CooperativeModel(this.storage, this.chain).getOne(username, block_num)
    if (!coop)
      throw new Error('Кооператив не найден')
    return coop
  }

  async vars(coopname: string, block_num?: number): Promise<IVars> {
    const vars = await new Vars(this.storage).getOne({ coopname, ...upTo(block_num) })
    if (!vars)
      throw new Error('Переменные кооператива не найдены')
    return vars
  }

  /** Субъект любого вида: физлицо, организация или ИП. Ровно один из трёх. */
  async user(username: string, block_num?: number): Promise<IUserAt> {
    const filter = { username, ...upTo(block_num) }
    const individual = await new Individual(this.storage).getOne(filter)
    const organization = await new Organization(this.storage).getOne(filter)
    const entrepreneur = await new Entrepreneur(this.storage).getOne(filter)

    const found: IUserAt = { type: '', data: {} as externalDataTypes }

    if (individual) {
      found.type = 'individual'
      found.data = individual
    }

    if (organization) {
      if (found.type !== '')
        throw new Error('Найдено более одного типа данных')
      found.type = 'organization'
      found.data = organization
    }

    if (entrepreneur) {
      if (found.type !== '')
        throw new Error('Найдено более одного типа данных')
      found.type = 'entrepreneur'
      found.data = entrepreneur
    }

    if (found.type === '')
      throw new Error('Пользователь не найден')

    return found
  }

  async organization(username: string, block_num?: number): Promise<IOrganizationData> {
    const organization = await new Organization(this.storage).getOne({ username, ...upTo(block_num) })
    if (!organization)
      throw new Error('Организация не найдена')
    return organization
  }

  /** Основной банковский счёт субъекта. */
  async bankAccount(username: string, block_num?: number): Promise<IBankAccount> {
    const method = await new PaymentMethod(this.storage).getOne({ username, ...upTo(block_num), method_type: 'bank_transfer', is_default: true })
    const account = method?.data as IBankAccount | undefined
    if (!account)
      throw new Error('Банковский счёт не найден')
    return account
  }

  /** Способ оплаты по отбору; нет записи — null, решает вызывающий. */
  async paymentMethod(filter: IPaymentMethodFilter): Promise<PaymentData | null> {
    const { block_num, ...rest } = filter
    return new PaymentMethod(this.storage).getOne({ ...rest, ...upTo(block_num) })
  }

  async project(id: string, block_num?: number): Promise<InternalProjectData> {
    const project = await new Project(this.storage).getOne({ id, ...upTo(block_num) })
    if (!project)
      throw new Error('Проект решения не найден')
    return project
  }

  /** Запись udata по ключу; нет записи — null, решает вызывающий. */
  async udata(filter: IUdataFilter): Promise<ExternalUdata | null> {
    return new Udata(this.storage).getOne(filter)
  }

  /** Приватные данные документа по хэшу; запись могла быть удалена. */
  async docDataByHash<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    return this.docData.get<P>(hash)
  }

  async saveDocData<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }> {
    return this.docData.save(payload, registry_id)
  }

  /** Строка собрания из цепи на блок, без вычисляемых полей. */
  async meetRow(coopname: string, meet_hash: string, block_num?: number): Promise<MeetContract.Tables.Meets.IOutput> {
    const rows = await this.chain.getTableRows<MeetContract.Tables.Meets.IOutput>({
      code: 'meet',
      scope: coopname,
      table: 'meets',
      filter: { hash: meet_hash.toUpperCase() },
      ...(block_num ? { block_num } : {}),
      limit: 1,
    })
    const meet = rows[0]
    if (!meet)
      throw new Error('Собрание не найдено')
    return meet
  }

  /** Вопросы собрания на блок, по порядку номеров. */
  async meetQuestionRows(coopname: string, meet_id: number, block_num?: number): Promise<MeetContract.Tables.Questions.IOutput[]> {
    const questions = await this.chain.getTableRows<MeetContract.Tables.Questions.IOutput>({
      code: 'meet',
      scope: coopname,
      table: 'questions',
      filter: { meet_id: String(meet_id) },
      ...(block_num ? { block_num } : {}),
    })
    // Номер вопроса приходит строкой — сравниваем как числа.
    return questions.sort((a, b) => Number.parseInt(a.number.toString(), 10) - Number.parseInt(b.number.toString(), 10))
  }

  /**
   * Голоса по решению совета — из действий, а не из дельт таблиц: когда
   * голосование и утверждение с удалением записи проходят в одном блоке,
   * промежуточных дельт нет, и по таблице видно лишь удаление.
   */
  async decisionVotes(coopname: string, decision_id: number): Promise<IDecisionVotes> {
    const votesFor = await this.chain.getActions({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.VoteFor.actionName,
      data: { decision_id: String(decision_id), coopname },
    })

    if (!votesFor || votesFor.length === 0) {
      const query = JSON.stringify({
        'account': SovietContract.contractName.production,
        'name': SovietContract.Actions.Decisions.VoteFor.actionName,
        'receiver': SovietContract.contractName.production,
        'data.decision_id': String(decision_id),
        'data.coopname': coopname,
      })
      throw new Error(`Голоса за решение не найдены ${query}`)
    }

    const votesAgainst = await this.chain.getActions({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.VoteAgainst.actionName,
      data: { decision_id: String(decision_id), coopname },
    })

    return { votes_for: votesFor.length, votes_against: votesAgainst ? votesAgainst.length : 0 }
  }

  /**
   * Подпись пайщика (картинка) из заявления на вступление: сохраняется при
   * первой сборке и читается при пересборке на блок.
   */
  async signature(username: string, block_num?: number): Promise<ISignatureRecord | null> {
    return new DataService<ISignatureRecord>(this.storage, 'signatures').getOne({ username, ...upTo(block_num) })
  }

  async saveSignature(record: ISignatureRecord): Promise<void> {
    await new DataService<ISignatureRecord>(this.storage, 'signatures').save(record)
  }

  /** Действие утверждения решения советом; нет — undefined. */
  async authorizedDecision(coopname: string, decision_id: number): Promise<SovietContract.Actions.Decisions.Authorize.IAuthorize | undefined> {
    const actions = await this.chain.getActions({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Authorize.actionName,
      data: { decision_id: String(decision_id), coopname },
      limit: 1,
    })
    return actions[0]?.data as SovietContract.Actions.Decisions.Authorize.IAuthorize | undefined
  }
}

export type { Cooperative }
