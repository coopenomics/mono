import type { DictionaryValueDomainEntity } from '../entities/dictionary-value-domain.entity';

/**
 * Интерфейс доменного репозитория для значений словарей marketplace
 */
export interface DictionaryValueDomainRepository {
  /**
   * Получить все значения
   */
  findAll(): Promise<DictionaryValueDomainEntity[]>;

  /**
   * Найти значение по ID
   */
  findById(id: number): Promise<DictionaryValueDomainEntity | null>;

  /**
   * Найти значения по ID словаря
   */
  findByDictionaryId(dictionaryId: number): Promise<DictionaryValueDomainEntity[]>;

  /**
   * Найти значения по тексту (поиск)
   */
  findByValue(value: string): Promise<DictionaryValueDomainEntity[]>;

  /**
   * Найти значения с изображениями
   */
  findWithPictures(): Promise<DictionaryValueDomainEntity[]>;

  /**
   * Поиск значений по части текста
   */
  searchByText(searchText: string, dictionaryId?: number): Promise<DictionaryValueDomainEntity[]>;

  /**
   * Сохранить значение
   */
  save(value: DictionaryValueDomainEntity): Promise<DictionaryValueDomainEntity>;

  /**
   * Сохранить несколько значений
   */
  saveMany(values: DictionaryValueDomainEntity[]): Promise<DictionaryValueDomainEntity[]>;

  /**
   * Обновить или создать значение
   */
  upsert(valueData: Partial<DictionaryValueDomainEntity>): Promise<DictionaryValueDomainEntity>;

  /**
   * Подсчитать количество значений
   */
  count(): Promise<number>;

  /**
   * Подсчитать количество значений для словаря
   */
  countByDictionaryId(dictionaryId: number): Promise<number>;

  /**
   * Найти значения с пагинацией
   */
  findByDictionaryIdWithPagination(
    dictionaryId: number,
    offset: number,
    limit: number
  ): Promise<{
    items: DictionaryValueDomainEntity[];
    total: number;
  }>;
}

// Токен для внедрения зависимости
export const DICTIONARY_VALUE_DOMAIN_REPOSITORY = Symbol('DictionaryValueDomainRepository');
