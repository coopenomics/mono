import type { AttributeDomainEntity } from './attribute-domain.entity';
import type { DictionaryValueDomainEntity } from './dictionary-value-domain.entity';

/**
 * Доменная сущность справочника значений для marketplace расширения
 * Представляет справочник предопределенных значений для характеристик товаров из Ozon API
 */
export class DictionaryDomainEntity {
  public readonly dictionaryId: number;
  public readonly name?: string;
  public readonly description?: string;
  public readonly attributes: AttributeDomainEntity[];
  public readonly values: DictionaryValueDomainEntity[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    dictionaryId: number;
    name?: string;
    description?: string;
    attributes?: AttributeDomainEntity[];
    values?: DictionaryValueDomainEntity[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.dictionaryId = data.dictionaryId;
    this.name = data.name;
    this.description = data.description;
    this.attributes = data.attributes || [];
    this.values = data.values || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Получает количество значений в словаре
   */
  getValuesCount(): number {
    return this.values.length;
  }

  /**
   * Получает значения по части текста
   */
  findValuesByText(searchText: string): DictionaryValueDomainEntity[] {
    const lowerSearch = searchText.toLowerCase();
    return this.values.filter(
      (value) =>
        value.value.toLowerCase().includes(lowerSearch) || (value.info && value.info.toLowerCase().includes(lowerSearch))
    );
  }

  /**
   * Получает значение по ID
   */
  getValueById(valueId: number): DictionaryValueDomainEntity | undefined {
    return this.values.find((value) => value.dictionaryValueId === valueId);
  }

  /**
   * Проверяет, есть ли значения с изображениями
   */
  hasValuesWithPictures(): boolean {
    return this.values.some((value) => value.picture !== undefined && value.picture.trim() !== '');
  }

  /**
   * Получает все атрибуты, использующие этот словарь
   */
  getRelatedAttributes(): AttributeDomainEntity[] {
    return this.attributes;
  }
}
