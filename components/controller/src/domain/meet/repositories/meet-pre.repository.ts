import type { MeetPreProcessingDomainEntity } from '../entities/meet-pre-domain.entity';

export interface MeetPreProcessingRepository {
  /**
   * Получить данные о проекте собрания по хешу
   * @param hash Хеш собрания
   */
  findByHash(hash: string): Promise<MeetPreProcessingDomainEntity | null>;

  /**
   * Создать новое собрание
   * @param data Данные нового собрания
   */
  create(data: MeetPreProcessingDomainEntity): Promise<void>;

  /**
   * Удалить данные собрания, которое цепь не приняла
   * @param hash Хеш собрания
   */
  deleteByHash(hash: string): Promise<void>;
  /**
   * Отметить, что собрание созвано повторно под новым хэшем: черновик прежнего
   * созыва помнит новый хэш, и ссылка по прежнему ведёт к действующему собранию.
   */
  markReplaced(hash: string, replacedBy: string): Promise<void>;
  /**
   * Новый хэш собрания после повторного созыва; `null` — повторного созыва не было.
   * @param hash Хеш прежнего созыва
   */
  findReplacement(hash: string): Promise<string | null>;
}

export const MEET_PRE_PROCESSING_REPOSITORY = Symbol('MeetPreProcessingRepository');

// Для обратной совместимости
export type MeetRepository = MeetPreProcessingRepository;
export const MEET_REPOSITORY = MEET_PRE_PROCESSING_REPOSITORY;
