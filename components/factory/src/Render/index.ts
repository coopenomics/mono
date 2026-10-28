/**
 * Рендер документа: HTML из шаблона и переменных, затем PDF (шаг 2 фабрики v2).
 *
 * Здесь нет чтения данных и нет сохранения: вход — текст шаблона, модель,
 * перевод и мета, выход — собранный документ. Сохранение остаётся за
 * вызывающим (`DocFactory.generatePDF`), чтобы рендер был пригоден и для
 * показа без сохранения, и для пересборки при аудите.
 */
import type { ICombinedData, IGeneratedDocument, IMetaDocument, ITranslations } from '../Interfaces'
import { PDFService } from '../Services/Generator'
import { BLANK_PLACEHOLDER } from '../Services/Templator'
import { formatCreatedAt } from '../Utils/documentCreatedAt'

export interface IRenderInput {
  /** Текст шаблона Nunjucks. */
  context: string
  /** Модель документа. */
  vars: ICombinedData
  translation: ITranslations
  meta: IMetaDocument
  /** Имя подписанта для названия файла PDF. */
  signerName: string
  /** Только HTML для показа: без PDF, без хэша, такой документ не сохраняется. */
  skip_pdf?: boolean
}

/** Переменные шаблона с датой в виде для человека. */
export function renderVarsOf(context: string, vars: ICombinedData, meta: IMetaDocument): { renderVars: ICombinedData, displayCreatedAt: string } {
  // Шаблон показывает дату человеку переменной `created_at`, а мета хранит
  // момент генерации в ISO: вид для человека собирается только здесь.
  const displayCreatedAt = formatCreatedAt(meta.created_at, meta.timezone)
  const renderVars: ICombinedData = { ...vars, created_at: displayCreatedAt }
  // Редакция, утверждённая советом до 28.09.2026, собирается текстом того
  // времени и выводит дату как `meta.created_at`. Только ей мета для показа
  // даётся с датой в виде для человека; сохраняется и подписывается мета с ISO.
  if (context.includes('meta.created_at'))
    renderVars.meta = { ...meta, created_at: displayCreatedAt }
  return { renderVars, displayCreatedAt }
}

export async function renderDocument(input: IRenderInput, pdfService: PDFService = new PDFService()): Promise<IGeneratedDocument> {
  const { context, vars, translation, meta, signerName, skip_pdf } = input
  const { renderVars, displayCreatedAt } = renderVarsOf(context, vars, meta)

  if (skip_pdf) {
    const html = pdfService.renderHtml(context, renderVars, translation)
    return { full_title: '', html, hash: '', binary: new Uint8Array(), meta }
  }

  const document = await pdfService.generateDocument(context, renderVars, translation, meta)
  document.full_title = `${document.meta.title} - ${signerName} - ${displayCreatedAt}.pdf`
  return document
}

export interface IBlankRenderInput {
  context: string
  /** Реквизиты кооператива, параметры программы и прочее, что известно совету. */
  vars: Record<string, unknown>
  translation: ITranslations
  meta: IMetaDocument
  /** Ключи схемы модели: незнакомые шаблону поля — прочерком. */
  knownKeys: string[]
}

/** Бланк: известное советом подставлено, остальное и дата — прочерком. */
export function renderBlank(input: IBlankRenderInput, pdfService: PDFService = new PDFService()): string {
  const blankMeta: IMetaDocument = { ...input.meta, created_at: BLANK_PLACEHOLDER }
  return pdfService.renderBlankHtml(
    input.context,
    { ...input.vars, meta: blankMeta, created_at: BLANK_PLACEHOLDER },
    input.translation,
    input.knownKeys,
  )
}
