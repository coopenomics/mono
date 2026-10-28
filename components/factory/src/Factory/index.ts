import moment from 'moment-timezone'
import type { Cooperative, Interfaces, MeetContract } from 'cooptypes'
import { DraftContract } from 'cooptypes'
import type { IBankAccount, ICombinedData, IGeneratedDocument, IMetaDocument, IMetaDocumentPartial, ITemplate, ITranslations, externalDataTypes } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData, ExternalUdata, IVars, InternalProjectData, PaymentData } from '../Models'
import type { IGenerate, IGenerateBlank, IGeneratedBlank, IGenerationOptions } from '../Interfaces/Documents'
import { PDFService } from '../Services/Generator'
import { BLANK_PLACEHOLDER } from '../Services/Templator'
import packageJson from '../../package.json'
import { Validator } from '../Services/Validator'
import type { CooperativeData } from '../Models/Cooperative'
import { getCurrentBlock } from '../Utils/getCurrentBlock'
import { FactorySources, type IPaymentMethodFilter, type IUdataFilter, type IUserAt } from '../Sources'
import { DEFAULT_DOCUMENT_TIMEZONE, formatCreatedAt, nowCreatedAt, parseCreatedAt, splitCreatedAt } from '../Utils/documentCreatedAt'
import type { IOrganizationData } from '..'
import { formatDateTime } from '../Utils'
import type { IChainDataSource } from '../DataSource'

const packageVersion = packageJson.version

export type InternalGetUserResult = IUserAt

export abstract class DocFactory<T extends IGenerate> {
  abstract generateDocument(data: T, options?: IGenerationOptions): Promise<IGeneratedDocument>

  public storage: MongoDBConnector

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

  constructor(storage: MongoDBConnector) {
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
   * Локальные чтения (mongo: getUser/getCooperative/getProject/getVars) дёшевы,
   * но сетевые (getTemplate → explorer get-tables ×2, getMeta → getCurrentBlock
   * → get_info) шли строго последовательно и складывались в заметную задержку
   * сборки. Здесь они стартуют разом через Promise.all.
   *
   * ВАЖНО: сюда передавать ТОЛЬКО задачи без взаимных зависимостей. Зависимые
   * вызывать ПОСЛЕ, на полученных результатах:
   *   - getFullName(user.data) / getCommonUser(user) — зависят от user;
   *   - getDecision(coop, …, meta.created_at) — зависит от coop и meta;
   *   - getMeetQuestions(coopname, meet.id) / getGeneralMeetingDecision(meet) — от meet;
   *   - getProgram(request.program_id) — от request;
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
    const blankMeta: IMetaDocument = { ...meta, created_at: BLANK_PLACEHOLDER }

    const model = template.model as unknown as { properties?: Record<string, unknown> } | undefined
    const knownKeys = Object.keys(model?.properties ?? {})
    const translation = template.translations[blankMeta.lang]
    if (!translation)
      throw new Error(`Перевод шаблона ${data.registry_id} на язык ${blankMeta.lang} не найден`)

    // Форма заявления ветвится по типу пайщика: физлицо, ИП, организация —
    // отличаются только реквизиты подписанта. Бланк собирается для физлица:
    // это основная форма, иначе документ с ветвлением остался бы пустым.
    const subject = knownKeys.includes('type') ? { type: 'individual' } : {}
    // Параметры программы (условия ЦПП) совет утверждает вместе с текстом:
    // по хэшу они подставляются в бланк, без хэша остаются прочерком.
    const params = docData ? { doc_data: docData } : {}
    const html = new PDFService().renderBlankHtml(template.context, { ...subject, ...params, meta: blankMeta, created_at: BLANK_PLACEHOLDER, coop, vars }, translation, knownKeys)

    return { title: template.title, html, meta: blankMeta }
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

  async getRequest(_request_id: number, _block_num?: number): Promise<Cooperative.Model.ICommonRequest> {
    return {
      hash: '1234567890',
      title: 'Молоко Бурёнка',
      unit_of_measurement: 'литры',
      units: 100,
      unit_cost: '1000',
      total_cost: '100000',
      currency: 'RUB',
      type: 'receive',
      program_id: 1,
    }
  }

  async getProgram(_program_id: number): Promise<Cooperative.Model.ICommonProgram> {
    return {
      name: 'СОСЕДИ',
    }
  }

  async getGeneralMeetingDecision(meet: Interfaces.Meet.IMeet, created_at: string, timezone: string): Promise<Cooperative.Document.IDecisionData> {
    /**
     * Создаем данные решения общего собрания на основе данных собрания.
     * В отличие от getDecision (для решений совета), здесь используются данные кворума из IMeet.
     */

    const quorum_percent = Number(meet.current_quorum_percent) // Текущий процент кворума

    // Для общего собрания у нас есть общая информация о кворуме,
    // но конкретные голоса "за/против" есть в каждом вопросе отдельно
    const votes_for = 0 // Будет заполнено в questions
    const votes_against = 0 // Будет заполнено в questions
    const votes_abstained = 0 // Будет заполнено в questions

    const { date, time } = splitCreatedAt(created_at, timezone)

    return {
      id: Number(meet.id),
      date,
      time,
      votes_for,
      votes_against,
      votes_abstained,
      voters_percent: quorum_percent,
    }
  }

  async getDecision(coop: CooperativeData, coopname: string, decision_id: number, created_at: string, timezone: string): Promise<Cooperative.Document.IDecisionData> {
    const { votes_for, votes_against } = await this.sources.decisionVotes(coopname, decision_id)

    const total_members = coop.totalMembers
    const total_voters = votes_for + votes_against
    const votes_abstained = total_members - total_voters

    // Заседание совета заочное: повестку получают все члены совета, и все они участвуют в заседании. Кто не проголосовал,
    // записан воздержавшимся, поэтому участников столько же, сколько членов совета, и кворум составляет 100 %.
    const participants = total_voters + votes_abstained
    const voters_percent: number = Number.parseFloat((participants / total_members * 100).toFixed(0))

    const { date, time } = splitCreatedAt(created_at, timezone)

    return {
      id: decision_id,
      date,
      time,
      votes_for,
      votes_against,
      votes_abstained,
      voters_percent,
    }
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

    // Председатель и секретарь собрания — полными именами для шаблона.
    const presiderData = await this.getUser(meet.presider, block_num)
    const secretaryData = await this.getUser(meet.secretary, block_num)

    return {
      ...meet,
      current_quorum_percent: Number(Number(meet.current_quorum_percent).toFixed(1)),
      close_at_datetime: formatDateTime(meet.close_at),
      open_at_datetime: formatDateTime(meet.open_at),
      presider_full_name: this.getFullParticipantName(presiderData.data),
      secretary_full_name: this.getFullParticipantName(secretaryData.data),
    }
  }

  async getMeetQuestions(coopname: string, meet_id: number, block_num?: number): Promise<Cooperative.Model.IQuestionExtended[]> {
    const questions = await this.sources.meetQuestionRows(coopname, meet_id, block_num)

    // Вопросы с вычисленными итогами голосования.
    return questions.map((question) => {
      const votesFor = Number(question.counter_votes_for)
      const votesAgainst = Number(question.counter_votes_against)
      const votesAbstained = Number(question.counter_votes_abstained)
      const votesTotal = votesFor + votesAgainst + votesAbstained

      // Защита от деления на ноль: без голосов все доли нулевые.
      const calculatePercent = (value: number): number => {
        if (votesTotal === 0)
          return 0
        return Math.round((value / votesTotal) * 100)
      }

      // Решение принято, если «за» больше половины голосов.
      const isAccepted = votesTotal > 0 && votesFor > votesTotal / 2
      return {
        ...question,
        votes_total: votesTotal,
        votes_for_percent: calculatePercent(votesFor),
        votes_against_percent: calculatePercent(votesAgainst),
        votes_abstained_percent: calculatePercent(votesAbstained),
        is_accepted: isAccepted,
      } as Cooperative.Model.IQuestionExtended
    })
  }

  /**
   * Определяет как пользователь проголосовал по конкретному вопросу
   * @param question Вопрос голосования
   * @param username Имя пользователя
   * @returns 'for', 'against' или 'abstained'
   */
  getUserVote(question: MeetContract.Tables.Questions.IOutput, username: string): 'for' | 'against' | 'abstained' {
    // Проверяем, есть ли пользователь в списке проголосовавших "За"
    if (question.voters_for && question.voters_for.includes(username)) {
      return 'for'
    }

    // Проверяем, есть ли пользователь в списке проголосовавших "Против"
    if (question.voters_against && question.voters_against.includes(username)) {
      return 'against'
    }

    // Проверяем, есть ли пользователь в списке воздержавшихся
    if (question.voters_abstained && question.voters_abstained.includes(username)) {
      return 'abstained'
    }

    // Если пользователь не найден ни в одном из списков, считаем, что он воздержался
    return 'abstained'
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
    const pdfService = new PDFService()

    // Шаблон показывает дату человеку переменной `created_at`, а мета хранит
    // момент генерации в ISO: вид для человека собирается только здесь.
    const displayCreatedAt = formatCreatedAt(meta.created_at, meta.timezone)
    const renderVars: ICombinedData = { ...vars, created_at: displayCreatedAt }
    // Редакция, утверждённая советом до 28.09.2026, собирается текстом того
    // времени и выводит дату как `meta.created_at`. Только ей мета для показа
    // даётся с датой в виде для человека; сохраняется и подписывается мета с ISO.
    if (context.includes('meta.created_at'))
      renderVars.meta = { ...meta, created_at: displayCreatedAt }

    /**
     * skip_pdf — документ нужен только для показа на экране. Собираем HTML тем
     * же движком подстановки и пропускаем weasyprint: без PDF нет и хэша,
     * поэтому такой документ не сохраняется ни при каком skip_save — сохранить
     * его значило бы завести в базе черновик, который нечем подписать.
     */
    if (skip_pdf) {
      const html = pdfService.renderHtml(context, renderVars, translation)

      return { full_title: '', html, hash: '', binary: new Uint8Array(), meta }
    }

    const document: IGeneratedDocument = await pdfService.generateDocument(context, renderVars, translation, meta)
    const full_name = this.getFullName(data)

    document.full_title = `${document.meta.title} - ${full_name} - ${displayCreatedAt}.pdf`

    if (!skip_save)
      await this.saveDraft(document)

    return document
  }

  getFullName(data: externalDataTypes | string): string {
    if (typeof data === 'string') {
      return data // Если data — строка, вернуть как есть
    }

    if ('first_name' in data) {
      return `${data.last_name} ${data.first_name} ${data.middle_name}`
    }

    if ('represented_by' in data) {
      return `${data.represented_by.last_name} ${data.represented_by.first_name} ${data.represented_by.middle_name}`
    }

    return ''
  }

  getFullParticipantName(data: externalDataTypes): string {
    if ('first_name' in data) {
      return `${data.last_name} ${data.first_name} ${data.middle_name}`
    }
    else if ('short_name' in data) {
      return data.short_name
    }

    return ''
  }

  getFirstLastMiddleName(data: externalDataTypes): Cooperative.Model.IFirstLastMiddleName {
    return {
      first_name: 'first_name' in data ? data.first_name : '',
      last_name: 'last_name' in data ? data.last_name : '',
      middle_name: 'middle_name' in data ? data.middle_name : '',
    }
  }

  extractOrganizationName(input: ExternalOrganizationData): string {
    // Регулярное выражение для извлечения названия организации

    const regex = /["'«»]([^"'«»]+)["'«»]/

    const match = input.short_name.match(regex)

    if (match) {
      // Если найдены кавычки, извлекаем содержимое
      return match[1].trim().toUpperCase()
    }

    // Если кавычек нет, берем последнее слово
    const words = input.short_name.trim().split(/\s+/)
    const lastWord = words[words.length - 1]

    if (!lastWord) {
      throw new Error(`Не удалось извлечь имя организации из: "${input.short_name}"`)
    }

    return lastWord.toUpperCase()
  }

  extractPersonalAbbreviatedName(input: ExternalIndividualData | ExternalEntrepreneurData): string {
    return `${input.first_name[0]}${input.middle_name[0]}${input.last_name[0]}`.toUpperCase()
  }

  parseDateForAgreements(created_at: string, timezone: string): { day: string, month: string, year: string } {
    const dateWithTimezone = created_at
      ? parseCreatedAt(created_at, timezone)
      : moment.tz(timezone)

    return {
      day: dateWithTimezone.format('DD'),
      month: dateWithTimezone.format('MM'),
      year: dateWithTimezone.format('YY'),
    }
  }

  constructUHDContractNumber(contributor_hash: string): string {
    return `УХД-${this.getShortHash(contributor_hash)}`
  }

  getCommonUser(input: InternalGetUserResult): Cooperative.Model.ICommonUser {
    switch (input.type) {
      case 'individual':
      case 'entrepreneur': {
        const data = input.data as ExternalEntrepreneurData | ExternalIndividualData
        return {
          abbr_full_name: this.extractPersonalAbbreviatedName(data),
          full_name_or_short_name: this.getFullParticipantName(data),
          birthdate_or_ogrn: data.birthdate,
          email: data.email,
          phone: data.phone,
        }
      }

      case 'organization': {
        const data = input.data as ExternalOrganizationData
        return {
          abbr_full_name: this.extractOrganizationName(data),
          full_name_or_short_name: this.getFullParticipantName(data),
          birthdate_or_ogrn: data.details.ogrn,
          email: data.email,
          phone: data.phone,
        }
      }

      default:
        throw new Error(`cant extract common user data`)
    }
  }

  getShortHash(hash: string, length: number = 16): string {
    // Если строка содержит дефисы или пробелы, значит это уже номер договора, не обрезаем
    if (hash.includes('-') || hash.includes(' ')) {
      return hash
    }
    return hash.substring(0, length).toUpperCase()
  }

  async saveDraft(document: IGeneratedDocument): Promise<void> {
    await this.storage.saveDraft(document)
  }

  async getMeta<T extends IMetaDocumentPartial>({
    title,
    username,
    coopname,
    registry_id,
    links = [],
    lang = 'ru',
    generator = 'coopjs',
    version = packageVersion, // TODO перенести в .env
    created_at,
    block_num,
    timezone = DEFAULT_DOCUMENT_TIMEZONE, // TODO перенести в .env
    ...restParams
  }: T): Promise<IMetaDocument> {
    if (!title)
      throw new Error('Заголовок документа должен быть установлен')

    if (!registry_id)
      throw new Error('Параметр номера документа в реестре должен быть передан')

    // Дата приходит снаружи только при перегенерации документа — она берётся
    // как есть, чтобы мета и хэш совпали с исходными; непонятную дату разбор
    // отвергает. Новая генерация пишет момент в ISO до миллисекунд.
    if (created_at)
      parseCreatedAt(created_at, timezone)
    const createdAt = created_at || nowCreatedAt()

    if (!block_num)
      block_num = await getCurrentBlock()

    return {
      title,
      lang,
      registry_id,
      generator,
      links,
      version,
      coopname,
      username,
      created_at: createdAt,
      block_num,
      timezone,
      ...restParams,
    }
  }

  /**
   * Truncate (toward-zero) числовой строки до displayPrecision знаков
   * на уровне строки — без FP-погрешности (0.29 * 100 = 28.999... в IEEE 754).
   * Принцип: «никогда не показать в документе сумму больше реальной».
   */
  private truncateDecimal(numericStr: string, displayPrecision: number): string {
    const negative = numericStr.startsWith('-')
    const abs = negative ? numericStr.slice(1) : numericStr
    const [intPartRaw, decPartRaw = ''] = abs.split('.')
    const intPart = intPartRaw || '0'
    const decPart = decPartRaw.padEnd(displayPrecision, '0').slice(0, displayPrecision)
    const result = displayPrecision > 0 ? `${intPart}.${decPart}` : intPart
    return negative ? `-${result}` : result
  }

  public formatShare(value: string | number, precision: number = 2): string {
    const str = typeof value === 'string' ? value : value.toString()
    const parsed = Number.parseFloat(str)
    if (Number.isNaN(parsed))
      return typeof value === 'string' ? value : value.toString()
    return this.truncateDecimal(parsed.toFixed(precision + 4), precision)
  }

  /**
   * Сумма для текста документа — единственный способ писать деньги: два знака
   * после точки, остальное отсекается. Принимает сумму с символом валюты
   * («300.0000 RUB» → «300.00 RUB») и голое число («300.0000» → «300.00») —
   * второе нужно шаблонам, где валюта стоит в подписи колонки. Строку иного
   * вида (уже оформленную человеком) отдаёт как есть.
   */
  public formatAsset(asset: string | number, precision: number = 2): string {
    if (asset === undefined || asset === null || asset === '')
      return ''
    const text = String(asset).trim()
    const match = text.match(/^(-?\d+(?:\.\d+)?)(?:\s+([A-Z]+))?$/)
    if (!match)
      return text
    const [, amount, symbol] = match
    const value = this.truncateDecimal(amount, precision)
    return symbol ? `${value} ${symbol}` : value
  }

  public formatPaymentDetails(paymentMethod: any, recipientName: string): string {
    switch (paymentMethod.method_type) {
      case 'bank_transfer': {
        const bankData = paymentMethod.data as any // IBankAccount из cooptypes
        return `№ счета получателя: ${bankData.account_number}\nБанк получателя: ${bankData.bank_name}\nКорр. счет банка: ${bankData.details?.corr || ''}\nБИК ${bankData.details?.bik || ''}\nПолучатель: ${recipientName}`
      }
      case 'sbp': {
        const sbpData = paymentMethod.data as any // ISbpDetails из cooptypes
        return `СБП\nТелефон получателя: ${sbpData.phone}`
      }
      default:
        return JSON.stringify(paymentMethod.data)
    }
  }
}
