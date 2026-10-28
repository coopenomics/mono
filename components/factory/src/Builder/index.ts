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
import type { MongoDBConnector } from '../Services/Databazor'
import type { FactorySources } from '../Sources'

/** Объявление чтений: ключ → отложенное чтение; каркас запускает их разом. */
export type Thunks<R> = { [K in keyof R]: () => Promise<R[K]> }

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
  data: A
  f: IReadFacade
  s: FactorySources
}

/** Что видит вторая волна: плюс мета, текст шаблона и первая волна. */
export interface IDeriveContext<A, M, R> extends IReadContext<A> {
  meta: IMetaDocument
  template: ITemplate<M>
  reads: R
  options: IGenerationOptions
}

/** Что видит сборка модели: всё прочитанное; записи и источников здесь нет. */
export interface IAssembleContext<A, M, R, D> {
  data: A
  meta: IMetaDocument
  template: ITemplate<M>
  reads: R
  derived: D
}

export interface IBuilderSpec<A extends IGenerate, M extends ICombinedData, R extends Record<string, unknown>, D extends Record<string, unknown>> {
  registry_id: number
  /** Версия сборщика; ось версий (шаг 7) запишет её в `meta.builder`. */
  version: number
  /** Первая волна: независимые чтения, параллельно. */
  reads: (ctx: IReadContext<A>) => Thunks<R>
  /** Вторая волна: чтения, которым нужна мета или первая волна. Параллельно между собой. */
  derive?: (ctx: IDeriveContext<A, M, R>) => Thunks<D>
  /** Поля меты сверх данных действия; по умолчанию `{ title: template.title, ...data }`. */
  meta?: (ctx: { data: A, template: ITemplate<M> }) => IMetaDocumentPartial
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
  constructor(storage: MongoDBConnector, public readonly spec: IBuilderSpec<A, M, R, D>) {
    super(storage)
  }

  async generateDocument(data: A, options: IGenerationOptions = {}): Promise<IGeneratedDocument> {
    const { spec } = this
    const readCtx: IReadContext<A> = { data, f: this as unknown as IReadFacade, s: this.sources }

    // Текст шаблона читается всегда и вместе с первой волной.
    const [template, reads] = await Promise.all([
      this.getTemplate<M>(DraftContract.contractName.production, spec.registry_id, data.block_num),
      resolveThunks(spec.reads(readCtx)),
    ])

    const metaInput: IMetaDocumentPartial = spec.meta ? spec.meta({ data, template }) : { title: template.title, ...data }
    const meta: IMetaDocument = await this.getMeta(metaInput)

    const derived = spec.derive
      ? await resolveThunks(spec.derive({ ...readCtx, meta, template, reads, options }))
      : ({} as D)

    const assembleCtx: IAssembleContext<A, M, R, D> = { data, meta, template, reads, derived }
    const model = spec.assemble(assembleCtx)

    await this.validate(model, template.model)

    const translation = template.translations[meta.lang]
    const signer = spec.signer ? spec.signer(assembleCtx) : ''

    return this.generatePDF(signer, template.context, model, translation, meta, options.skip_save, options.skip_pdf)
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
      constructor(storage: MongoDBConnector) {
        super(storage, spec)
      }
    }
}
