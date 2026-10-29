/**
 * Сборщик как объявление (шаг 3 фабрики v2, FR14–FR15).
 *
 * Сборщик документа — не наследник `DocFactory`, а объект: номер реестра,
 * версия, объявленные чтения, чистая функция сборки модели. Чтение
 * выполняет каркас: независимые источники — параллельно, зависимые от меты
 * (голоса по решению, вопросы собрания) — второй волной. Сборщик не знает ни
 * хранилища, ни цепи: ему приходят уже прочитанные данные.
 *
 * Порядок работы каркаса на одну сборку:
 *   1. параллельно: текст шаблона на блок и первая волна чтений `reads`;
 *   2. мета по заголовку шаблона и данным действия;
 *   3. вторая волна `derive` — чтения, которым нужна мета или первая волна;
 *   4. `assemble` — чистая модель документа;
 *   5. проверка схемой шаблона, рендер, сохранение (если не отключено).
 *
 * Чтения объявляются через фасад `f` (составные чтения: пайщик с видом,
 * собрание с именами, решение с голосами) либо через слой источников `s`
 * (сырые чтения). Оба только читают.
 *
 * `defineBuilder<Action, Model>()(spec)` отдаёт класс, совместимый с
 * таблицей `Generator` (`new Factory(storage)`): до шага 4 объявленные и
 * прежние сборщики живут рядом, и регистрация не меняется. Типы документа
 * задаются первым вызовом, типы чтений выводятся из объявления.
 */
import { DraftContract } from 'cooptypes'
import { DocFactory } from '../Factory'
import type { ICombinedData, IGeneratedDocument, IMetaDocument, IMetaDocumentPartial, ITemplate, externalDataTypes } from '../Interfaces'
import type { IGenerate, IGenerationOptions } from '../Interfaces/Documents'
import type { IFactoryStorage } from '../Storage'
import type { FactorySources } from '../Sources'
import type { BuilderVersion } from './version'

export * from './version'

/** Объявление чтений: ключ → отложенное чтение; каркас запускает их разом. */
export type Thunks<R> = { [K in keyof R]: () => Promise<R[K]> }

/**
 * Данные действия без индексной сигнатуры. `IGenerate` из cooptypes
 * допускает любое поле (`[key: string]: any`), и опечатка в имени поля
 * проходила проверку типов. Сборщик видит только объявленные поля действия.
 */
export type Known<T> = { [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K] }

/** Составные чтения фабрики, доступные сборщику. Только чтение. */
export type IReadFacade = Pick<
  DocFactory<IGenerate>,
  | 'getUser'
  | 'getCooperative'
  | 'getVars'
  | 'getOrganization'
  | 'getBankAccount'
  | 'getPaymentMethod'
  | 'getUdata'
  | 'getProject'
  | 'loadDocData'
  | 'getMeet'
  | 'getMeetQuestions'
  | 'getDecision'
  | 'getApprovedDecision'
  | 'getGeneralMeetingDecision'
>

/** Что видит сборщик до меты: данные действия, фасад чтений и слой источников. */
export interface IReadContext<A> {
  data: Known<A>
  f: IReadFacade
  s: FactorySources
  /** Параметры сборки: бланк без подписанта, показ без PDF, без сохранения. */
  options: IGenerationOptions
}

/** Что видит вторая волна: плюс мета, текст шаблона и первая волна. */
export interface IDeriveContext<A, M, R> extends IReadContext<A> {
  meta: IMetaDocument
  template: ITemplate<M>
  reads: R
}

/** Что видит сборка модели: всё прочитанное; записи и источников здесь нет. */
export interface IAssembleContext<A, M, R, D> {
  data: Known<A>
  meta: IMetaDocument
  template: ITemplate<M>
  reads: R
  derived: D
}

export interface IBuilderSpec<A extends IGenerate, M extends ICombinedData, R extends Record<string, unknown>, D extends Record<string, unknown>> {
  registry_id: number
  /**
   * Версия сборщика `major.minor` (шаг 7, `./version.ts`). Каркас пишет её в
   * `meta.builder` каждого нового документа; пересборка берёт версию из меты.
   */
  version: BuilderVersion
  /** Первая волна: независимые чтения, параллельно. */
  reads: (ctx: IReadContext<A>) => Thunks<R>
  /** Вторая волна: чтения, которым нужна мета или первая волна. Параллельно между собой. */
  derive?: (ctx: IDeriveContext<A, M, R>) => Thunks<D>
  /** Поля меты сверх данных действия; по умолчанию `{ title: template.title, ...data }`. Первая волна уже прочитана. */
  meta?: (ctx: { data: Known<A>, template: ITemplate<M>, reads: R }) => IMetaDocumentPartial
  /** Чистая сборка модели документа. */
  assemble: (ctx: IAssembleContext<A, M, R, D>) => M
  /** Подписант для названия файла PDF; по умолчанию пусто. */
  signer?: (ctx: IAssembleContext<A, M, R, D>) => externalDataTypes | string
}

async function resolveThunks<R extends Record<string, unknown>>(thunks: Thunks<R>): Promise<R> {
  const entries = Object.entries(thunks) as Array<[keyof R, () => Promise<unknown>]>
  const values = await Promise.all(entries.map(([, fn]) => fn()))
  const result = {} as R
  entries.forEach(([key], index) => {
    result[key] = values[index] as R[keyof R]
  })
  return result
}

/** Каркас, выполняющий объявление сборщика. */
export class DeclaredFactory<A extends IGenerate, M extends ICombinedData, R extends Record<string, unknown>, D extends Record<string, unknown>> extends DocFactory<A> {
  constructor(storage: IFactoryStorage, public readonly spec: IBuilderSpec<A, M, R, D>) {
    super(storage)
  }

  async generateDocument(data: A, options: IGenerationOptions = {}): Promise<IGeneratedDocument> {
    const { spec } = this
    const readCtx: IReadContext<A> = { data, f: this as unknown as IReadFacade, s: this.sources, options }

    // Текст шаблона читается всегда и вместе с первой волной.
    const [template, reads] = await Promise.all([
      this.getTemplate<M>(DraftContract.contractName.production, spec.registry_id, data.block_num),
      resolveThunks(spec.reads(readCtx)),
    ])

    // Версия сборщика в мете. Новая сборка (даты в данных нет) получает версию
    // этого сборщика. Пересборка несёт мету исходного документа: версия
    // берётся из неё как есть, а документ до оси версий остаётся без поля —
    // иначе мета и её хэш разошлись бы с подписанными.
    const isRebuild = Boolean((data as { created_at?: string }).created_at)
    const builder = isRebuild ? (data as { builder?: string }).builder : spec.version
    const baseMeta: IMetaDocumentPartial = spec.meta ? spec.meta({ data, template, reads }) : { title: template.title, ...data }
    const metaInput: IMetaDocumentPartial = builder ? { ...baseMeta, builder } : baseMeta
    const meta: IMetaDocument = await this.getMeta(metaInput)

    const derived = spec.derive
      ? await resolveThunks(spec.derive({ ...readCtx, meta, template, reads }))
      : ({} as D)

    const assembleCtx: IAssembleContext<A, M, R, D> = { data, meta, template, reads, derived }
    const model = spec.assemble(assembleCtx)

    await this.validate(model, template.model)

    const translation = template.translations[meta.lang]
    const signer = spec.signer ? spec.signer(assembleCtx) : ''

    // Запрет сохранения приходит двумя путями: параметрами сборки от
    // контроллера и полем `skip_save` в данных действия от рабочего стола
    // (вступление, отгрузка). Прежние сборщики читали один из них, каждый
    // свой; каркас уважает оба.
    const skipSave = options.skip_save ?? (data as { skip_save?: boolean }).skip_save

    return this.generatePDF(signer, template.context, model, translation, meta, skipSave, options.skip_pdf)
  }
}

/**
 * Класс сборщика из объявления: `new Factory(storage)`, как у прежних
 * сборщиков. Первый вызов задаёт типы действия и модели, второй принимает
 * объявление и выводит типы чтений из него.
 */
export function defineBuilder<A extends IGenerate, M extends ICombinedData>() {
  return <R extends Record<string, unknown>, D extends Record<string, unknown> = Record<string, never>>(spec: IBuilderSpec<A, M, R, D>) =>
    class extends DeclaredFactory<A, M, R, D> {
      constructor(storage: IFactoryStorage) {
        super(storage, spec)
      }
    }
}
