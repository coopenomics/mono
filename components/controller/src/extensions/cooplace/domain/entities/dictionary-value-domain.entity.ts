import type { DictionaryDomainEntity } from './dictionary-domain.entity';

/**
 * Доменная сущность значения справочника для marketplace расширения
 * Представляет конкретное значение из справочника из Ozon API
 */
export class DictionaryValueDomainEntity {
  public readonly dictionaryValueId: number;
  public readonly value: string;
  public readonly info?: string;
  public readonly picture?: string;
  public readonly dictionaryId: number;
  public readonly dictionary: DictionaryDomainEntity;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    dictionaryValueId: number;
    value: string;
    info?: string;
    picture?: string;
    dictionaryId: number;
    dictionary: DictionaryDomainEntity;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.dictionaryValueId = data.dictionaryValueId;
    this.value = data.value;
    this.info = data.info;
    this.picture = data.picture;
    this.dictionaryId = data.dictionaryId;
    this.dictionary = data.dictionary;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, есть ли у значения изображение
   */
  hasPicture(): boolean {
    return this.picture !== undefined && this.picture.trim() !== '';
  }

  /**
   * Проверяет, есть ли у значения дополнительная информация
   */
  hasInfo(): boolean {
    return this.info !== undefined && this.info.trim() !== '';
  }

  /**
   * Получает полное описание значения
   */
  getFullDescription(): string {
    if (this.hasInfo()) {
      return `${this.value} - ${this.info}`;
    }
    return this.value;
  }

  /**
   * Проверяет соответствие поисковому запросу
   */
  matchesSearch(searchText: string): boolean {
    const lowerSearch = searchText.toLowerCase();
    const lowerValue = this.value.toLowerCase();
    const lowerInfo = this.info?.toLowerCase() || '';

    return lowerValue.includes(lowerSearch) || lowerInfo.includes(lowerSearch);
  }
}
