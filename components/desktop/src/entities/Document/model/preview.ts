import type { IDocumentAggregate } from './types';

/**
 * Сгенерированный, ещё не подписанный документ — в агрегат для показа в
 * `BaseDocument` перед подписью. Подписей и хэша у такого документа нет,
 * `BaseDocument` рисует его текст из `rawDocument`.
 */
export function previewAggregate(generated: object): IDocumentAggregate {
  return { rawDocument: generated, document: { doc_hash: '', signatures: [] } } as unknown as IDocumentAggregate;
}
