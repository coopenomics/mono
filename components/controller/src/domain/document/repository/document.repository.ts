import type { DocumentDomainEntity } from '../entity/document-domain.entity';

export interface DocumentRepository {
  /**
   * Найти сгенерированный документ (черновик) по хэшу тела (doc_hash).
   * @param hash Хэш тела документа (doc_hash).
   * @param block_num Точная версия черновика. Черновики версионируются по
   *   (hash + meta.block_num): одно тело может иметь несколько версий с
   *   разным block_num. Второму подписанту нужна ровно та версия, которую
   *   подписал первый. Не передан — вернётся любая версия (легаси/превью).
   */
  findByHash(hash: string, block_num?: number): Promise<DocumentDomainEntity | null>;
}

export const DOCUMENT_REPOSITORY = Symbol('DocumentRepository'); // Создаем уникальный токен
