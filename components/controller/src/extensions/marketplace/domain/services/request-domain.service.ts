import { Inject, Injectable } from '@nestjs/common';
import { RequestDomainEntity, RequestType, RequestStatus } from '../entities/request-domain.entity';
import { RequestAttributeValueDomainEntity } from '../entities/request-attribute-value-domain.entity';
import { RequestImageDomainEntity, RequestImageType } from '../entities/request-image-domain.entity';
import { RequestDomainRepository, REQUEST_DOMAIN_REPOSITORY } from '../repositories/request-domain.repository';
import { CategoryDomainRepository, CATEGORY_DOMAIN_REPOSITORY } from '../repositories/category-domain.repository';
import { TypeDomainRepository, TYPE_DOMAIN_REPOSITORY } from '../repositories/type-domain.repository';
import { AttributeDomainRepository, ATTRIBUTE_DOMAIN_REPOSITORY } from '../repositories/attribute-domain.repository';
import { AvailableCategoryDomainService, AVAILABLE_CATEGORY_DOMAIN_SERVICE } from './available-category-domain.service';
import { randomBytes } from 'crypto';
import { config } from '~/config';

/**
 * Токен для внедрения зависимостей
 */
export const REQUEST_DOMAIN_SERVICE = Symbol('REQUEST_DOMAIN_SERVICE');

/**
 * Доменный сервис для работы с заявками marketplace
 * Содержит бизнес-логику для создания, валидации и управления заявками
 */
@Injectable()
export class RequestDomainService {
  constructor(
    @Inject(REQUEST_DOMAIN_REPOSITORY)
    private readonly requestRepository: RequestDomainRepository,
    @Inject(CATEGORY_DOMAIN_REPOSITORY)
    private readonly categoryRepository: CategoryDomainRepository,
    @Inject(TYPE_DOMAIN_REPOSITORY)
    private readonly typeRepository: TypeDomainRepository,
    @Inject(ATTRIBUTE_DOMAIN_REPOSITORY)
    private readonly attributeRepository: AttributeDomainRepository,
    @Inject(AVAILABLE_CATEGORY_DOMAIN_SERVICE)
    private readonly availableCategoryService: AvailableCategoryDomainService
  ) {}

  /**
   * Создать новую заявку
   */
  async createRequest(params: {
    coopname: string;
    username: string;
    type: RequestType;
    name: string;
    articleNumber: string;
    descriptionCategoryId: number;
    typeId: number;
    price: number;
    currencyCode: string;
    vat: string;
    units: number;
    barcode?: string;
    oldPrice?: number;
    width?: number;
    height?: number;
    depth?: number;
    dimensionUnit?: string;
    weight?: number;
    weightUnit?: string;
    productLifecycleSecs?: number;
    warrantyDays?: number;
    data?: string;
    meta?: string;
    attributes?: Array<{
      attributeId: number;
      value: string;
      complexId?: number;
      dictionaryValueId?: number;
    }>;
    images?: Array<{
      imageUrl: string;
      imageType: RequestImageType;
      sortOrder: number;
      description?: string;
    }>;
    primaryImageUrl?: string;
    colorImageUrl?: string;
    geoNames?: string[];
    parentHash?: string;
  }): Promise<RequestDomainEntity> {
    // Валидация базовых параметров
    await this.validateBasicParams(params);

    // Проверка доступности категории и типа для кооператива
    await this.validateCategoryTypeAvailability(params.coopname, params.descriptionCategoryId, params.typeId);

    // Получение категории и типа
    const category = await this.categoryRepository.findById(params.descriptionCategoryId);
    if (!category) {
      throw new Error(`Категория с ID ${params.descriptionCategoryId} не найдена`);
    }

    const productType = await this.typeRepository.findById(params.typeId);
    if (!productType) {
      throw new Error(`Тип товара с ID ${params.typeId} не найден`);
    }

    // Проверка соответствия типа категории
    if (productType.descriptionCategoryId !== params.descriptionCategoryId) {
      throw new Error('Указанный тип товара не принадлежит выбранной категории');
    }

    // Генерация уникального хэша
    const hash = await this.generateUniqueHash();

    // Проверка уникальности артикула для пользователя
    const isArticleNumberUnique = await this.requestRepository.isArticleNumberUniqueForUser(
      params.articleNumber,
      params.username
    );
    if (!isArticleNumberUnique) {
      throw new Error(`Артикул ${params.articleNumber} уже используется в ваших заявках`);
    }

    // Создание атрибутов заявки
    const attributeValues = await this.createAttributeValues(params.attributes || []);

    // Валидация атрибутов
    await this.validateRequiredAttributes(attributeValues, params.descriptionCategoryId, params.typeId);

    // Создание изображений заявки
    const images = this.createImageEntities(params.images || []);

    // Валидация изображений
    this.validateImages(images, params.primaryImageUrl);

    // Создание заявки
    const request = new RequestDomainEntity({
      hash,
      blockchainId: config.blockchain.id,
      programId: 0,
      unitCost: params.price,
      supplierAmount: params.price,
      totalCost: params.price,
      membershipFee: 0,
      parentHash: params.parentHash,
      coopname: params.coopname,
      username: params.username,
      // TODO: добавить участок поставки / получения
      type: params.type,
      status: RequestStatus.DRAFT,
      name: params.name,
      articleNumber: params.articleNumber,
      barcode: params.barcode,
      descriptionCategoryId: params.descriptionCategoryId,
      typeId: params.typeId,
      category,
      productType,
      price: params.price,
      oldPrice: params.oldPrice,
      currencyCode: params.currencyCode,
      vat: params.vat,
      width: params.width,
      height: params.height,
      depth: params.depth,
      dimensionUnit: params.dimensionUnit,
      weight: params.weight,
      weightUnit: params.weightUnit,
      units: params.units,
      availableUnits: params.units,
      settledUnits: 0,
      productLifecycleSecs: params.productLifecycleSecs,
      warrantyDays: params.warrantyDays,
      data: params.data,
      meta: params.meta,
      attributes: attributeValues,
      images,
      primaryImageUrl: params.primaryImageUrl,
      colorImageUrl: params.colorImageUrl,
      geoNames: params.geoNames || [],
    });

    return await this.requestRepository.save(request);
  }

  /**
   * Обновить заявку
   */
  async updateRequest(
    requestId: number,
    updateParams: Partial<{
      name: string;
      price: number;
      oldPrice: number;
      units: number;
      width: number;
      height: number;
      depth: number;
      weight: number;
      productLifecycleSecs: number;
      warrantyDays: number;
      data: string;
      meta: string;
      attributes: Array<{
        attributeId: number;
        value: string;
        complexId?: number;
        dictionaryValueId?: number;
      }>;
      images: Array<{
        imageUrl: string;
        imageType: RequestImageType;
        sortOrder: number;
        description?: string;
      }>;
      primaryImageUrl: string;
      colorImageUrl: string;
      geoNames: string[];
    }>
  ): Promise<RequestDomainEntity> {
    const existingRequest = await this.requestRepository.findById(requestId);
    if (!existingRequest) {
      throw new Error('Заявка не найдена');
    }

    if (!existingRequest.canBeEdited()) {
      throw new Error('Заявку нельзя редактировать в текущем статусе');
    }

    // Создание обновленных атрибутов если они переданы
    let updatedAttributes = existingRequest.attributes;
    if (updateParams.attributes) {
      updatedAttributes = await this.createAttributeValues(updateParams.attributes);
      await this.validateRequiredAttributes(
        updatedAttributes,
        existingRequest.descriptionCategoryId,
        existingRequest.typeId
      );
    }

    // Создание обновленных изображений если они переданы
    let updatedImages = existingRequest.images;
    if (updateParams.images) {
      updatedImages = this.createImageEntities(updateParams.images);
      this.validateImages(updatedImages, updateParams.primaryImageUrl);
    }

    return await this.requestRepository.update(requestId, {
      ...updateParams,
      attributes: updatedAttributes,
      images: updatedImages,
    });
  }

  /**
   * Опубликовать заявку
   */
  async publishRequest(requestId: number): Promise<RequestDomainEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new Error('Заявка не найдена');
    }

    // Валидация готовности к публикации
    const validation = request.isValidForPublication();
    if (!validation.valid) {
      throw new Error(`Заявка не готова к публикации: ${validation.errors.join(', ')}`);
    }

    await this.requestRepository.updateStatus(requestId, RequestStatus.MODERATION);
    return (await this.requestRepository.findById(requestId)) as RequestDomainEntity;
  }

  /**
   * Найти потенциальные совпадения для заявки
   */
  async findPotentialMatches(requestId: number): Promise<RequestDomainEntity[]> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new Error('Заявка не найдена');
    }

    return await this.requestRepository.findPotentialMatches(request);
  }

  /**
   * Получить статистику заявок
   */
  async getRequestStatistics(coopname?: string) {
    return await this.requestRepository.getStatistics(coopname);
  }

  /**
   * Найти заявку по ID
   */
  async findById(id: number): Promise<RequestDomainEntity | null> {
    return await this.requestRepository.findById(id);
  }

  /**
   * Найти заявку по хэшу
   */
  async findByHash(hash: string): Promise<RequestDomainEntity | null> {
    return await this.requestRepository.findByHash(hash);
  }

  /**
   * Найти недавние заявки пользователя
   */
  async findRecentByUser(username: string, limit?: number): Promise<RequestDomainEntity[]> {
    return await this.requestRepository.findRecentByUser(username, limit);
  }

  /**
   * Найти заявки с фильтрами
   */
  async findWithFilters(filters: {
    coopname?: string;
    username?: string;
    type?: RequestType;
    status?: RequestStatus;
    categoryId?: number;
    typeId?: number;
    priceFrom?: number;
    priceTo?: number;
    createdAfter?: Date;
    createdBefore?: Date;
    limit?: number;
    offset?: number;
  }): Promise<RequestDomainEntity[]> {
    return await this.requestRepository.findWithFilters(filters);
  }

  /**
   * Поиск заявок по названию товара
   */
  async searchByProductName(searchTerm: string, limit?: number): Promise<RequestDomainEntity[]> {
    return await this.requestRepository.searchByProductName(searchTerm, limit);
  }

  /**
   * Генерировать уникальный хэш для заявки
   */
  private async generateUniqueHash(): Promise<string> {
    let hash: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      hash = randomBytes(16).toString('hex');
      isUnique = await this.requestRepository.isHashUnique(hash);
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error('Не удалось сгенерировать уникальный хэш после нескольких попыток');
      }
    } while (!isUnique);

    return hash;
  }

  /**
   * Валидировать базовые параметры заявки
   */
  private async validateBasicParams(params: any): Promise<void> {
    const errors: string[] = [];

    if (!params.name?.trim()) errors.push('Название товара обязательно');
    if (!params.articleNumber?.trim()) errors.push('Артикул обязателен');
    if (!params.price || params.price <= 0) errors.push('Цена должна быть больше 0');
    if (!params.units || params.units <= 0) errors.push('Количество должно быть больше 0');
    if (!params.currencyCode?.trim()) errors.push('Валюта обязательна');
    if (!params.vat) errors.push('НДС обязателен');

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  /**
   * Проверить доступность категории и типа для кооператива
   */
  private async validateCategoryTypeAvailability(coopname: string, categoryId: number, typeId: number): Promise<void> {
    const isAvailable = await this.availableCategoryService.isTypeAvailable(coopname, categoryId, typeId);
    if (!isAvailable) {
      throw new Error('Выбранная категория или тип товара недоступны для вашего кооператива');
    }
  }

  /**
   * Создать сущности значений атрибутов
   */
  private async createAttributeValues(
    attributesData: Array<{
      attributeId: number;
      value: string;
      complexId?: number;
      dictionaryValueId?: number;
    }>
  ): Promise<RequestAttributeValueDomainEntity[]> {
    const attributeValues: RequestAttributeValueDomainEntity[] = [];

    for (const attrData of attributesData) {
      const attribute = await this.attributeRepository.findById(attrData.attributeId);
      if (!attribute) {
        throw new Error(`Атрибут с ID ${attrData.attributeId} не найден`);
      }

      const attributeValue = new RequestAttributeValueDomainEntity({
        attributeId: attrData.attributeId,
        attribute,
        complexId: attrData.complexId || 0,
        value: attrData.value,
        dictionaryValueId: attrData.dictionaryValueId,
      });

      // Валидация значения атрибута
      const validation = attributeValue.validateValue();
      if (!validation.valid) {
        throw new Error(`Ошибка валидации атрибута: ${validation.errors.join(', ')}`);
      }

      attributeValues.push(attributeValue);
    }

    return attributeValues;
  }

  /**
   * Валидировать обязательные атрибуты
   */
  private async validateRequiredAttributes(
    attributeValues: RequestAttributeValueDomainEntity[],
    categoryId: number,
    typeId: number
  ): Promise<void> {
    const requiredAttributes = await this.attributeRepository.findByCategoryAndType(categoryId, typeId);
    const requiredAttributeIds = requiredAttributes.filter((attr) => attr.isRequired).map((attr) => attr.attributeId);
    const providedAttributeIds = attributeValues.map((av) => av.attributeId);

    const missingRequired = requiredAttributeIds.filter((id) => !providedAttributeIds.includes(id));

    if (missingRequired.length > 0) {
      const missingNames = requiredAttributes
        .filter((attr) => missingRequired.includes(attr.attributeId))
        .map((attr) => attr.name);
      throw new Error(`Не заполнены обязательные атрибуты: ${missingNames.join(', ')}`);
    }
  }

  /**
   * Создать сущности изображений
   */
  private createImageEntities(
    imagesData: Array<{
      imageUrl: string;
      imageType: RequestImageType;
      sortOrder: number;
      description?: string;
    }>
  ): RequestImageDomainEntity[] {
    return imagesData.map((imageData) => new RequestImageDomainEntity(imageData));
  }

  /**
   * Валидировать изображения
   */
  private validateImages(images: RequestImageDomainEntity[], primaryImageUrl?: string): void {
    // Проверка валидности URL каждого изображения
    for (const image of images) {
      const validation = image.validateImageUrl();
      if (!validation.valid) {
        throw new Error(`Ошибка изображения: ${validation.errors.join(', ')}`);
      }
    }

    // Проверка наличия хотя бы одного изображения
    if (images.length === 0 && !primaryImageUrl) {
      throw new Error('Необходимо добавить хотя бы одно изображение');
    }

    // Проверка уникальности главного изображения
    const primaryImages = images.filter((img) => img.isPrimary());
    if (primaryImages.length > 1) {
      throw new Error('Может быть только одно главное изображение');
    }
  }
}
