import type { DictionaryDomainEntity } from '../entities/dictionary-domain.entity';

/**
 * Интерфейс доменного репозитория для словарей marketplace
 */
export interface DictionaryDomainRepository {
  /**
   * Получить все словари
   */
  findAll(): Promise<DictionaryDomainEntity[]>;

  /**
   * Найти словарь по ID
   */
  findById(id: number): Promise<DictionaryDomainEntity | null>;

  /**
   * Найти словари со значениями
   */
  findWithValues(): Promise<DictionaryDomainEntity[]>;

  /**
   * Найти словари по названию
   */
  findByName(name: string): Promise<DictionaryDomainEntity[]>;

  /**
   * Сохранить словарь
   */
  save(dictionary: DictionaryDomainEntity): Promise<DictionaryDomainEntity>;

  /**
   * Сохранить несколько словарей
   */
  saveMany(dictionaries: DictionaryDomainEntity[]): Promise<DictionaryDomainEntity[]>;

  /**
   * Обновить или создать словарь
   */
  upsert(dictionaryData: Partial<DictionaryDomainEntity>): Promise<DictionaryDomainEntity>;

  /**
   * Подсчитать количество словарей
   */
  count(): Promise<number>;

  /**
   * Найти словари с количеством значений больше указанного
   */
  findWithMinValuesCount(minCount: number): Promise<DictionaryDomainEntity[]>;

  /**
   * Найти словари по списку ID
   */
  findByIds(ids: number[]): Promise<DictionaryDomainEntity[]>;
}

// Токен для внедрения зависимости
export const DICTIONARY_DOMAIN_REPOSITORY = Symbol('DictionaryDomainRepository');
