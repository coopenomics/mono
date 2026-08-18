/**
 * Свободные решения совета: расширение заводит проект решения, получает его
 * документ и публикует в цепь.
 *
 * Порт существовал в ядре как `FreeDecisionPort` и уже инжектился расширениями
 * по токену — переехал потому, что жил по пути `~/domain/**`, которого за
 * пределами монолита нет, и был типизирован на `cooptypes`, которого в
 * контрактном пакете быть не должно (INV-014). Формы совпадают поле в поле,
 * связь структурная.
 *
 * Объявлены три операции, которыми пользуются вызывающие. Реализация в ядре
 * умеет больше — лишние методы структурной совместимости не мешают.
 */
import type { IMetaDocument } from './meta-document.contract';
import type { ISignedDocument } from './signed-document.port';

/** Проект решения: о чём спрашиваем совет и что предлагаем постановить. */
export interface InnerFreeDecisionProject {
  id: string;
  title?: string;
  question: string;
  decision: string;
}

/**
 * Данные для формирования документа проекта решения.
 *
 * Открытая форма: реестр документов принимает произвольные поля сверх
 * обязательных, и каждый вид решения кладёт туда своё.
 */
export interface InnerGenerateProjectFreeDecisionData {
  project_id: string;
  coopname: string;
  username: string;
  registry_id: number;
  title?: string;
  [key: string]: any;
}

export interface InnerPublishProjectFreeDecisionInput {
  coopname: string;
  username: string;
  /** Произвольные метаданные публикации в виде строки JSON. */
  meta: string;
  document: ISignedDocument;
}

/**
 * Сформированный документ решения.
 *
 * `meta` — те же метаданные документа, что и у подписанного: вызывающий
 * переносит их в подпись как есть, поэтому форма обязана совпадать.
 */
export interface InnerFreeDecisionDocument {
  hash: string;
  meta: IMetaDocument & { [key: string]: any };
  [key: string]: any;
}

export interface IFreeDecisionPort {
  createProjectOfFreeDecision(data: InnerFreeDecisionProject): Promise<unknown>;

  generateProjectOfFreeDecisionDocument(
    data: InnerGenerateProjectFreeDecisionData,
    options?: Record<string, any>
  ): Promise<InnerFreeDecisionDocument>;

  publishProjectOfFreeDecision(data: InnerPublishProjectFreeDecisionInput): Promise<boolean>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────
/**
 * Свободные решения совета. Провайдер — ядро.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const FREE_DECISION_PORT = Symbol.for('Innercoop.CorePort.FreeDecision');
