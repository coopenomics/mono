import type { RequestDomainEntity } from './request-domain.entity';
import { t } from '../../i18n';

/**
 * Типы изображений заявки
 */
export enum RequestImageType {
  REGULAR = 'regular',
  PRIMARY = 'primary',
  COLOR_SAMPLE = 'color_sample',
  IMAGE_360 = 'image_360',
}

/**
 * Доменная сущность изображения заявки для marketplace расширения
 * Представляет изображение, прикрепленное к заявке
 */
export class RequestImageDomainEntity {
  public readonly id?: number;
  public readonly requestId?: number;
  public readonly request?: RequestDomainEntity;
  public readonly imageUrl: string;
  public readonly imageType: RequestImageType;
  public readonly sortOrder: number;
  public readonly description?: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    id?: number;
    requestId?: number;
    request?: RequestDomainEntity;
    imageUrl: string;
    imageType: RequestImageType;
    sortOrder: number;
    description?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.requestId = data.requestId;
    this.request = data.request;
    this.imageUrl = data.imageUrl;
    this.imageType = data.imageType;
    this.sortOrder = data.sortOrder;
    this.description = data.description;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, является ли изображение главным
   */
  isPrimary(): boolean {
    return this.imageType === RequestImageType.PRIMARY;
  }

  /**
   * Проверяет, является ли изображение образцом цвета
   */
  isColorSample(): boolean {
    return this.imageType === RequestImageType.COLOR_SAMPLE;
  }

  /**
   * Проверяет, является ли изображение 360
   */
  is360Image(): boolean {
    return this.imageType === RequestImageType.IMAGE_360;
  }

  /**
   * Проверяет, является ли изображение обычным
   */
  isRegular(): boolean {
    return this.imageType === RequestImageType.REGULAR;
  }

  /**
   * Валидирует URL изображения
   */
  validateImageUrl(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.imageUrl || this.imageUrl.trim() === '') {
      errors.push(t('marketplace.requestImageDomain.urlRequired'));
      return { valid: false, errors };
    }

    // Проверка на корректный URL
    try {
      const url = new URL(this.imageUrl);

      // Проверка протокола (должен быть http или https)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push(t('marketplace.requestImageDomain.urlProtocolInvalid'));
      }

      // Проверка расширения файла
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const hasValidExtension = validExtensions.some((ext) => url.pathname.toLowerCase().endsWith(ext));

      if (!hasValidExtension) {
        errors.push(t('marketplace.requestImageDomain.extensionInvalid') + validExtensions.join(', '));
      }
    } catch {
      errors.push(t('marketplace.requestImageDomain.urlInvalid'));
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Получает имя файла из URL
   */
  getFileName(): string {
    try {
      const url = new URL(this.imageUrl);
      return url.pathname.split('/').pop() || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Получает расширение файла
   */
  getFileExtension(): string {
    const fileName = this.getFileName();
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.slice(lastDotIndex) : '';
  }

  /**
   * Проверяет, является ли изображение поддерживаемым форматом
   */
  isSupportedFormat(): boolean {
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const extension = this.getFileExtension().toLowerCase();
    return supportedFormats.includes(extension);
  }

  /**
   * Создает объект для API в формате images массива
   */
  toApiImageUrl(): string {
    return this.imageUrl;
  }

  /**
   * Сравнивает изображения по порядку сортировки
   */
  static compareByOrder(a: RequestImageDomainEntity, b: RequestImageDomainEntity): number {
    return a.sortOrder - b.sortOrder;
  }

  /**
   * Получает описание типа изображения на русском языке
   */
  getTypeDescription(): string {
    switch (this.imageType) {
      case RequestImageType.PRIMARY:
        return t('marketplace.requestImageDomain.typeMain');
      case RequestImageType.COLOR_SAMPLE:
        return t('marketplace.requestImageDomain.typeColorSample');
      case RequestImageType.IMAGE_360:
        return t('marketplace.requestImageDomain.type360');
      case RequestImageType.REGULAR:
        return t('marketplace.requestImageDomain.typeRegular');
      default:
        return t('marketplace.requestImageDomain.typeUnknown');
    }
  }
}
