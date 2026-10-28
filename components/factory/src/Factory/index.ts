import type { Cooperative, Interfaces, MeetContract } from 'cooptypes'
import { DraftContract } from 'cooptypes'
import type { IBankAccount, ICombinedData, IGeneratedDocument, IMetaDocument, IMetaDocumentPartial, ITemplate, ITranslations, externalDataTypes } from '../Interfaces'
import type { IFactoryStorage } from '../Storage'
import { documentMetaKey } from '../Utils/documentMetaKey'
import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData, ExternalUdata, IVars, InternalProjectData, PaymentData } from '../Models'
import type { IGenerate, IGenerateBlank, IGeneratedBlank, IGenerationOptions } from '../Interfaces/Documents'
import packageJson from '../../package.json'
import { Validator } from '../Services/Validator'
import type { CooperativeData } from '../Models/Cooperative'
import { getCurrentBlock } from '../Utils/getCurrentBlock'
import { FactorySources, type IPaymentMethodFilter, type IUdataFilter, type IUserAt } from '../Sources'
import * as Format from '../Format'
import { buildMeta } from '../Meta'
import { renderBlank, renderDocument } from '../Render'
import { BLANK_PLACEHOLDER } from '../Services/Templator'
import { DEFAULT_DOCUMENT_TIMEZONE, nowCreatedAt } from '../Utils/documentCreatedAt'
import type { IOrganizationData } from '..'
import type { IChainDataSource } from '../DataSource'

const packageVersion = packageJson.version

export type InternalGetUserResult = IUserAt

export abstract class DocFactory<T extends IGenerate> {
  abstract generateDocument(data: T, options?: IGenerationOptions): Promise<IGeneratedDocument>

  public storage: IFactoryStorage

  /**
   * Все чтения данных — через слой источников (шаг 1 фабрики v2). Методы
   * `getX` ниже остались как фасад для сборщиков: их сигнатуры не менялись,
   * чтобы 92 действия переехали без правок.
   */
  protected readonly sources: FactorySources

  /**
   * Откуда брать данные цепи. Проставляется Generator'ом сразу после создания
   * фабрик — так источник задаётся одним местом и не тянется через конструктор
   * каждой из десятков фабрик документов.
   */
  private dataSource?: IChainDataSource

  constructor(storage: IFactoryStorage) {
    this.storage = storage
    this.sources = new FactorySources(storage, () => this.chain)
  }

  setDataSource(dataSource: IChainDataSource): void {
    this.dataSource = dataSource
  }

  /**
   * Источник данных цепи. Отсутствует — это ошибка сборки приложения, а не
   * повод молча вернуть пустой документ: без данных цепи документ выйдет
   * без реквизитов кооператива и без текста шаблона.
   */
  protected get chain(): IChainDataSource {
    if (!this.dataSource)
      throw new Error('Источник данных цепи не задан: фабрика создана в обход Generator')

    return this.dataSource
  }

  /**
   * Параллельно резолвит ВЗАИМНО НЕЗАВИСИМЫЕ источники данных документа.
   *
   * Локальные чтения (хранилище: getUser/getCooperative/getProject/getVars) дёшевы,
   * но сетевые (getTemplate → explorer get-tables ×2, getMeta → getCurrentBlock
   * → get_info) шли строго последовательно и складывались в заметную задержку
   * сборки. Здесь они стартуют разом через Promise.all.
   *
   * ВАЖНО: сюда передавать ТОЛЬКО задачи без взаимных зависимостей. Зависимые
   * вызывать ПОСЛЕ, на полученных результатах:
   *   - getFullName(user.data) / getCommonUser(user) — зависят от user;
   *   - getDecision(coop, …, meta.created_at) — зависит от coop и meta;
   *   - getMeetQuestions(coopname, meet.id) / getGeneralMeetingDecision(meet) — от meet;
   *   - getMeta({ title: project.title }) — если title выводится из project/coop.
   *
   * Ключи объекта-результата соответствуют ключам переданных задач.
   */
  protected async resolveParallel<T extends Record<string, () => Promise<any>>>(
    tasks: T,
  ): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
    const entries = Object.entries(tasks)
    const values = await Promise.all(entries.map(([, fn]) => fn()))
    const result = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> }
    entries.forEach(([key], index) => {
      result[key as keyof T] = values[index]
    })
    return result
  }

  /**
   * Бланк документа: шаблон из цепи с реквизитами кооператива, а всё, что
   * известно только в момент события (пайщик, суммы, платёжные данные), —
   * прочерком. Совет утверждает форму документа, а не его экземпляр, и форма
   * любого документа реестра собирается одним и тем же путём — без данных,
   * которых у совета нет. Дата бланка тоже прочерк: форма не зависит от дня,
   * когда её открыли, и отпечаток её текста устойчив.
   */
  async generateBlank(data: IGenerateBlank): Promise<IGeneratedBlank> {
    const { template, coop, vars, docData } = await this.resolveParallel({
      template: () => this.getTemplate<unknown>(DraftContract.contractName.production, data.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      docData: () => this.loadDocData<Record<string, unknown>>(data),
    })

    const meta: IMetaDocument = await this.getMeta({
      title: template.title,
      coopname: data.coopname,
      username: data.coopname,
      registry_id: data.registry_id,
      ...(data.block_num ? { block_num: data.block_num } : {}),
      ...(data.lang ? { lang: data.lang } : {}),
    })
    const model = template.model as unknown as { properties?: Record<string, unknown> } | undefined
    const knownKeys = Object.keys(model?.properties ?? {})
    const translation = template.translations[meta.lang]
    if (!translation)
      throw new Error(`Перевод шаблона ${data.registry_id} на язык ${meta.lang} не найден`)

    // Форма заявления ветвится по типу пайщика: физлицо, ИП, организация —
    // отличаются только реквизиты подписанта. Бланк собирается для физлица:
    // это основная форма, иначе документ с ветвлением остался бы пустым.
    const subject = knownKeys.includes('type') ? { type: 'individual' } : {}
    // Параметры программы (условия ЦПП) совет утверждает вместе с текстом:
    // по хэшу они подставляются в бланк, без хэша остаются прочерком.
    const params = docData ? { doc_data: docData } : {}
    const html = renderBlank({ context: template.context, vars: { ...subject, ...params, coop, vars }, translation, meta, knownKeys })

    return { title: template.title, html, meta: { ...meta, created_at: BLANK_PLACEHOLDER } }
  }

  async validate(combinedData: ICombinedData, schema: any) {
    return new Validator(schema, combinedData).validate()
  }

  /**
   * Сохранить приватный payload документа и получить его hash.
   * Hash безопасно публикуется on-chain как `doc_data_hash`; сам payload
   * остаётся off-chain в коллекции `doc_private_data`.
   * См. раздел «Document Generation Pattern: doc_data» в архитектуре.
   */
  async saveDocData<P extends Record<string, unknown>>(payload: P, registry_id: number): Promise<{ hash: string }> {
    return this.sources.saveDocData(payload, registry_id)
  }

  /**
   * Прочитать приватный payload по `doc_data_hash`.
   * Возвращает null если запись удалена (документ остаётся верифицируемым
   * по хэшу подписи, но не регенерируется — graceful degradation).
   */
  async getDocData<P = Record<string, unknown>>(hash: string): Promise<P | null> {
    return this.sources.docDataByHash<P>(hash)
  }

  /**
   * Помощник для конкретных фабрик: подгружает приватный payload по
   * `data.doc_data_hash` и возвращает его (или null, если хэш не задан /
   * запись удалена). Фабрика кладёт результат в `combinedData.doc_data` —
   * шаблон документа обращается к полям как `{{ doc_data.<field> }}`.
   */
  async loadDocData<P = Record<string, unknown>>(data: { doc_data_hash?: string }): Promise<P | null> {
    if (!data.doc_data_hash)
      return null
    return this.getDocData<P>(data.doc_data_hash)
  }

  async getOrganization(username: string, block_num?: number): Promise<IOrganizationData> {
    return this.sources.organization(username, block_num)
  }

  async getBankAccount(username: string, block_num?: number): Promise<IBankAccount> {
    return this.sources.bankAccount(username, block_num)
  }

  /** Способ оплаты по отбору (номер способа, вид, основной); нет записи — null. */
  async getPaymentMethod(filter: IPaymentMethodFilter): Promise<PaymentData | null> {
    return this.sources.paymentMethod(filter)
  }

  /** Запись udata пайщика по ключу на блок; нет записи — null. */
  async getUdata(filter: IUdataFilter): Promise<ExternalUdata | null> {
    return this.sources.udata(filter)
  }

  async getUser(username: string, block_num?: number): Promise<InternalGetUserResult> {
    return this.sources.user(username, block_num)
  }

  async getCooperative(username: string, block_num?: number): Promise<CooperativeData> {
    return this.sources.cooperative(username, block_num)
  }

  async getProject(id: string, block_num?: number): Promise<InternalProjectData> {
    return this.sources.project(id, block_num)
  }

  async getVars(coopname: string, block_num?: number): Promise<IVars> {
    return this.sources.vars(coopname, block_num)
  }

  async getGeneralMeetingDecision(meet: Interfaces.Meet.IMeet, created_at: string, timezone: string): Promise<Cooperative.Document.IDecisionData> {
    return Format.generalMeetingDecisionData(meet, created_at, timezone)
  }

  async getDecision(coop: CooperativeData, coopname: string, decision_id: number, created_at: string, timezone: string): Promise<Cooperative.Document.IDecisionData> {
    const votes = await this.sources.decisionVotes(coopname, decision_id)
    return Format.decisionData(votes, coop.totalMembers, decision_id, created_at, timezone)
  }

  async getApprovedDecision(coop: CooperativeData, coopname: string, decision_id: number): Promise<Cooperative.Document.IDecisionData> {
    // Принятое решение — из действия authorize: в нём мета документа решения с датой.
    const decision = await this.sources.authorizedDecision(coopname, decision_id)

    if (!decision) {
      throw new Error(`Принятое решение не найдено в действиях authorize: decision_id=${decision_id}, coopname=${coopname}`)
    }

    const authorizationDoc = decision.document

    if (!authorizationDoc) {
      throw new Error(`Документ авторизации не найден в решении: decision_id=${decision_id}`)
    }

    let decisionCreatedAt: string
    let decisionTimezone: string
    try {
      const meta = JSON.parse(authorizationDoc.meta || '{}')
      decisionCreatedAt = meta.created_at
      decisionTimezone = meta.timezone || DEFAULT_DOCUMENT_TIMEZONE

      if (!decisionCreatedAt) {
        throw new Error('Поле created_at не найдено в мета-данных авторизации')
      }
    }
    catch (error) {
      throw new Error(`Ошибка парсинга мета-данных авторизации решения ${decision_id}: ${error}`)
    }

    return this.getDecision(coop, coopname, decision_id, decisionCreatedAt, decisionTimezone)
  }

  async getMeet(coopname: string, meet_hash: string, block_num?: number): Promise<Cooperative.Model.IMeetExtended> {
    const meet = await this.sources.meetRow(coopname, meet_hash, block_num)
    const presider = await this.getUser(meet.presider, block_num)
    const secretary = await this.getUser(meet.secretary, block_num)
    return Format.extendMeet(meet, Format.fullParticipantName(presider.data), Format.fullParticipantName(secretary.data))
  }

  async getMeetQuestions(coopname: string, meet_id: number, block_num?: number): Promise<Cooperative.Model.IQuestionExtended[]> {
    return Format.extendQuestions(await this.sources.meetQuestionRows(coopname, meet_id, block_num))
  }

  /**
   * Определяет как пользователь проголосовал по конкретному вопросу
   * @param question Вопрос голосования
   * @param username Имя пользователя
   * @returns 'for', 'against' или 'abstained'
   */
  getUserVote(question: MeetContract.Tables.Questions.IOutput, username: string): 'for' | 'against' | 'abstained' {
    return Format.userVote(question, username)
  }

  async getTemplate<T>(scope: string, registry_id: number, block_num?: number): Promise<ITemplate<T>> {
    return this.sources.template<T>(scope, registry_id, block_num)
  }

  async generatePDF(
    data: externalDataTypes | string,
    context: string,
    vars: ICombinedData,
    translation: ITranslations,
    meta: IMetaDocument,
    skip_save: boolean = false,
    skip_pdf: boolean = false,
  ): Promise<IGeneratedDocument> {
    const document = await renderDocument({ context, vars, translation, meta, signerName: Format.fullName(data), skip_pdf })

    // Документ без PDF (только показ) не сохраняется: его нечем подписать.
    if (!skip_pdf && !skip_save)
      await this.saveDraft(document)

    return document
  }

  getFullName(data: externalDataTypes | string): string {
    return Format.fullName(data)
  }

  getFullParticipantName(data: externalDataTypes): string {
    return Format.fullParticipantName(data)
  }

  getFirstLastMiddleName(data: externalDataTypes): Cooperative.Model.IFirstLastMiddleName {
    return Format.firstLastMiddleName(data)
  }

  extractOrganizationName(input: ExternalOrganizationData): string {
    return Format.organizationAbbreviatedName(input)
  }

  extractPersonalAbbreviatedName(input: ExternalIndividualData | ExternalEntrepreneurData): string {
    return Format.personalAbbreviatedName(input)
  }

  parseDateForAgreements(created_at: string, timezone: string): { day: string, month: string, year: string } {
    return Format.dateForAgreements(created_at, timezone)
  }

  constructUHDContractNumber(contributor_hash: string): string {
    return Format.uhdContractNumber(contributor_hash)
  }

  getCommonUser(input: InternalGetUserResult): Cooperative.Model.ICommonUser {
    return Format.commonUser(input)
  }

  getShortHash(hash: string, length: number = 16): string {
    return Format.shortHash(hash, length)
  }

  async saveDraft(document: IGeneratedDocument): Promise<void> {
    await this.storage.saveDocument({ ...document, meta_key: documentMetaKey(document.meta) })
  }

  async getMeta<T extends IMetaDocumentPartial>(input: T): Promise<IMetaDocument> {
    return buildMeta(input, { version: packageVersion, now: nowCreatedAt, currentBlock: getCurrentBlock })
  }

  public formatShare(value: string | number, precision: number = 2): string {
    return Format.formatShare(value, precision)
  }

  /**
   * Сумма для текста документа — единственный способ писать деньги: два знака
   * после точки, остальное отсекается. Принимает сумму с символом валюты
   * («300.0000 RUB» → «300.00 RUB») и голое число («300.0000» → «300.00») —
   * второе нужно шаблонам, где валюта стоит в подписи колонки. Строку иного
   * вида (уже оформленную человеком) отдаёт как есть.
   */
  public formatAsset(asset: string | number, precision: number = 2): string {
    return Format.formatAsset(asset, precision)
  }

  public formatPaymentDetails(paymentMethod: any, recipientName: string): string {
    return Format.paymentDetails(paymentMethod, recipientName)
  }
}
