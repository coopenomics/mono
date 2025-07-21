import type { JSONSchemaType } from 'ajv'
import moment from 'moment-timezone'
import type { Cooperative, Interfaces, MeetContract } from 'cooptypes'
import { DraftContract, SovietContract } from 'cooptypes'
import type { IBankAccount, ICombinedData, IGeneratedDocument, IMetaDocument, IMetaDocumentPartial, IPaymentData, ITemplate, ITranslations, externalDataTypes } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { type ExternalEntrepreneurData, type ExternalIndividualData, type ExternalOrganizationData, type IVars, Individual, type InternalProjectData, Organization, PaymentMethod, Project, Vars } from '../Models'
import type { IGenerate, IGenerationOptions } from '../Interfaces/Documents'
import { PDFService } from '../Services/Generator'
import packageJson from '../../package.json'
import { Validator } from '../Services/Validator'
import type { CooperativeData } from '../Models/Cooperative'
import { Cooperative as CooperativeModel } from '../Models/Cooperative'
import { Entrepreneur } from '../Models/Entrepreneur'
import { getFetch } from '../Utils/getFetch'
import { getEnvVar } from '../config'
import { getCurrentBlock } from '../Utils/getCurrentBlock'
import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '..'
import { formatDateTime } from '../Utils'

const packageVersion = packageJson.version

export interface InternalGetUserResult { type: string, data: externalDataTypes }

export abstract class DocFactory<T extends IGenerate> {
  abstract generateDocument(data: T, options?: IGenerationOptions): Promise<IGeneratedDocument>

  public storage: MongoDBConnector

  constructor(storage: MongoDBConnector) {
    this.storage = storage
  }

  async validate(combinedData: ICombinedData, schema: any) {
    return new Validator(schema, combinedData).validate()
  }

  async getOrganization(username: string, block_num?: number): Promise<IOrganizationData> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const organization = await new Organization(this.storage).getOne({ username, ...block_filter })
    if (!organization)
      throw new Error('Организация не найдена')

    return organization
  }

  async getBankAccount(username: string, block_num?: number): Promise<IBankAccount> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const method = (await new PaymentMethod(this.storage).getOne({ username, ...block_filter, method_type: 'bank_transfer', is_default: true }))?.data as IBankAccount

    if (!method)
      throw new Error('Банковский счёт не найден')

    return method
  }

  async getUser(username: string, block_num?: number): Promise<InternalGetUserResult> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const individual = await new Individual(this.storage).getOne({ username, ...block_filter })
    const organization = await new Organization(this.storage).getOne({ username, ...block_filter })
    const entrepreneur = await new Entrepreneur(this.storage).getOne({ username, ...block_filter })

    const userData: { type: string, data: externalDataTypes } = {
      type: '',
      data: {} as externalDataTypes,
    }

    if (individual) {
      userData.type = 'individual'
      userData.data = individual
    }

    if (organization) {
      if (userData.type !== '')
        throw new Error('Найдено более одного типа данных')

      userData.type = 'organization'
      userData.data = organization
    }

    if (entrepreneur) {
      if (userData.type !== '')
        throw new Error('Найдено более одного типа данных')

      userData.type = 'entrepreneur'
      userData.data = entrepreneur
    }

    if (userData.type === '')
      throw new Error('Пользователь не найден')

    return userData
  }

  async getCooperative(username: string, block_num?: number): Promise<CooperativeData> {
    const coop = await new CooperativeModel(this.storage).getOne(username, block_num)

    if (!coop)
      throw new Error('Кооператив не найден')
    return coop
  }

  async getProject(id: string, block_num?: number): Promise<InternalProjectData> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const project = await new Project(this.storage).getOne({ id, ...block_filter })

    if (!project)
      throw new Error('Проект решения не найден')
    return project
  }

  async getVars(coopname: string, block_num?: number): Promise<IVars> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const vars = await new Vars(this.storage).getOne({ coopname, ...block_filter })

    if (!vars)
      throw new Error('Переменные кооператива не найдены')
    return vars
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

  async getGeneralMeetingDecision(meet: Interfaces.Meet.IMeet, created_at: string): Promise<Cooperative.Document.IDecisionData> {
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

    const [date, time] = created_at.split(' ')

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

  async getDecision(coop: CooperativeData, coopname: string, decision_id: number, created_at: string): Promise<Cooperative.Document.IDecisionData> {
    /**
     * Мы здесь извлекаем голоса из действий, а не из дельт таблиц т.к. в случае использования дельт возможна исключительная ситуация,
     * когда за решение принимаются голоса и происходит утверждение из дальнейшим удалением объекта из памяти в одном блоке, то
     * промежуточные дельты не фиксируются, а мы сможем увидеть только результат - удаление, т.е. пустой объект.
     * Позже перепроверить еще раз.
     */
    // const decision = (await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-tables`, new URLSearchParams({
    //   filter: JSON.stringify({
    //     code: SovietContract.contractName.production,
    //     scope: coopname,
    //     table: SovietContract.Tables.Decisions.tableName,
    //     primary_key: String(decision_id),
    //     present: true,
    //   }),
    //   limit: String(1),
    // })))?.results[0]

    // if (!decision)
    //   throw new Error('Объект решения не найден')

    const votes_for_actions = (await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-actions`, new URLSearchParams({
      filter: JSON.stringify({
        'account': SovietContract.contractName.production,
        'name': SovietContract.Actions.Decisions.VoteFor.actionName,
        'receiver': SovietContract.contractName.production,
        'data.decision_id': String(decision_id),
        'data.coopname': coopname,
      }),
    })))?.results

    if (!votes_for_actions || votes_for_actions.length === 0)
      throw new Error('Голоса за решение не найдены')

    const votes_against_actions = (await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-actions`, new URLSearchParams({
      filter: JSON.stringify({
        'account': SovietContract.contractName.production,
        'name': SovietContract.Actions.Decisions.VoteAgainst.actionName,
        'receiver': SovietContract.contractName.production,
        'data.decision_id': String(decision_id),
        'data.coopname': coopname,
      }),
    })))?.results

    const votes_against = votes_against_actions ? votes_against_actions.length : 0
    const votes_for = votes_for_actions.length

    const total_members = coop.totalMembers
    const total_voters = votes_for + votes_against
    const votes_abstained = total_members - total_voters

    const voters_percent: number = Number.parseFloat((total_voters / total_members * 100).toFixed(0))

    const [date, time] = created_at.split(' ')

    return {
      id: decision_id,
      date,
      time,
      votes_for,
      votes_against,
      votes_abstained,
      voters_percent,
      // decision,
    }
  }

  async getMeet(coopname: string, meet_hash: string, block_num?: number): Promise<Cooperative.Model.IMeetExtended> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const meetResponse = await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-tables`, new URLSearchParams({
      filter: JSON.stringify({
        'code': 'meet',
        'scope': coopname,
        'table': 'meets',
        'value.hash': meet_hash.toUpperCase(),
        ...block_filter,
      }),
      limit: String(1),
    }))

    const meet = meetResponse.results[0]?.value as MeetContract.Tables.Meets.IOutput

    if (!meet)
      throw new Error('Собрание не найдено')

    // Получаем данные о председателе и секретаре собрания
    const presiderData = await this.getUser(meet.presider, block_num)
    const secretaryData = await this.getUser(meet.secretary, block_num)

    // Получаем полные имена
    const presiderFullName = this.getFullParticipantName(presiderData.data)
    const secretaryFullName = this.getFullParticipantName(secretaryData.data)

    // Преобразуем формат даты для шаблона
    const meetExtended: Cooperative.Model.IMeetExtended = {
      ...meet,
      current_quorum_percent: Number(Number(meet.current_quorum_percent).toFixed(1)),
      close_at_datetime: formatDateTime(meet.close_at),
      open_at_datetime: formatDateTime(meet.open_at),
      presider_full_name: presiderFullName,
      secretary_full_name: secretaryFullName,
    }

    return meetExtended
  }

  async getMeetQuestions(coopname: string, meet_id: number, block_num?: number): Promise<Cooperative.Model.IQuestionExtended[]> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const questionsResponse = await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-tables`, new URLSearchParams({
      filter: JSON.stringify({
        'code': 'meet',
        'scope': coopname,
        'table': 'questions',
        'value.meet_id': String(meet_id),
        ...block_filter,
      }),
    }))

    const questions = questionsResponse.results?.map((result: any) => result.value) as MeetContract.Tables.Questions.IOutput[] || []

    // Сортировка вопросов по номеру (с учетом, что number может быть строкой)
    questions.sort((a, b) => {
      // Преобразуем в числа для корректного сравнения
      const numA = Number.parseInt(a.number.toString(), 10)
      const numB = Number.parseInt(b.number.toString(), 10)
      return numA - numB
    })

    // Преобразуем вопросы в расширенную модель с вычисленными результатами
    const extendedQuestions = questions.map((question) => {
      // Преобразуем значения голосов в числа
      const votesFor = Number(question.counter_votes_for)
      const votesAgainst = Number(question.counter_votes_against)
      const votesAbstained = Number(question.counter_votes_abstained)

      // Вычисляем общее количество голосов
      const votesTotal = votesFor + votesAgainst + votesAbstained

      // Вычисляем проценты (защита от деления на ноль)
      const calculatePercent = (value: number): number => {
        if (votesTotal === 0)
          return 0
        return Math.round((value / votesTotal) * 100)
      }

      // Определяем, принято ли решение (более 50% голосов "за")
      const isAccepted = votesTotal > 0 && votesFor > votesTotal / 2
      // Возвращаем расширенный объект вопроса
      return {
        ...question,
        votes_total: votesTotal,
        votes_for_percent: calculatePercent(votesFor),
        votes_against_percent: calculatePercent(votesAgainst),
        votes_abstained_percent: calculatePercent(votesAbstained),
        is_accepted: isAccepted,
      } as Cooperative.Model.IQuestionExtended
    })

    return extendedQuestions
  }

  /**
   * Определяет как пользователь проголосовал по конкретному вопросу
   * @param question Вопрос голосования
   * @param username Имя пользователя
   * @returns 'for', 'against' или 'abstained'
   */
  getUserVote(question: MeetContract.Tables.Questions.IOutput, username: string): 'for' | 'against' | 'abstained' {
    console.log(question, username)
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
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const templateResponse = await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-tables`, new URLSearchParams({
      filter: JSON.stringify({
        'code': DraftContract.contractName.production,
        'scope': scope,
        'table': DraftContract.Tables.Drafts.tableName,
        'value.registry_id': String(registry_id),
        ...block_filter,
      }),
    }))

    const draft = templateResponse.results[0]?.value as DraftContract.Tables.Drafts.IDraft

    if (!draft)
      throw new Error('Шаблон не найден')

    const translationsResponse = await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-tables`, new URLSearchParams({
      filter: JSON.stringify({
        'code': DraftContract.contractName.production,
        'scope': scope,
        'table': 'translations',
        'value.draft_id': String(draft.registry_id),
        ...block_filter,
      }),
    }))

    const translations = translationsResponse.results

    if (!translations.length)
      throw new Error('Ни один перевод не найден')

    /**
     * Код ниже обеспечивает группировку языковых версий, если их было несколько, оставляя только актуальные.
     * В целом, этот код можно исключить, если в запрос языковых версий добавить опцию лимита == 1. Т.к. в некоторых случаях
     * мы можем получить несколько версий, что в дальнейшем при формировании объекта из массива приводит к неожиданным результатам, когда
     * последней версией документа может стать одна из старых.
     */
    const filteredTranslations: any = Object.values(
      translations.reduce((acc: any, curr: any) => {
        const lang = curr.value.lang

        // Если ключ (язык) уже существует в аккумуляторе, проверяем block_num
        if (!acc[lang] || acc[lang].block_num < curr.block_num) {
          acc[lang] = curr // Обновляем запись, если block_num больше
        }

        return acc
      }, {} as Record<string, typeof translations[0]>),
    )

    const translationsObj: any = Object.fromEntries(
      filteredTranslations.map(({ value }: { value: any }) => [value.lang, JSON.parse(value.data)]),
    )

    return {
      title: draft.title,
      description: draft.description,
      model: JSON.parse(draft.model) as JSONSchemaType<T>,
      context: draft.context,
      translations: translationsObj as ITranslations,
    }
  }

  async generatePDF(
    data: externalDataTypes | string,
    context: string,
    vars: ICombinedData,
    translation: ITranslations,
    meta: IMetaDocument,
    skip_save: boolean = false,
  ): Promise<IGeneratedDocument> {
    const pdfService = new PDFService()
    const document: IGeneratedDocument = await pdfService.generateDocument(context, vars, translation, meta)
    const full_name = this.getFullName(data)

    document.full_title = `${document.meta.title} - ${full_name} - ${document.meta.created_at}.pdf`

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
    // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-obscure-range
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
      ? moment.tz(created_at, 'DD.MM.YYYY HH:mm', timezone)
      : moment.tz(timezone)

    return {
      day: dateWithTimezone.format('DD'),
      month: dateWithTimezone.format('MM'),
      year: dateWithTimezone.format('YY'),
    }
  }

  constructUHDContract(created_at: string): Cooperative.Document.IUHDContract {
    const date = created_at
      ? moment(created_at, 'DD.MM.YYYY HH:mm')
      : moment()

    return {
      number: `УХД-${date.format('DD')}-${date.format('MM')}-${date.format('YY')}`,
      date: date.format('DD.MM.YYYY'),
    }
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
        }
      }

      case 'organization': {
        const data = input.data as ExternalOrganizationData
        return {
          abbr_full_name: this.extractOrganizationName(data),
          full_name_or_short_name: this.getFullParticipantName(data),
          birthdate_or_ogrn: data.details.ogrn,
        }
      }

      default:
        throw new Error(`cant extract common user data`)
    }
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
    timezone = 'Europe/Moscow', // TODO перенести в .env
    ...restParams
  }: T): Promise<IMetaDocument> {
    let dateWithTimezone

    if (!title)
      throw new Error('Заголовок документа должен быть установлен')

    if (!registry_id)
      throw new Error('Параметр номера документа в реестре должен быть передан')

    if (created_at)
      dateWithTimezone = moment.tz(created_at, 'DD.MM.YYYY HH:mm', timezone).format('DD.MM.YYYY HH:mm').toString()
    else
      dateWithTimezone = moment.tz(timezone).format('DD.MM.YYYY HH:mm').toString()

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
      created_at: dateWithTimezone,
      block_num,
      timezone,
      ...restParams,
    }
  }

  public formatAsset(asset: string, precision: number = 2): string {
    if (!asset)
      return ''
    const match = asset.match(/^(\d+\.\d+)\s+([A-Z]+)$/)
    if (!match)
      return asset
    const [, amount, symbol] = match
    return `${Number.parseFloat(amount).toFixed(precision)} ${symbol}`
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
