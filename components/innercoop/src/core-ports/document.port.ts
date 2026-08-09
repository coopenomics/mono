import type { ISignedDocument } from './signed-document.port';

/**
 * Реестр документов кооператива: сгенерировать документ по шаблону, найти его
 * по хэшу, собрать агрегат вокруг подписанного документа, сохранить приватную
 * часть.
 *
 * Расширения ходили за этим прямо в `DocumentInteractor`, `DocumentDomainService`
 * и `DocumentAggregationService` ядра — 41 вызов. Порт закрывает ровно те четыре
 * операции, которые они зовут; всё остальное поведение этих сервисов остаётся
 * внутренним делом ядра.
 */

/**
 * Данные документа. Обязательны только реестровый номер шаблона и то, для кого
 * документ; остальные поля зависят от шаблона, поэтому форма открытая — ровно
 * как в цепи.
 */
export interface InnerGenerateDocumentData {
  /** Номер шаблона в реестре документов платформы. */
  registry_id: number;
  coopname: string;
  username: string;
  /**
   * Приватная часть документа. Хранится вне цепи, наружу публикуется только её
   * хэш — см. `doc_data_hash`.
   */
  doc_data?: Record<string, unknown>;
  doc_data_hash?: string;
  [key: string]: any;
}

/**
 * Запрос на генерацию — конверт из данных и опций.
 *
 * Конверт, а не два аргумента: именно так операция вызывалась в ядре и так её
 * зовут все 36 мест в расширениях. Контракт подстроен под сложившийся вызов
 * сознательно — переписывать тела вызовов ради формы аргументов значило бы
 * рисковать без выигрыша.
 */
export interface InnerGenerateDocumentRequest {
  data: InnerGenerateDocumentData;
  options?: InnerGenerateDocumentOptions;
}

export interface InnerGenerateDocumentOptions {
  /** Не сохранять сгенерированный документ — нужен только предпросмотр. */
  skip_save?: boolean;
  lang?: string;
}

/** Готовый документ: человекочитаемый вид, хэш для подписи и PDF в base64. */
export interface InnerGeneratedDocument {
  full_title: string;
  html: string;
  hash: string;
  meta: Record<string, any>;
  /** PDF, закодированный base64. */
  binary: string;
}

/**
 * Подписанный документ вместе с его исходником, если тот сохранён.
 * `rawDocument` пуст, когда документ подписан, но в реестре его уже нет.
 */
export interface InnerDocumentAggregate {
  hash: string;
  document: ISignedDocument & Record<string, any>;
  rawDocument?: InnerGeneratedDocument;
}

export interface IDocumentPort {
  /** Сгенерировать документ по шаблону реестра. */
  generate(request: InnerGenerateDocumentRequest): Promise<InnerGeneratedDocument>;

  /** Найти ранее сгенерированный документ. `null` — документа нет в реестре. */
  getByHash(hash: string): Promise<InnerGeneratedDocument | null>;

  /** Собрать агрегат вокруг подписанного документа. `null` — исходник не найден. */
  buildAggregate(signedDocument: ISignedDocument): Promise<InnerDocumentAggregate | null>;

  /**
   * Сохранить приватную часть документа вне цепи и получить её хэш.
   * В цепь уходит только хэш.
   */
  saveData(payload: Record<string, unknown>, registryId: number): Promise<{ hash: string }>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────
/**
 * Реестр документов кооператива. Провайдер — ядро.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const DOCUMENT_PORT = Symbol.for('Innercoop.CorePort.Document');
