/**
 * Сборка метаданных документа (шаг 2 фабрики v2).
 *
 * Мета — то, что подписывается вместе с документом и по чему он
 * пересобирается. Всё изменчивое (текущее время, высота цепи, версия
 * генератора) приходит зависимостями: функция не читает часы и сеть сама,
 * поэтому пересборка по готовой мете детерминирована, а набор тестов
 * подставляет постоянные значения.
 */
import type { IMetaDocument, IMetaDocumentPartial } from '../Interfaces'
import { DEFAULT_DOCUMENT_TIMEZONE, parseCreatedAt } from '../Utils/documentCreatedAt'

export interface IMetaDeps {
  /** Версия генератора по умолчанию — версия пакета. */
  version: string
  /** Момент создания новой сборки в ISO. */
  now: () => string
  /** Высота цепи для новой сборки; при пересборке блок приходит метой. */
  currentBlock: () => Promise<number>
}

export async function buildMeta<T extends IMetaDocumentPartial>(input: T, deps: IMetaDeps): Promise<IMetaDocument> {
  const {
    title,
    username,
    coopname,
    registry_id,
    links = [],
    lang = 'ru',
    generator = 'coopjs',
    version = deps.version,
    created_at,
    block_num,
    timezone = DEFAULT_DOCUMENT_TIMEZONE,
    ...restParams
  } = input

  if (!title)
    throw new Error('Заголовок документа должен быть установлен')

  if (!registry_id)
    throw new Error('Параметр номера документа в реестре должен быть передан')

  // Дата приходит снаружи только при перегенерации документа — она берётся
  // как есть, чтобы мета и хэш совпали с исходными; непонятную дату разбор
  // отвергает. Новая генерация пишет момент в ISO до миллисекунд.
  if (created_at)
    parseCreatedAt(created_at, timezone)
  const createdAt = created_at || deps.now()

  const blockNum = block_num || await deps.currentBlock()

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
    block_num: blockNum,
    timezone,
    ...restParams,
  }
}
