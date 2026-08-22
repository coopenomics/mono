import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { RequestDomainRepository } from '../../domain/repositories/request-domain.repository';
import { RequestDomainEntity, RequestType, RequestStatus } from '../../domain/entities/request-domain.entity';
import { RequestEntity } from '../entities/request.entity';
import { RequestMapper } from '../mappers/request.mapper';

@Injectable()
export class RequestRepositoryAdapter implements RequestDomainRepository {
  constructor(
    @InjectRepository(RequestEntity, 'marketplace')
    private readonly requestRepository: Repository<RequestEntity>
  ) {}

  async findAll(): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findById(id: number): Promise<RequestDomainEntity | null> {
    const entity = await this.requestRepository.findOne({
      where: { id },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
    });
    return entity ? RequestMapper.toDomain(entity) : null;
  }

  async findByHash(hash: string): Promise<RequestDomainEntity | null> {
    const entity = await this.requestRepository.findOne({
      where: { hash },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
    });
    return entity ? RequestMapper.toDomain(entity) : null;
  }

  async findByCoopname(coopname: string): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { coopname },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findByUsername(username: string): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { username },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findByType(type: RequestType): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { type },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findByStatus(status: RequestStatus): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { status },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findByCategoryId(categoryId: number): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { descriptionCategoryId: categoryId },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findByProductTypeId(typeId: number): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { typeId },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findByCategoryAndType(categoryId: number, typeId: number): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { descriptionCategoryId: categoryId, typeId },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findActiveByType(type: RequestType): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { type, status: RequestStatus.ACTIVE },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findMatchableRequests(type: RequestType, categoryId: number, typeId: number): Promise<RequestDomainEntity[]> {
    // Находим заявки противоположного типа в той же категории
    const oppositeType = type === RequestType.OFFER ? RequestType.ORDER : RequestType.OFFER;

    const entities = await this.requestRepository.find({
      where: {
        type: oppositeType,
        status: RequestStatus.ACTIVE,
        descriptionCategoryId: categoryId,
        typeId,
      },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'ASC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async searchByProductName(searchTerm: string, limit = 50): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.category', 'category')
      .leftJoinAndSelect('request.productType', 'productType')
      .leftJoinAndSelect('request.attributes', 'attributes')
      .leftJoinAndSelect('attributes.attribute', 'attribute')
      .leftJoinAndSelect('request.images', 'images')
      .where('LOWER(request.name) LIKE LOWER(:searchTerm)', { searchTerm: `%${searchTerm}%` })
      .orderBy('request.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return RequestMapper.toDomainArray(entities);
  }

  async findByArticleNumber(articleNumber: string): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { articleNumber },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

  async findByParentHash(parentHash: string): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { parentHash },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
    });
    return RequestMapper.toDomainArray(entities);
  }

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
    const query = this.buildFilterQuery(filters);

    if (filters.limit) query.limit(filters.limit);
    if (filters.offset) query.offset(filters.offset);

    query.orderBy('request.createdAt', 'DESC');

    const entities = await query.getMany();
    return RequestMapper.toDomainArray(entities);
  }

  async countWithFilters(filters: {
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
  }): Promise<number> {
    const query = this.buildFilterQuery(filters);
    return await query.getCount();
  }

  async save(request: RequestDomainEntity): Promise<RequestDomainEntity> {
    const entity = RequestMapper.toEntity(request);
    const savedEntity = await this.requestRepository.save(entity);

    // Получаем сохраненную сущность с полными связями
    const fullEntity = await this.requestRepository.findOne({
      where: { id: savedEntity.id },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
    });

    if (!fullEntity) {
      throw new Error('Заявка не найдена после сохранения');
    }

    return RequestMapper.toDomain(fullEntity);
  }

  async update(id: number, updateData: Partial<RequestDomainEntity>): Promise<RequestDomainEntity> {
    await this.requestRepository.update(id, updateData as any);

    const updatedEntity = await this.requestRepository.findOne({
      where: { id },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
    });

    if (!updatedEntity) {
      throw new Error('Заявка не найдена после обновления');
    }

    return RequestMapper.toDomain(updatedEntity);
  }

  async delete(id: number): Promise<void> {
    await this.requestRepository.delete(id);
  }

  async isHashUnique(hash: string): Promise<boolean> {
    const count = await this.requestRepository.count({ where: { hash } });
    return count === 0;
  }

  async isArticleNumberUniqueForUser(articleNumber: string, username: string, excludeId?: number): Promise<boolean> {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .where('request.articleNumber = :articleNumber AND request.username = :username', { articleNumber, username });

    if (excludeId) {
      queryBuilder.andWhere('request.id != :excludeId', { excludeId });
    }

    const count = await queryBuilder.getCount();
    return count === 0;
  }

  async getStatistics(coopname?: string) {
    const baseQuery = this.requestRepository.createQueryBuilder('request').leftJoin('request.category', 'category');

    if (coopname) {
      baseQuery.where('request.coopname = :coopname', { coopname });
    }

    const totalRequests = await baseQuery.getCount();

    const activeOffers = await baseQuery
      .clone()
      .andWhere('request.type = :type AND request.status = :status', {
        type: RequestType.OFFER,
        status: RequestStatus.ACTIVE,
      })
      .getCount();

    const activeOrders = await baseQuery
      .clone()
      .andWhere('request.type = :type AND request.status = :status', {
        type: RequestType.ORDER,
        status: RequestStatus.ACTIVE,
      })
      .getCount();

    const completedDeals = await baseQuery
      .clone()
      .andWhere('request.status = :status', { status: RequestStatus.COMPLETED })
      .getCount();

    const requestsByCategory = await baseQuery
      .clone()
      .select(['request.descriptionCategoryId as categoryId', 'category.categoryName as categoryName', 'COUNT(*) as count'])
      .groupBy('request.descriptionCategoryId, category.categoryName')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalRequests,
      activeOffers,
      activeOrders,
      completedDeals,
      requestsByCategory: requestsByCategory.map((item) => ({
        categoryId: parseInt(item.categoryId),
        categoryName: item.categoryName,
        count: parseInt(item.count),
      })),
    };
  }

  async findPotentialMatches(request: RequestDomainEntity): Promise<RequestDomainEntity[]> {
    const oppositeType = request.type === RequestType.OFFER ? RequestType.ORDER : RequestType.OFFER;

    const entities = await this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.category', 'category')
      .leftJoinAndSelect('request.productType', 'productType')
      .leftJoinAndSelect('request.attributes', 'attributes')
      .leftJoinAndSelect('attributes.attribute', 'attribute')
      .leftJoinAndSelect('request.images', 'images')
      .where('request.type = :type', { type: oppositeType })
      .andWhere('request.status = :status', { status: RequestStatus.ACTIVE })
      .andWhere('request.descriptionCategoryId = :categoryId', { categoryId: request.descriptionCategoryId })
      .andWhere('request.typeId = :typeId', { typeId: request.typeId })
      .andWhere('request.coopname = :coopname', { coopname: request.coopname })
      .orderBy('request.createdAt', 'ASC')
      .getMany();

    return RequestMapper.toDomainArray(entities);
  }

  async findRecentByUser(username: string, limit = 10): Promise<RequestDomainEntity[]> {
    const entities = await this.requestRepository.find({
      where: { username },
      relations: ['category', 'productType', 'attributes', 'attributes.attribute', 'images'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return RequestMapper.toDomainArray(entities);
  }

  async getPopularCategories(type?: RequestType, limit = 10) {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.category', 'category')
      .select([
        'request.descriptionCategoryId as categoryId',
        'category.categoryName as categoryName',
        'COUNT(*) as requestCount',
      ]);

    if (type) {
      queryBuilder.where('request.type = :type', { type });
    }

    const results = await queryBuilder
      .groupBy('request.descriptionCategoryId, category.categoryName')
      .orderBy('requestCount', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((item) => ({
      categoryId: parseInt(item.categoryId),
      categoryName: item.categoryName,
      requestCount: parseInt(item.requestCount),
    }));
  }

  async updateStatus(id: number, status: RequestStatus): Promise<void> {
    await this.requestRepository.update(id, { status });
  }

  async updateAvailableUnits(id: number, units: number): Promise<void> {
    await this.requestRepository.update(id, { availableUnits: units });
  }

  async incrementSettledUnits(id: number, amount: number): Promise<void> {
    await this.requestRepository
      .createQueryBuilder()
      .update(RequestEntity)
      .set({ settledUnits: () => `settled_units + ${amount}` })
      .where('id = :id', { id })
      .execute();
  }

  /**
   * Вспомогательный метод для создания запроса с фильтрами
   */
  private buildFilterQuery(filters: any): SelectQueryBuilder<RequestEntity> {
    const query = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.category', 'category')
      .leftJoinAndSelect('request.productType', 'productType')
      .leftJoinAndSelect('request.attributes', 'attributes')
      .leftJoinAndSelect('attributes.attribute', 'attribute')
      .leftJoinAndSelect('request.images', 'images');

    if (filters.coopname) {
      query.andWhere('request.coopname = :coopname', { coopname: filters.coopname });
    }

    if (filters.username) {
      query.andWhere('request.username = :username', { username: filters.username });
    }

    if (filters.type) {
      query.andWhere('request.type = :type', { type: filters.type });
    }

    if (filters.status) {
      query.andWhere('request.status = :status', { status: filters.status });
    }

    if (filters.categoryId) {
      query.andWhere('request.descriptionCategoryId = :categoryId', { categoryId: filters.categoryId });
    }

    if (filters.typeId) {
      query.andWhere('request.typeId = :typeId', { typeId: filters.typeId });
    }

    if (filters.priceFrom !== undefined) {
      query.andWhere('request.price >= :priceFrom', { priceFrom: filters.priceFrom });
    }

    if (filters.priceTo !== undefined) {
      query.andWhere('request.price <= :priceTo', { priceTo: filters.priceTo });
    }

    if (filters.createdAfter) {
      query.andWhere('request.createdAt >= :createdAfter', { createdAfter: filters.createdAfter });
    }

    if (filters.createdBefore) {
      query.andWhere('request.createdAt <= :createdBefore', { createdBefore: filters.createdBefore });
    }

    return query;
  }
}
