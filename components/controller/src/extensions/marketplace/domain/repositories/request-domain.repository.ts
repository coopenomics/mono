import type { RequestDomainEntity, RequestType, RequestStatus } from '../entities/request-domain.entity';

/**
 * Токен для внедрения зависимостей
 */
export const REQUEST_DOMAIN_REPOSITORY = Symbol('REQUEST_DOMAIN_REPOSITORY');

/**
 * Интерфейс доменного репозитория для заявок marketplace
 */
export interface RequestDomainRepository {
  /**
   * Получить все заявки
   */
  findAll(): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявку по ID
   */
  findById(id: number): Promise<RequestDomainEntity | null>;

  /**
   * Найти заявку по хэшу
   */
  findByHash(hash: string): Promise<RequestDomainEntity | null>;

  /**
   * Найти заявки по кооперативу
   */
  findByCoopname(coopname: string): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявки по пользователю
   */
  findByUsername(username: string): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявки по типу (offer/order)
   */
  findByType(type: RequestType): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявки по статусу
   */
  findByStatus(status: RequestStatus): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявки по категории
   */
  findByCategoryId(categoryId: number): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявки по типу товара
   */
  findByProductTypeId(typeId: number): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявки по категории и типу товара
   */
  findByCategoryAndType(categoryId: number, typeId: number): Promise<RequestDomainEntity[]>;

  /**
   * Найти активные заявки определенного типа
   */
  findActiveByType(type: RequestType): Promise<RequestDomainEntity[]>;

  /**
   * Найти заявки, готовые для сопоставления
   */
  findMatchableRequests(type: RequestType, categoryId: number, typeId: number): Promise<RequestDomainEntity[]>;

  /**
   * Поиск заявок по названию товара
   */
  searchByProductName(searchTerm: string, limit?: number): Promise<RequestDomainEntity[]>;

  /**
   * Поиск заявок по артикулу
   */
  findByArticleNumber(articleNumber: string): Promise<RequestDomainEntity[]>;

  /**
   * Найти дочерние заявки по родительскому хэшу
   */
  findByParentHash(parentHash: string): Promise<RequestDomainEntity[]>;

  /**
   * Получить заявки с фильтрами
   */
  findWithFilters(filters: {
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
  }): Promise<RequestDomainEntity[]>;

  /**
   * Подсчитать количество заявок с фильтрами
   */
  countWithFilters(filters: {
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
  }): Promise<number>;

  /**
   * Сохранить заявку
   */
  save(request: RequestDomainEntity): Promise<RequestDomainEntity>;

  /**
   * Обновить заявку
   */
  update(id: number, updateData: Partial<RequestDomainEntity>): Promise<RequestDomainEntity>;

  /**
   * Удалить заявку
   */
  delete(id: number): Promise<void>;

  /**
   * Проверить уникальность хэша
   */
  isHashUnique(hash: string): Promise<boolean>;

  /**
   * Проверить уникальность артикула для пользователя
   */
  isArticleNumberUniqueForUser(articleNumber: string, username: string, excludeId?: number): Promise<boolean>;

  /**
   * Получить статистику заявок
   */
  getStatistics(coopname?: string): Promise<{
    totalRequests: number;
    activeOffers: number;
    activeOrders: number;
    completedDeals: number;
    requestsByCategory: Array<{ categoryId: number; categoryName: string; count: number }>;
  }>;

  /**
   * Найти потенциальные совпадения для заявки
   */
  findPotentialMatches(request: RequestDomainEntity): Promise<RequestDomainEntity[]>;

  /**
   * Получить последние заявки пользователя
   */
  findRecentByUser(username: string, limit?: number): Promise<RequestDomainEntity[]>;

  /**
   * Получить популярные категории заявок
   */
  getPopularCategories(
    type?: RequestType,
    limit?: number
  ): Promise<
    Array<{
      categoryId: number;
      categoryName: string;
      requestCount: number;
    }>
  >;

  /**
   * Обновить статус заявки
   */
  updateStatus(id: number, status: RequestStatus): Promise<void>;

  /**
   * Обновить доступное количество единиц
   */
  updateAvailableUnits(id: number, units: number): Promise<void>;

  /**
   * Увеличить количество проданных единиц
   */
  incrementSettledUnits(id: number, amount: number): Promise<void>;
}
