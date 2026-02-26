import type { AttributeDomainEntity } from './attribute-domain.entity';
import type { RequestDomainEntity } from './request-domain.entity';

/**
 * Доменная сущность значения атрибута заявки для marketplace расширения
 * Представляет значение конкретного атрибута для заявки
 */
export class RequestAttributeValueDomainEntity {
  public readonly id?: number;
  public readonly requestId?: number;
  public readonly request?: RequestDomainEntity;
  public readonly attributeId: number;
  public readonly attribute: AttributeDomainEntity;
  public readonly complexId: number;
  public readonly value: string;
  public readonly dictionaryValueId?: number;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    id?: number;
    requestId?: number;
    request?: RequestDomainEntity;
    attributeId: number;
    attribute: AttributeDomainEntity;
    complexId?: number;
    value: string;
    dictionaryValueId?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.requestId = data.requestId;
    this.request = data.request;
    this.attributeId = data.attributeId;
    this.attribute = data.attribute;
    this.complexId = data.complexId || 0;
    this.value = data.value;
    this.dictionaryValueId = data.dictionaryValueId;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, является ли значение из словаря
   */
  isDictionaryValue(): boolean {
    return this.dictionaryValueId !== undefined && this.dictionaryValueId !== null;
  }

  /**
   * Проверяет, является ли атрибут обязательным
   */
  isRequired(): boolean {
    return this.attribute.isRequired;
  }

  /**
   * Проверяет, является ли атрибут аспектным
   */
  isAspect(): boolean {
    return this.attribute.isAspect;
  }

  /**
   * Проверяет, может ли атрибут содержать несколько значений
   */
  isCollection(): boolean {
    return this.attribute.isCollection;
  }

  /**
   * Получает тип атрибута
   */
  getAttributeType(): string {
    return this.attribute.type;
  }

  /**
   * Получает группу атрибута
   */
  getAttributeGroup(): string | undefined {
    return this.attribute.groupName;
  }

  /**
   * Валидирует значение атрибута
   */
  validateValue(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Проверка на пустое значение для обязательного атрибута
    if (this.attribute.isRequired && (!this.value || this.value.trim() === '')) {
      errors.push(`Атрибут "${this.attribute.name}" обязателен для заполнения`);
    }

    // Валидация по типу атрибута
    switch (this.attribute.type.toLowerCase()) {
      case 'number':
      case 'integer':
        if (this.value && isNaN(Number(this.value))) {
          errors.push(`Атрибут "${this.attribute.name}" должен содержать число`);
        }
        break;

      case 'boolean':
        if (this.value && !['true', 'false', '1', '0'].includes(this.value.toLowerCase())) {
          errors.push(`Атрибут "${this.attribute.name}" должен содержать булево значение`);
        }
        break;

      case 'url':
        if (this.value && !this.isValidUrl(this.value)) {
          errors.push(`Атрибут "${this.attribute.name}" должен содержать корректный URL`);
        }
        break;

      case 'date':
        if (this.value && isNaN(Date.parse(this.value))) {
          errors.push(`Атрибут "${this.attribute.name}" должен содержать корректную дату`);
        }
        break;
    }

    // Проверка максимального количества значений
    if (this.attribute.maxValueCount > 0) {
      const valuesCount = this.attribute.isCollection ? this.value.split(',').length : 1;
      if (valuesCount > this.attribute.maxValueCount) {
        errors.push(`Атрибут "${this.attribute.name}" может содержать максимум ${this.attribute.maxValueCount} значений`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Проверяет, является ли строка корректным URL
   */
  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получает значения как массив (для коллекций)
   */
  getValuesAsArray(): string[] {
    if (!this.attribute.isCollection) {
      return [this.value];
    }
    return this.value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
}
