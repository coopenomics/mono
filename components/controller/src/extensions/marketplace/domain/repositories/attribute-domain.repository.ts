import type { AttributeDomainEntity } from '../entities/attribute-domain.entity';

/**
 * Интерфейс доменного репозитория для атрибутов marketplace
 */
export interface AttributeDomainRepository {
  /**
   * Получить все атрибуты
   */
  findAll(): Promise<AttributeDomainEntity[]>;

  /**
   * Найти атрибут по ID
   */
  findById(id: number): Promise<AttributeDomainEntity | null>;

  /**
   * Найти атрибуты по ID словаря
   */
  findByDictionaryId(dictionaryId: number): Promise<AttributeDomainEntity[]>;

  /**
   * Найти атрибуты со словарями
   */
  findWithDictionary(): Promise<AttributeDomainEntity[]>;

  /**
   * Найти атрибуты по типу
   */
  findByType(type: string): Promise<AttributeDomainEntity[]>;

  /**
   * Найти обязательные атрибуты
   */
  findRequired(): Promise<AttributeDomainEntity[]>;

  /**
   * Найти аспектные атрибуты
   */
  findAspect(): Promise<AttributeDomainEntity[]>;

  /**
   * Найти атрибуты по группе
   */
  findByGroup(groupId: number): Promise<AttributeDomainEntity[]>;

  /**
   * Найти атрибуты для конкретной категории и типа
   */
  findByCategoryAndType(categoryId: number, typeId: number): Promise<AttributeDomainEntity[]>;

  /**
   * Сохранить атрибут
   */
  save(attribute: AttributeDomainEntity): Promise<AttributeDomainEntity>;

  /**
   * Сохранить несколько атрибутов
   */
  saveMany(attributes: AttributeDomainEntity[]): Promise<AttributeDomainEntity[]>;

  /**
   * Обновить или создать атрибут
   */
  upsert(attributeData: Partial<AttributeDomainEntity>): Promise<AttributeDomainEntity>;

  /**
   * Подсчитать количество атрибутов
   */
  count(): Promise<number>;

  /**
   * Найти атрибуты с зависимостью от категории
   */
  findCategoryDependent(): Promise<AttributeDomainEntity[]>;
}

// Токен для внедрения зависимости
export const ATTRIBUTE_DOMAIN_REPOSITORY = Symbol('AttributeDomainRepository');
